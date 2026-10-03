import { GoogleGenAI } from "@google/genai";
import { getModelById } from "./providers";
import { getAgentById } from "./opencode-agents";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GenerateResult {
  text: string;
  source: "gemini" | "opencode-zen" | "fallback";
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
  // e.g. `### src/App.tsx`, `**main.py**`, `// src/App.tsx`, `# main.py`
  const blockRegex = /(?:(?:^|\n)(?:#{1,4}\s+|[\*\*_]{2}|`+)?([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)(?:[\*\*_]{2}|`+)?(?:\s*[:\-]\s*)?\n+)?```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  while ((match = blockRegex.exec(markdown)) !== null) {
    const headerPath = match[1];
    const lang = (match[2] || "").toLowerCase().trim();
    const code = match[3] ? match[3].trim() : "";
    if (!code || code.length < 15) continue;

    // First line comment check
    const firstLine = code.split("\n")[0].trim();
    const commentMatch = firstLine.match(/^(?:\/\/|#|\/\*)\s*([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/);

    let detectedPath = headerPath;
    if (!detectedPath && commentMatch && commentMatch[1].includes(".")) {
      detectedPath = commentMatch[1];
    }

    // Heuristic inference based on language tag and code structure
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

  // If a React App.tsx exists, ensure supporting workspace files exist
  if (files["src/App.tsx"]) {
    if (!files["package.json"]) {
      files["package.json"] = JSON.stringify(
        {
          name: "codeforge-app",
          private: true,
          version: "0.0.0",
          type: "module",
          scripts: { dev: "vite", build: "tsc && vite build", preview: "vite preview" },
          dependencies: {
            react: "^19.0.0",
            "react-dom": "^19.0.0",
            "lucide-react": "^0.460.0",
            "canvas-confetti": "^1.9.4",
          },
          devDependencies: {
            "@types/react": "^19.0.0",
            "@types/react-dom": "^19.0.0",
            "@vitejs/plugin-react": "^4.3.4",
            typescript: "^5.6.3",
            vite: "^6.0.0",
          },
        },
        null,
        2,
      );
    }
    if (!files["src/index.css"]) {
      files["src/index.css"] = `@import "tailwindcss";\n\nbody {\n  margin: 0;\n  font-family: system-ui, -apple-system, sans-serif;\n}`;
    }
  }

  return files;
}

/**
 * Calls real server-side Gemini LLM using resilient model progression
 */
async function callGemini(
  messages: ChatMessage[],
  systemPrompt: string,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "TODO" || apiKey.includes("your-") || apiKey.trim() === "") {
    return null;
  }

  const candidateModels = [
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-flash-latest",
    "gemini-3.8-flash",
  ];

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
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
      console.warn(`Model ${modelName} call skipped: ${msg.slice(0, 100)}... Retrying next model.`);
    }
  }

  return null;
}

/**
 * Real AI generation engine for CodeForge
 * Every prompt is sent to the LLM. Code is automatically extracted into editor files.
 */
export async function generateAgentResponse(params: {
  messages: ChatMessage[];
  modelId: string;
  agentId?: string;
  currentFiles: Record<string, string>;
  onStatus?: (status: string) => void;
}): Promise<GenerateResult> {
  const { messages, modelId, agentId = "build", currentFiles, onStatus } = params;
  const model = getModelById(modelId);
  const agent = getAgentById(agentId);
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";

  const fileSummaries = Object.keys(currentFiles)
    .map((path) => `- ${path}`)
    .join("\n");

  const systemPrompt = `Tu es OpenCode (${agent.name}), l'agent IA de programmation open-source (github.com/anomalyco/opencode).
Tu fonctionnes actuellement sous le rôle spécialisé : **${agent.role}** [${agent.badge}].
Tu es propulsé par le modèle : **${model.name}** (${model.providerName}).

INSTRUCTIONS SPÉCIALISÉES DE L'AGENT OPENCODE (${agent.name}) :
${agent.systemPrompt}

CAPACITÉS & OUTILS DE L'AGENT :
${agent.tools.map((t) => `- Outil : ${t}`).join("\n")}

IMPORTANT : Dans cet environnement de type "OpenCode", **N'affiche JAMAIS de grands blocs de code source complets** dans le texte de ta réponse dans le chat.
Les modifications de code doivent être exécutées via les outils de modification de fichiers (\`write_file\`, \`edit_file\`), qui s'affichent proprement dans les cartes de tools.

Règles de communication et de réponse dans le chat (Style OpenCode) :
1. **PAS de duplication de code dans le texte du chat** : N'écris pas tout le contenu des fichiers en markdown dans le chat.
2. **Explication fichier par fichier** : Dans ton message textuel de réponse, fournis un résumé professionnel et structuré expliquant précisément ce que tu as modifié ou implémenté **fichier par fichier** (ex: \`src/App.tsx\`, \`src/components/Navbar.tsx\`, etc.).
3. Pour les applications web interactives :
   - Fichier principal : \`src/App.tsx\` (React 19 + TypeScript + Tailwind CSS).
   - Fichiers actuels du projet :
${fileSummaries || "Aucun (Nouveau projet)"}
   - Assure-toi que les composants React sont complets, interactifs, beaux et stylisés avec Tailwind CSS.
4. Si l'agent actif est 'plan', produis des plans clairs, structurés et détaillés avec des listes de tâches précises.
5. Si l'agent actif est 'explore', analyse et explique l'arborescence et le code.`;

  onStatus?.(`[${agent.name}] Réflexion avec ${model.name} (${model.providerName})...`);

  // Call the real AI model
  const realAiResponse = await callGemini(messages, systemPrompt);

  if (realAiResponse) {
    const extractedFiles = extractFilesFromResponse(realAiResponse);
    const hasFiles = Object.keys(extractedFiles).length > 0;

    return {
      text: realAiResponse,
      source: "gemini",
      files: hasFiles ? extractedFiles : undefined,
      isConversational: !hasFiles,
    };
  }

  // Fallback if network issue occurs
  return {
    text: `Bonjour, je suis **${model.name}** (${model.providerName}). J'ai bien pris en compte votre demande : *« ${lastUserMsg} »*. Le service IA distant rencontre une indisponibilité momentanée. Veuillez réessayer dans quelques instants.`,
    source: "fallback",
    isConversational: true,
  };
}
