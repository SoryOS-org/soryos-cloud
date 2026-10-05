/**
 * @soryos/agent
 * Core Autonomous Agent Runtime inspired by OpenCode, Codex CLI, and Gemini CLI.
 */

import { GoogleGenAI } from "@google/genai";
import { AgentDefinition, MessageBlock, SessionData, ToolStep } from "@soryos/schema";
import { ExecutionProvider, executionManager } from "@soryos/execution";
import { toolRegistry, toolExecutor, ToolExecutionResult } from "@soryos/tool";
import { globalEventBus } from "@soryos/bus";

export const AGENT_MATRIX: AgentDefinition[] = [
  {
    id: "build",
    name: "Build Agent",
    role: "Full-Stack Autonomous Architect & Engineer",
    description: "Builds complete applications, executes commands, writes code, and applies precision patches.",
    badge: "Primary Agent",
    icon: "🔨",
    color: "#c6623f",
    mode: "primary",
    tools: ["read_file", "write_file", "edit_file", "apply_patch", "shell_command", "list_files", "glob_files", "grep_search", "todowrite", "todoread"],
    capabilities: ["Autonomous coding", "Build validation", "Surgical patching", "Command execution"],
    whenToUse: "Default workspace engineer for coding and fixing bugs.",
    systemPrompt: "You are the SoryOS-Code Build Agent. Build and fix applications with zero placeholders.",
  },
  {
    id: "plan",
    name: "Plan Agent",
    role: "System Architect & Milestone Planner",
    description: "Decomposes goals into architecture blueprints and todo roadmaps without modifying code.",
    badge: "Architect",
    icon: "📋",
    color: "#3b82f6",
    mode: "all",
    tools: ["read_file", "list_files", "glob_files", "grep_search", "todoread", "todowrite"],
    capabilities: ["Architecture blueprints", "Task checklist tracking", "Read-only inspection"],
    whenToUse: "Planning multi-phase roadmaps before writing code.",
    systemPrompt: "You are the SoryOS-Code Plan Agent. Break down tasks into structured milestones.",
  },
  {
    id: "explore",
    name: "Explore Agent",
    role: "Codebase Search Specialist",
    description: "Rapidly navigates large codebases using glob patterns and regex grep. Safe read-only.",
    badge: "Search Specialist",
    icon: "🔍",
    color: "#10b981",
    mode: "subagent",
    tools: ["glob_files", "grep_search", "read_file", "list_files"],
    capabilities: ["Fast pattern matching", "Regex symbol search", "Read-only navigation"],
    whenToUse: "Locating bugs and symbol definitions.",
    systemPrompt: "You are the SoryOS-Code Explore Agent. Search codebases safely without modifying files.",
  },
  {
    id: "code-reviewer",
    name: "Reviewer & QA Agent",
    role: "Code Reviewer & Quality Assurance",
    description: "Audits code quality, checks security vulnerabilities, and verifies edge cases.",
    badge: "QA & Security",
    icon: "🧪",
    color: "#8b5cf6",
    mode: "subagent",
    tools: ["read_file", "grep_search", "list_files", "shell_command"],
    capabilities: ["Code review", "Security auditing", "Test suite execution"],
    whenToUse: "Reviewing pull requests and running test suites.",
    systemPrompt: "You are the SoryOS-Code Reviewer Agent. Verify code correctness and security.",
  },
];

export function getAgentDefinition(id: string): AgentDefinition {
  return AGENT_MATRIX.find((a) => a.id === id) || AGENT_MATRIX[0];
}

export interface AgentRunOptions {
  session: SessionData;
  userMessage?: string;
  modelId?: string;
  agentId?: string;
  apiKey?: string;
  endpoint?: string;
  maxSteps?: number;
  providerInstance?: ExecutionProvider;
  emit?: (event: any) => void;
  signal?: AbortSignal;
}

export interface AgentRunResult {
  sessionId: string;
  success: boolean;
  stepsExecuted: number;
  toolsExecuted: number;
  finalText: string;
  blocks: MessageBlock[];
  error?: string;
}

export class AgentRuntime {
  public async run(options: AgentRunOptions): Promise<AgentRunResult> {
    const {
      session,
      userMessage,
      modelId = "gemini-2.5-flash",
      agentId = "build",
      apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
      maxSteps = 15,
      emit = () => {},
      signal,
    } = options;

    if (userMessage) {
      session.messages.push({
        id: crypto.randomUUID(),
        role: "user",
        content: userMessage,
        created_at: new Date().toISOString(),
      });
    }

    const agent = getAgentDefinition(agentId);
    session.agent_running = true;

    const assistantMsgId = crypto.randomUUID();
    const blocks: MessageBlock[] = [];
    let fullAssistantText = "";
    let stepsExecuted = 0;
    let toolsExecuted = 0;

    globalEventBus.emit(session.id, "agent.started", {
      model: modelId,
      agent: agent.id,
      agentName: agent.name,
    });

    emit({
      type: "status",
      message: `Initialisation de l'Agent Runtime (${agent.name})...`,
    });

    try {
      const provider = options.providerInstance || (await executionManager.getOrCreateProvider(session.id, session.providerId || "local"));

      // Read AGENTS.md rules if present
      let projectRules = "";
      try {
        projectRules = await provider.readFile("AGENTS.md");
      } catch {
        // none
      }

      const workspacePath = provider.getWorkspacePath();

      const envContext = `
CONTEXTE ET ENVIRONNEMENT DU PROJET :
- Projet : SoryOS-Code
- Session ID : ${session.id}
- Environnement : ${session.environment || "local"}
- Execution Provider : ${session.providerId || "local"}
- Workspace Path : ${workspacePath}
- Modèle IA : ${modelId}
- Rôle Agent : ${agent.name} (${agent.role})
`;

      const systemPrompt = `Tu es SoryOS-Code (${agent.name}), le moteur autonome d'ingénierie logicielle.
${envContext}

PROTOCOLE ET RÈGLES D'AUTONOMIE (Style OpenCode / Codex / Gemini CLI) :

1. COMPRÉHENSION DE L'ENVIRONNEMENT :
   - Le workspace est déjà initialisé dans '${workspacePath}'.
   - Ne demande JAMAIS si l'utilisateur veut cloner le dépôt alors qu'il s'agit du workspace actif du projet.

2. DÉTECTION ET INSPECTION AUTOMATIQUE DU SYSTÈME DE BUILD :
   - Avant toute installation ou compilation, inspecte le workspace (fichiers \`package.json\`, \`bun.lock\`, \`pnpm-lock.yaml\`, \`Cargo.toml\`, \`pyproject.toml\`).
   - Si \`bun.lock\` est présent -> utilise \`bun install\`.
   - Si \`pnpm-lock.yaml\` est présent -> utilise \`pnpm install\`.
   - Si \`Cargo.toml\` est présent -> utilise \`cargo check\` / \`cargo build\`.
   - Si \`package.json\` avec \`npm\` -> utilise \`npm install\`.

3. BOUCLE DE DIAGNOSTIC ET AUTO-CORRECTION (RECOVERY LOOP) :
   - Si une commande ou un outil échoue (exitCode != 0, erreur de type TypeScript, dépendance manquante) :
     ERREUR -> ANALYSE DU MESSAGE -> DIAGNOSTIC -> ACTION CORRECTIVE (ex: installer le package manquant, appliquer un correctif) -> RETRY -> VÉRIFICATION.
   - Ne t'arrête PAS au premier problème et ne demande pas d'abandonner si l'erreur est diagnostiquable et corrigeable.

4. RÈGLE CARDINALE : "NO REAL ACTION, NO SUCCESS"
   - Effectue toujours de vraies actions physiques sur le disque et vérifie les résultats.
   - Pour modifier : \`write_file\`, \`edit_file\` ou \`apply_patch\`.
   - Pour exécuter/tester : \`shell_command\`.
${projectRules ? `\nRÈGLES DU PROJET (AGENTS.md) :\n${projectRules}\n` : ""}
`;

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      const functionDeclarations = toolRegistry.getGeminiDeclarations();
      const contents: any[] = [];

      for (const m of session.messages) {
        if (m.role === "user") {
          contents.push({ role: "user", parts: [{ text: m.content }] });
        } else if (m.role === "assistant") {
          contents.push({ role: "model", parts: [{ text: m.content }] });
        }
      }

      let step = 0;

      while (step < maxSteps) {
        if (signal?.aborted) {
          emit({ type: "status", message: "Exécution arrêtée." });
          break;
        }

        step++;
        stepsExecuted++;
        emit({
          type: "status",
          message: step === 1 ? "Analyse de la demande..." : `Étape ${step} : Évaluation et suite du plan...`,
        });

        let usedModel = modelId;
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
          if (rawMsg.includes("503") || rawMsg.includes("high demand") || rawMsg.includes("UNAVAILABLE")) {
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

        const textPart = response.text || "";
        if (textPart.trim()) {
          fullAssistantText += textPart;
          emit({ type: "text", delta: textPart });
        }

        const functionCalls = response.functionCalls;
        if (!functionCalls || functionCalls.length === 0) {
          break;
        }

        const candidateParts = response.candidates?.[0]?.content?.parts || [];
        contents.push({ role: "model", parts: candidateParts });

        const responseParts: any[] = [];

        for (const call of functionCalls) {
          if (signal?.aborted) break;

          const callId = `call-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const toolName = call.name;
          const toolArgs = (call.args as Record<string, unknown>) || {};

          emit({ type: "status", message: `Exécution de l'outil : ${toolName}...` });
          emit({ type: "tool_start", id: callId, name: toolName, input: toolArgs });

          const toolStep: ToolStep = {
            id: callId,
            name: toolName,
            input: toolArgs,
            status: "running",
            startedAt: new Date().toISOString(),
          };

          const execResult: ToolExecutionResult = await toolExecutor.execute(
            toolName,
            toolArgs,
            provider,
            session,
            agent.id
          );

          toolsExecuted++;
          toolStep.output = execResult.output;
          toolStep.isError = execResult.isError;
          toolStep.status = execResult.isError ? "error" : "done";
          toolStep.completedAt = new Date().toISOString();
          toolStep.metadata = execResult.metadata;

          blocks.push({ type: "tool", step: toolStep });
          emit({ type: "tool_end", id: callId, output: execResult.output, isError: execResult.isError });

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

        contents.push({ role: "user", parts: responseParts });
      }

      if (fullAssistantText) {
        blocks.push({ type: "text", content: fullAssistantText });
      }

      const fileKeys = Object.keys(session.files);
      if (fileKeys.length > 0) {
        session.preview_url = `/api/preview/${session.id}`;
        emit({ type: "files_changed", paths: fileKeys });
        emit({ type: "preview", url: session.preview_url });
      }

      session.messages.push({
        id: assistantMsgId,
        role: "assistant",
        content: fullAssistantText || "Tâche exécutée et vérifiée avec succès.",
        blocks,
        created_at: new Date().toISOString(),
      });

      globalEventBus.emit(session.id, "agent.completed", {
        stepsExecuted,
        toolsExecuted,
        success: true,
      });

      return {
        sessionId: session.id,
        success: true,
        stepsExecuted,
        toolsExecuted,
        finalText: fullAssistantText,
        blocks,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      emit({ type: "error", message: errorMsg });

      session.messages.push({
        id: assistantMsgId,
        role: "assistant",
        content: `Erreur d'exécution de l'agent : ${errorMsg}`,
        blocks: [{ type: "text", content: `⚠️ Erreur : **${errorMsg}**` }],
        created_at: new Date().toISOString(),
      });

      globalEventBus.emit(session.id, "agent.failed", { error: errorMsg });

      return {
        sessionId: session.id,
        success: false,
        stepsExecuted,
        toolsExecuted,
        finalText: "",
        blocks,
        error: errorMsg,
      };
    } finally {
      session.agent_running = false;
    }
  }
}

export const agentRuntime = new AgentRuntime();
