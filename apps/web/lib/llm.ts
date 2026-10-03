import { getModelById } from "./providers";
import { getAgentById } from "./opencode-agents";
import { aiProviderRegistry } from "./ai/registry";
import { ptyManager } from "./terminal/pty-manager";
import * as fs from "fs";
import * as path from "path";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AgentGenerateResult {
  text: string;
  source: string;
  files?: Record<string, string>;
  isConversational?: boolean;
  latencyMs?: number;
  error?: string;
  httpStatus?: number;
}

/**
 * Multi-strategy file extractor from AI markdown responses.
 */
export function extractFilesFromResponse(markdown: string): Record<string, string> {
  const files: Record<string, string> = {};

  // 1. Explicit filepath in code block header:
  // ```tsx filepath=src/App.tsx or ```python file="main.py"
  const explicitRegex =
    /```(?:[a-zA-Z0-9_-]+)?(?:\s+(?:filepath|file|path)=["']?([^"'\s\n]+)["']?)?\n([\s\S]*?)```/g;
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
  const blockRegex =
    /(?:(?:^|\n)(?:#{1,4}\s+|[\*\*_]{2}|`+)?([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)(?:[\*\*_]{2}|`+)?(?:\s*[:\-]\s*)?\n+)?```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  while ((match = blockRegex.exec(markdown)) !== null) {
    const headerPath = match[1];
    const lang = (match[2] || "").toLowerCase().trim();
    const code = match[3] ? match[3].trim() : "";
    if (!code || code.length < 15) continue;

    const firstLine = code.split("\n")[0].trim();
    const commentMatch = firstLine.match(
      /^(?:\/\/|#|\/\*)\s*([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/,
    );

    let detectedPath = headerPath;
    if (!detectedPath && commentMatch && commentMatch[1].includes(".")) {
      detectedPath = commentMatch[1];
    }

    if (!detectedPath) {
      if (
        lang === "python" ||
        lang === "py" ||
        (code.includes("import ") && code.includes("def "))
      ) {
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
      } else if (
        lang === "html" ||
        code.includes("<!DOCTYPE") ||
        code.includes("<html")
      ) {
        detectedPath = "index.html";
      } else if (
        lang === "json" &&
        (code.includes('"dependencies"') || code.includes('"name"'))
      ) {
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
 * Real AI generation engine for SoryOS-Code Agent.
 * Connects directly through AIProviderRegistry to the selected provider runtime.
 * NO FAKE ACTIONS. NO HARDCODED RESPONSES. PROMPT & ERROR INTEGRITY PRESERVED.
 */
export async function generateAgentResponse(params: {
  sessionId?: string;
  messages: ChatMessage[];
  modelId: string;
  agentId?: string;
  currentFiles: Record<string, string>;
  onStatus?: (status: string) => void;
}): Promise<AgentGenerateResult> {
  const { sessionId, messages, modelId, agentId = "build", currentFiles, onStatus } = params;
  const model = getModelById(modelId);
  const agent = getAgentById(agentId);
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";

  // Greetings check: if user just says "bonjour", don't generate code files
  const isGreeting =
    /^(salut|bonjour|hello|hi|hey|ça va|ca va|good morning|good evening)\b/i.test(
      lastUserMsg.trim(),
    ) && lastUserMsg.trim().length < 25;

  if (isGreeting) {
    return {
      text: `Bonjour ! Je suis OpenCode (${agent.name}). Comment puis-je vous aider sur votre projet aujourd'hui ?`,
      source: "opencode",
      isConversational: true,
    };
  }

  const fileSummaries = Object.keys(currentFiles)
    .map((filePath) => `- ${filePath}`)
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

  const provider = aiProviderRegistry.getProviderForModel(model.id);

  try {
    const result = await provider.generate({
      sessionId,
      modelId: model.id,
      messages,
      systemPrompt,
    });

    const rawResponse = result.text;
    const extractedFiles = extractFilesFromResponse(rawResponse);
    const hasFiles = Object.keys(extractedFiles).length > 0;

    // If files were extracted and sessionId is provided, write them to disk workspace
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
      source: provider.id,
      files: hasFiles ? extractedFiles : undefined,
      isConversational: !hasFiles,
      latencyMs: result.latencyMs,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const httpStatus = (err as { statusCode?: number })?.statusCode;

    console.error(`AI Provider (${provider.name} - ${model.name}) execution error:`, errMsg);

    return {
      text: `⚠️ **Erreur Provider IA (${provider.name} / ${model.name})**\n\n` +
        `**Statut HTTP :** ${httpStatus ? httpStatus : "Erreur Réseau / Configuration"}\n\n` +
        `**Détails de l'erreur :**\n\`\`\`\n${errMsg}\n\`\`\`\n\n` +
        `Veuillez vérifier vos identifiants dans **Project → Settings → Providers** ou changer de modèle. Aucun fichier n'a été altéré.`,
      source: "error",
      isConversational: true,
      error: errMsg,
      httpStatus,
    };
  }
}
