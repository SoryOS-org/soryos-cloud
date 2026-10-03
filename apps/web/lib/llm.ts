import { GoogleGenAI } from "@google/genai";
import { getModelById } from "./providers";
import { getAgentById } from "./opencode-agents";
import { credentialManager } from "./credentials/manager";
import { ptyManager } from "./terminal/pty-manager";
import * as fs from "fs";
import * as path from "path";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GenerateResult {
  text: string;
  source: "gemini" | "openrouter" | "deepseek" | "mistral" | "grok" | "opencode-zen" | "fallback";
  files?: Record<string, string>;
  isConversational?: boolean;
}

/**
 * Robust multi-strategy file extractor from AI markdown responses.
 * Captures explicit filepaths, header comments, and content-inferred scripts (Python, React TSX, CSS, HTML).
 */
export function extractFilesFromResponse(markdown: string): Record<string, string> {
  const files: Record<string, string> = {};

  // 1. Explicit filepath in code block header:
  // ```tsx filepath=src/App.tsx or ```python file="main.py"
  const explicitRegex = /```(?:[a-zA-Z0-9_-]+)?(?:\s+(?:filepath|file|path)=["']?([^"'\s\n]+)["']?)?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = explicitRegex.exec(markdown)) !== null) {
    const filePath = match[1];
    const code = match[2];
    if (filePath && code && code.trim().length > 0) {
      const cleanPath = filePath.trim().replace(/^["']|["']$/g, "").replace(/^\//, "");
      files[cleanPath] = code.trim();
    }
  }

  // 2. Preceding markdown heading or comment before code block:
  const blockRegex = /(?:(?:^|\n)(?:#{1,4}\s+|[\*\*_]{2}|`+)?([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)(?:[\*\*_]{2}|`+)?(?:\s*[:\-]\s*)?\n+)?```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  while ((match = blockRegex.exec(markdown)) !== null) {
    const headerPath = match[1];
    const lang = (match[2] || "").toLowerCase().trim();
    const code = match[3] ? match[3].trim() : "";
    if (!code || code.length < 15) continue;

    const firstLine = code.split("\n")[0].trim();
    const commentMatch = firstLine.match(/^(?:\/\/|#|\/\*)\s*([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/);

    let detectedPath = headerPath;
    if (!detectedPath && commentMatch && commentMatch[1].includes(".")) {
      detectedPath = commentMatch[1];
    }

    if (!detectedPath) {
      if (lang === "python" || lang === "py" || (code.includes("import ") && code.includes("def "))) {
        detectedPath = "main.py";
      } else if (
        lang === "tsx" ||
        lang === "jsx" ||
        code.includes("export default") ||
        code.includes("return (") ||
        code.includes("React.") ||
        code.includes("useState")
      ) {
        detectedPath = "src/App.tsx";
      } else if (lang === "css" || code.includes("@tailwind")) {
        detectedPath = "src/index.css";
      } else if (lang === "html" || code.includes("<!DOCTYPE") || code.includes("<html")) {
        detectedPath = "index.html";
      } else if (lang === "json" && (code.includes('"dependencies"') || code.includes('"name"'))) {
        detectedPath = "package.json";
      }
    }

    if (detectedPath) {
      const clean = detectedPath.trim().replace(/^["'`]|["'`]$/g, "").replace(/^\//, "");
      if (!files[clean]) {
        files[clean] = code;
      }
    }
  }

  return files;
}

/**
 * Call Google Gemini LLM using standard models and credentials
 */
async function callGemini(
  messages: ChatMessage[],
  systemPrompt: string,
): Promise<string | null> {
  const customKey = credentialManager.getCredentials("google")?.apiKey;
  const apiKey = customKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  const candidateModels = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ];

  try {
    const ai = apiKey
      ? new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { "User-Agent": "aistudio-build" } },
        })
      : new GoogleGenAI({
          httpOptions: { headers: { "User-Agent": "aistudio-build" } },
        });

    const conversationHistory = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");
    const fullPrompt = `${systemPrompt}\n\nHistorique de la conversation :\n${conversationHistory}`;

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: fullPrompt,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });

        if (response && response.text && response.text.trim().length > 0) {
          return response.text;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`Gemini (${modelName}) warning: ${msg.slice(0, 100)}`);
      }
    }
  } catch (e) {
    console.warn("Gemini client initialization warning:", e);
  }

  return null;
}

/**
 * Call standard OpenAI-compatible API (OpenRouter, DeepSeek, Mistral, xAI, Zen)
 */
async function callOpenAICompatible(
  endpoint: string,
  apiKey: string | undefined,
  modelId: string,
  messages: ChatMessage[],
  systemPrompt: string,
  extraHeaders?: Record<string, string>,
): Promise<string | null> {
  try {
    const authHeader = apiKey ? `Bearer ${apiKey}` : "Bearer public";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        "HTTP-Referer": "https://opencode.ai",
        "X-Title": "SoryOS-Code",
        ...(extraHeaders || {}),
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`OpenAI compatible endpoint (${endpoint}) returned ${res.status}: ${errText.slice(0, 120)}`);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim().length > 0) {
      return content.trim();
    }
  } catch (err) {
    console.warn(`Error calling ${endpoint}:`, err);
  }

  return null;
}

/**
 * Real AI generation engine for SoryOS-Code
 * NO FAKE ACTIONS. If provider is unavailable, returns explicit error.
 * If user sends conversational message ("Salut"), returns conversational response with NO file changes.
 */
export async function generateAgentResponse(params: {
  sessionId?: string;
  messages: ChatMessage[];
  modelId: string;
  agentId?: string;
  currentFiles: Record<string, string>;
  onStatus?: (status: string) => void;
}): Promise<GenerateResult> {
  const { sessionId, messages, modelId, agentId = "build", currentFiles, onStatus } = params;
  const model = getModelById(modelId);
  const agent = getAgentById(agentId);
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";

  // Check if user input is purely conversational / greeting
  const isGreeting =
    /^(salut|bonjour|hello|hi|hey|ça va|ca va|good morning|good evening)\b/i.test(lastUserMsg.trim()) &&
    lastUserMsg.trim().length < 25;

  if (isGreeting) {
    return {
      text: `Bonjour ! Je suis OpenCode (${agent.name}). Comment puis-je vous aider sur votre projet aujourd'hui ?`,
      source: "gemini",
      isConversational: true,
    };
  }

  const fileSummaries = Object.keys(currentFiles)
    .map((path) => `- ${path}`)
    .join("\n");

  const systemPrompt = `Tu es OpenCode (${agent.name}), l'agent IA de programmation open-source (github.com/anomalyco/opencode).
Tu fonctionnes actuellement sous le rôle spécialisé : **${agent.role}** [${agent.badge}].
Tu es propulsé par le modèle : **${model.name}** (${model.providerName}).

INSTRUCTIONS STRICTES DE L'AGENT :
1. **PAS D'ACTION FICTIVE** : Ne prétends jamais avoir écrit ou modifié des fichiers à moins de fournir de vrais blocs de code avec leur chemin exact (ex: \`\`\`tsx filepath=src/App.tsx ... \`\`\`).
2. Si l'utilisateur demande une simple discussion, réponds simplement en mode conversationnel sans modifier aucun fichier.
3. Si l'utilisateur demande du code, fournis les blocs de code complets avec le chemin exact.
4. Fichiers actuels du projet :\n${fileSummaries || "Aucun (Nouveau projet)"}`;

  onStatus?.(`[${agent.name}] Consultation de ${model.name} (${model.providerName})...`);

  let rawResponse: string | null = null;
  let responseSource: GenerateResult["source"] = "gemini";

  // 1. Google Gemini Provider
  if (model.providerId === "google" || model.id.startsWith("gemini")) {
    rawResponse = await callGemini(messages, systemPrompt);
    responseSource = "gemini";
  }

  // 2. OpenRouter Provider
  if (!rawResponse && (model.providerId === "openrouter" || model.id.includes(":free"))) {
    const customKey = credentialManager.getCredentials("openrouter")?.apiKey || process.env.OPENROUTER_API_KEY;
    rawResponse = await callOpenAICompatible(
      "https://openrouter.ai/api/v1/chat/completions",
      customKey,
      model.id,
      messages,
      systemPrompt,
    );
    responseSource = "openrouter";
  }

  // 3. DeepSeek Provider
  if (!rawResponse && model.providerId === "deepseek") {
    const customKey = credentialManager.getCredentials("deepseek")?.apiKey || process.env.DEEPSEEK_API_KEY;
    rawResponse = await callOpenAICompatible(
      "https://api.deepseek.com/v1/chat/completions",
      customKey,
      model.id,
      messages,
      systemPrompt,
    );
    responseSource = "deepseek";
  }

  // 4. Mistral Provider
  if (!rawResponse && model.providerId === "mistral") {
    const customKey = credentialManager.getCredentials("mistral")?.apiKey || process.env.MISTRAL_API_KEY;
    rawResponse = await callOpenAICompatible(
      "https://api.mistral.ai/v1/chat/completions",
      customKey,
      model.id,
      messages,
      systemPrompt,
    );
    responseSource = "mistral";
  }

  // 5. xAI Grok Provider
  if (!rawResponse && model.providerId === "grok") {
    const customKey = credentialManager.getCredentials("grok")?.apiKey || process.env.GROK_API_KEY || process.env.XAI_API_KEY;
    rawResponse = await callOpenAICompatible(
      "https://api.x.ai/v1/chat/completions",
      customKey,
      model.id,
      messages,
      systemPrompt,
    );
    responseSource = "grok";
  }

  // 6. Fallback to Gemini
  if (!rawResponse) {
    rawResponse = await callGemini(messages, systemPrompt);
    responseSource = "gemini";
  }

  // If ALL AI providers failed or are unavailable, return explicit error (NO FAKE FALLBACK)
  if (!rawResponse) {
    return {
      text: `⚠️ **AI Provider Unavailable**\n\nLe fournisseur IA (${model.providerName} / ${model.name}) n'a retourné aucune réponse ou est actuellement indisponible.\n\nVeuillez vérifier votre clé API dans les **Paramètres** ou réessayer ultérieurement. Aucun fichier n'a été modifié.`,
      source: "fallback",
      isConversational: true,
    };
  }

  // Extract files from response
  const extractedFiles = extractFilesFromResponse(rawResponse);
  const hasFiles = Object.keys(extractedFiles).length > 0;

  // If files were extracted and sessionId is provided, write them to disk and verify existence
  if (hasFiles && sessionId) {
    try {
      const workspaceDir = ptyManager.ensureWorkspaceDir(sessionId);
      for (const [filePath, content] of Object.entries(extractedFiles)) {
        const fullPath = path.join(workspaceDir, filePath);
        const parentDir = path.dirname(fullPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(fullPath, content, "utf-8");
      }
    } catch (e) {
      console.warn("Failed to write extracted files to disk workspace:", e);
    }
  }

  return {
    text: rawResponse,
    source: responseSource,
    files: hasFiles ? extractedFiles : undefined,
    isConversational: !hasFiles,
  };
}
