import { GoogleGenAI } from "@google/genai";
import { SessionData } from "../agent-engine";
import { DEFAULT_MODEL_ID, getModelById } from "../providers";
import { aiProviderRegistry } from "../ai/registry";
import { getAgentById } from "../opencode-agents";
import { sandboxManager } from "../sandbox/manager";
import { SandboxProvider } from "../sandbox/provider";
import {
  getGeminiFunctionDeclarations,
  getOpenAIToolsSchema,
  executeToolCall,
} from "./tools";
import type { AgentEvent, MessageBlock, ToolStep } from "../types";

export interface AgentLoopOptions {
  session: SessionData;
  userMessage?: string;
  modelId?: string;
  agentId?: string;
  emit: (event: AgentEvent) => void;
  signal?: AbortSignal;
}

export async function runAgentLoop({
  session,
  userMessage,
  modelId,
  agentId,
  emit,
  signal,
}: AgentLoopOptions): Promise<void> {
  // Add user message if provided
  if (userMessage) {
    session.messages.push({
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
    });
  }

  if (modelId) {
    session.model = modelId;
    session.provider = getModelById(modelId).providerName;
  }

  const activeModel = getModelById(session.model || DEFAULT_MODEL_ID);
  const agent = getAgentById(agentId || "build");

  session.agent_running = true;
  session.needs_run = false;

  const assistantMsgId = crypto.randomUUID();
  const blocks: MessageBlock[] = [];
  let fullAssistantText = "";

  try {
    emit({
      type: "status",
      message: `Initialisation de l'environnement d'exécution réel (${session.providerId || "local"})...`,
    });

    // 1. Resolve or create physical SandboxProvider
    const preferredProviderId = session.environment === "local" ? "local" : (session.providerId || "local");
    let provider: SandboxProvider;
    try {
      const sandbox = await sandboxManager.getOrCreateSandbox(session.id, preferredProviderId);
      provider = sandbox.provider;
    } catch {
      // Fallback to local machine provider
      const sandbox = await sandboxManager.getOrCreateSandbox(session.id, "local");
      provider = sandbox.provider;
    }

    emit({
      type: "status",
      message: `Connexion au runtime ${activeModel.providerName} (${activeModel.name})...`,
    });

    // 2. Resolve credentials
    const aiProvider = aiProviderRegistry.getProviderForModel(activeModel.id);
    const cred = aiProvider.resolveCredentials(session.id);

    if (!cred.isConfigured || !cred.apiKey) {
      throw new Error(
        `Le provider ${aiProvider.name} n'est pas configuré (${cred.sourceLabel}). ` +
          `Veuillez configurer votre clé API dans Paramètres > Providers.`
      );
    }

    // 3. Build system prompt
    const initialFilesList = Object.keys(session.files || {}).join(", ") || "(dossier vide)";
    const systemPrompt = `Tu es SoryOS-Code (${agent.name}), un agent autonome de programmation de pointe.
Tu incarnes le rôle : **${agent.role}** [${agent.badge}].
Tu es propulsé par : **${activeModel.name}** (${activeModel.providerName}).

MISSION :
Tu as accès à des outils réels pour interagir directement avec le véritable espace de travail de l'utilisateur :
- \`read_file\` : lire le contenu d'un fichier avec numéros de lignes
- \`write_file\` : créer ou réécrire un fichier
- \`edit_file\` : remplacer précisément un extrait de code dans un fichier
- \`list_files\` : explorer les fichiers et dossiers du projet
- \`shell_command\` : exécuter une commande bash réelle (npm install, npm run build, tests, git, etc.)
- \`grep_search\` : chercher un mot-clé dans les fichiers

RÈGLES D'OR DU CODING AGENT :
1. "NO REAL ACTION, NO SUCCESS" : Ne prétends JAMAIS avoir créé, modifié ou testé un fichier sans avoir appelé l'outil correspondant.
2. Si l'utilisateur demande de créer ou modifier du code : appelle \`write_file\` ou \`edit_file\`.
3. Si une commande est nécessaire (installer des dépendances, compiler, tester) : appelle \`shell_command\`.
4. Vérifie les résultats réels renvoyés par les outils. Si une commande ou un test échoue (code de sortie non nul), analyse l'erreur, corrige le code et réessaie.
5. Fichiers actuellement présents dans le projet : ${initialFilesList}.
6. Réponds de manière concise, professionnelle et rigoureuse.`;

    // Check if this is Google Gemini (preferred native function calling)
    if (activeModel.providerId === "google") {
      await runGeminiAgentLoop({
        apiKey: cred.apiKey,
        modelName: activeModel.id,
        systemPrompt,
        session,
        provider,
        blocks,
        emit,
        signal,
        onTextDelta: (delta) => {
          fullAssistantText += delta;
        },
      });
    } else {
      // Fallback for OpenAI-compatible providers
      await runOpenAIAgentLoop({
        endpoint: aiProvider.getEndpoint(),
        apiKey: cred.apiKey,
        modelName: activeModel.id,
        systemPrompt,
        session,
        provider,
        blocks,
        emit,
        signal,
        onTextDelta: (delta) => {
          fullAssistantText += delta;
        },
      });
    }

    // Wrap-up assistant turn
    if (fullAssistantText) {
      blocks.push({ type: "text", content: fullAssistantText });
    }

    // Check if files changed and set preview
    const fileKeys = Object.keys(session.files);
    if (fileKeys.length > 0) {
      session.preview_url = `/api/preview/${session.id}`;
      emit({ type: "files_changed", paths: fileKeys });
      emit({ type: "preview", url: session.preview_url });
    }

    emit({
      type: "done",
      usage: {
        input: 250,
        output: Math.max(50, Math.floor(fullAssistantText.length / 4)),
        cacheRead: 0,
        cacheMiss: 250,
      },
    });

    session.messages.push({
      id: assistantMsgId,
      role: "assistant",
      content: fullAssistantText || "Tâche exécutée avec succès.",
      blocks,
      created_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    emit({ type: "error", message: errorMsg });
    session.messages.push({
      id: assistantMsgId,
      role: "assistant",
      content: `Erreur d'exécution de l'agent : ${errorMsg}`,
      blocks: [
        {
          type: "text",
          content: `⚠️ Une erreur est survenue lors de l'exécution : **${errorMsg}**`,
        },
      ],
      created_at: new Date().toISOString(),
    });
  } finally {
    session.agent_running = false;
  }
}

/**
 * Loop using @google/genai native Function Calling
 */
async function runGeminiAgentLoop({
  apiKey,
  modelName,
  systemPrompt,
  session,
  provider,
  blocks,
  emit,
  signal,
  onTextDelta,
}: {
  apiKey: string;
  modelName: string;
  systemPrompt: string;
  session: SessionData;
  provider: SandboxProvider;
  blocks: MessageBlock[];
  emit: (event: AgentEvent) => void;
  signal?: AbortSignal;
  onTextDelta: (delta: string) => void;
}) {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const functionDeclarations = getGeminiFunctionDeclarations();

  // Convert previous messages to Gemini contents format
  const contents: any[] = [];
  for (const m of session.messages) {
    if (m.role === "user") {
      contents.push({ role: "user", parts: [{ text: m.content }] });
    } else if (m.role === "assistant") {
      contents.push({ role: "model", parts: [{ text: m.content }] });
    }
  }

  let step = 0;
  const maxSteps = 12;

  while (step < maxSteps) {
    if (signal?.aborted) {
      emit({ type: "status", message: "Exécution interrompue par l'utilisateur." });
      break;
    }

    step++;
    emit({
      type: "status",
      message: step === 1 ? "Analyse de la demande..." : `Étape ${step} : Analyse du résultat et suite du plan...`,
    });

    let usedModel = modelName;
    let response: any;

    try {
      response = await ai.models.generateContent({
        model: usedModel,
        contents,
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations }],
        },
      });
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      if (
        (rawMsg.includes("503") || rawMsg.includes("high demand") || rawMsg.includes("UNAVAILABLE")) &&
        usedModel !== "gemini-3.1-flash-lite"
      ) {
        console.warn(`[Gemini] ${usedModel} 503 fallback to gemini-3.1-flash-lite`);
        usedModel = "gemini-3.1-flash-lite";
        response = await ai.models.generateContent({
          model: usedModel,
          contents,
          config: {
            systemInstruction: systemPrompt,
            tools: [{ functionDeclarations }],
          },
        });
      } else {
        throw err;
      }
    }

    // Extract any model text
    const textPart = response.text || "";
    if (textPart.trim()) {
      onTextDelta(textPart);
      emit({ type: "text", delta: textPart });
    }

    // Check if the model called any tools
    const functionCalls = response.functionCalls;

    if (!functionCalls || functionCalls.length === 0) {
      // Model did not request any tools, meaning it has provided its final response!
      break;
    }

    // Add model's turn to conversation history
    const candidateParts = response.candidates?.[0]?.content?.parts || [];
    contents.push({
      role: "model",
      parts: candidateParts,
    });

    // Execute each tool call physically on the workspace!
    const responseParts: any[] = [];

    for (const call of functionCalls) {
      if (signal?.aborted) break;

      const callId = `call-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const toolName = call.name;
      const toolArgs = (call.args as Record<string, unknown>) || {};

      emit({
        type: "status",
        message: `Exécution réelle de l'outil : ${toolName}...`,
      });

      // 1. Emit tool_start event to UI -> card goes to "running" state
      emit({
        type: "tool_start",
        id: callId,
        name: toolName,
        input: toolArgs,
      });

      const toolStep: ToolStep = {
        id: callId,
        name: toolName,
        input: toolArgs,
        status: "running",
        startedAt: new Date().toISOString(),
      };

      // 2. Perform the actual physical execution on the workspace!
      const execResult = await executeToolCall(toolName, toolArgs, provider, session);

      toolStep.output = execResult.output;
      toolStep.isError = execResult.isError;
      toolStep.status = execResult.isError ? "error" : "done";
      toolStep.completedAt = new Date().toISOString();
      toolStep.metadata = execResult.metadata;

      blocks.push({
        type: "tool",
        step: toolStep,
      });

      // 3. Emit tool_end event to UI -> card transitions to "done" or "error"
      emit({
        type: "tool_end",
        id: callId,
        output: execResult.output,
        isError: execResult.isError,
      });

      // 4. Record function response part for Gemini
      responseParts.push({
        functionResponse: {
          name: toolName,
          response: {
            output: execResult.output,
            isError: execResult.isError,
          },
        },
      });
    }

    // 5. Append function responses back to contents for next step
    contents.push({
      role: "user",
      parts: responseParts,
    });
  }
}

/**
 * Loop for OpenAI-compatible providers
 */
async function runOpenAIAgentLoop({
  endpoint,
  apiKey,
  modelName,
  systemPrompt,
  session,
  provider,
  blocks,
  emit,
  signal,
  onTextDelta,
}: {
  endpoint: string;
  apiKey: string;
  modelName: string;
  systemPrompt: string;
  session: SessionData;
  provider: SandboxProvider;
  blocks: MessageBlock[];
  emit: (event: AgentEvent) => void;
  signal?: AbortSignal;
  onTextDelta: (delta: string) => void;
}) {
  const tools = getOpenAIToolsSchema();

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    ...session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  let step = 0;
  const maxSteps = 12;

  while (step < maxSteps) {
    if (signal?.aborted) break;

    step++;
    emit({
      type: "status",
      message: step === 1 ? "Analyse de la demande..." : `Étape ${step} : Suite du plan de codage...`,
    });

    const res = await fetch(`${endpoint.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.2,
      }),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Erreur provider HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const message = choice?.message;

    if (!message) break;

    if (message.content) {
      onTextDelta(message.content);
      emit({ type: "text", delta: message.content });
    }

    messages.push(message);

    const toolCalls = message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      break;
    }

    for (const tc of toolCalls) {
      if (signal?.aborted) break;

      const callId = tc.id || `call-${Date.now()}`;
      const toolName = tc.function?.name || "";
      let toolArgs: Record<string, unknown> = {};

      try {
        toolArgs = JSON.parse(tc.function?.arguments || "{}");
      } catch {
        toolArgs = {};
      }

      emit({
        type: "tool_start",
        id: callId,
        name: toolName,
        input: toolArgs,
      });

      const execResult = await executeToolCall(toolName, toolArgs, provider, session);

      blocks.push({
        type: "tool",
        step: {
          id: callId,
          name: toolName,
          input: toolArgs,
          output: execResult.output,
          isError: execResult.isError,
          status: execResult.isError ? "error" : "done",
          metadata: execResult.metadata,
        },
      });

      emit({
        type: "tool_end",
        id: callId,
        output: execResult.output,
        isError: execResult.isError,
      });

      messages.push({
        role: "tool",
        tool_call_id: callId,
        content: execResult.output,
      });
    }
  }
}
