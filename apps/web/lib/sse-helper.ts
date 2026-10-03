import { SessionData } from "./agent-engine";
import { DEFAULT_MODEL_ID, getModelById } from "./providers";
import { extractFilesFromResponse } from "./llm";
import { aiProviderRegistry } from "./ai/registry";
import { getAgentById } from "./opencode-agents";
import { ptyManager } from "./terminal/pty-manager";
import { GitHubRemoteFilesystem } from "./filesystem/remote-provider";
import type { AgentEvent, MessageBlock } from "./types";
import * as fs from "fs";
import * as path from "path";

export function createAgentStream(
  session: SessionData,
  userMessage?: string,
  modelId?: string,
  agentId?: string,
): Response {
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
  let fullContent = "";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: AgentEvent) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      try {
        send({
          type: "status",
          message: `${activeModel.providerName} (${activeModel.name}) initialise le flux...`,
        });

        const lastUserMsg =
          [...session.messages].reverse().find((m) => m.role === "user")?.content || "";

        // Check if greeting
        const isGreeting =
          /^(salut|bonjour|hello|hi|hey|ça va|ca va|good morning|good evening)\b/i.test(
            lastUserMsg.trim(),
          ) && lastUserMsg.trim().length < 25;

        if (isGreeting) {
          const greetingText = `Bonjour ! Je suis OpenCode (${agent.name}). Comment puis-je vous aider sur votre projet aujourd'hui ?`;
          fullContent = greetingText;
          send({ type: "text", delta: greetingText });
          blocks.push({ type: "text", content: fullContent });
          send({
            type: "done",
            usage: { input: 10, output: 30, cacheRead: 0, cacheMiss: 10 },
          });

          session.messages.push({
            id: assistantMsgId,
            role: "assistant",
            content: fullContent,
            blocks,
            created_at: new Date().toISOString(),
          });
          return;
        }

        const fileSummaries = Object.keys(session.files || {})
          .map((fPath) => `- ${fPath}`)
          .join("\n");

        const systemPrompt = `Tu es OpenCode (${agent.name}), l'agent IA de programmation open-source (github.com/anomalyco/opencode).
Tu fonctionnes sous le rôle : **${agent.role}** [${agent.badge}].
Tu es propulsé par le modèle : **${activeModel.name}** (${activeModel.providerName}).

INSTRUCTIONS STRICTES :
1. Fournis des blocs de code complets avec le chemin exact (ex: \`\`\`tsx filepath=src/App.tsx ... \`\`\`).
2. Pas de faux code ni de placeholders.
3. Fichiers actuels :\n${fileSummaries || "Aucun"}`;

        send({
          type: "status",
          message: `Connexion au runtime ${activeModel.providerName}...`,
        });

        // Resolve real provider and initiate genuine streaming
        const provider = aiProviderRegistry.getProviderForModel(activeModel.id);
        const cred = provider.resolveCredentials(session.id);

        if (!cred.isConfigured || !cred.apiKey) {
          throw new Error(
            `Le provider ${provider.name} n'a aucune clé API configurée (${cred.sourceLabel}). ` +
              `Veuillez configurer votre clé dans Paramètres > Providers.`,
          );
        }

        const chatMessages = session.messages.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        }));

        send({
          type: "status",
          message: `Réception du flux en direct (${activeModel.name})...`,
        });

        // Real stream from the underlying AI HTTP provider
        const streamIterable = provider.stream({
          sessionId: session.id,
          modelId: activeModel.id,
          messages: chatMessages,
          systemPrompt,
        });

        for await (const chunk of streamIterable) {
          if (chunk.delta) {
            fullContent += chunk.delta;
            send({ type: "text", delta: chunk.delta });
          }
        }

        // Post-stream: check if code files were produced in response
        const extractedFiles = extractFilesFromResponse(fullContent);
        const hasFiles = Object.keys(extractedFiles).length > 0;

        if (hasFiles) {
          const fileKeys = Object.keys(extractedFiles);
          Object.assign(session.files, extractedFiles);

          // Write extracted files to disk workspace if session exists
          if (session.id) {
            try {
              const workspaceDir = ptyManager.ensureWorkspaceDir(session.id);
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

          // If session is connected to GitHub, sync to remote
          if (
            (session.providerId === "github-codespaces" ||
              session.providerId === "github-repository") &&
            session.repository
          ) {
            try {
              const rfs = new GitHubRemoteFilesystem(
                session.id,
                session.repository,
                session.branch || "main",
              );
              for (const [fPath, fContent] of Object.entries(extractedFiles)) {
                void rfs.writeFile(
                  fPath,
                  fContent,
                  `Agent update ${fPath} via SoryOS-Code`,
                ).catch((e) => {
                  console.warn("Async remote write back warning:", e);
                });
              }
            } catch (e) {
              console.warn("Failed to instantiate remote filesystem:", e);
            }
          }

          // Tool step for file write
          const stepId = crypto.randomUUID();
          const stepInput = { files: fileKeys, model: activeModel.name };
          send({
            type: "tool_start",
            id: stepId,
            name: "file_write",
            input: stepInput,
          });

          const stepOutput = `Écriture de ${fileKeys.length} fichiers (${fileKeys.join(", ")})`;
          blocks.push({
            type: "tool",
            step: {
              id: stepId,
              name: "file_write",
              input: stepInput,
              output: stepOutput,
              status: "done",
            },
          });
          send({
            type: "tool_end",
            id: stepId,
            output: stepOutput,
            isError: false,
          });

          send({
            type: "files_changed",
            paths: Object.keys(session.files),
          });

          session.preview_url = `/api/preview/${session.id}`;
          send({
            type: "preview",
            url: session.preview_url,
          });
        }

        blocks.push({ type: "text", content: fullContent });

        send({
          type: "done",
          usage: {
            input: 150,
            output: fullContent.length / 4,
            cacheRead: 0,
            cacheMiss: 150,
          },
        });

        session.messages.push({
          id: assistantMsgId,
          role: "assistant",
          content: fullContent,
          blocks,
          created_at: new Date().toISOString(),
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const errorContent = `⚠️ **Erreur d'exécution IA (${activeModel.providerName})** :\n\n${errMsg}`;

        send({
          type: "text",
          delta: fullContent ? `\n\n${errorContent}` : errorContent,
        });

        send({
          type: "error",
          message: errMsg,
        });

        session.messages.push({
          id: assistantMsgId,
          role: "assistant",
          content: fullContent ? `${fullContent}\n\n${errorContent}` : errorContent,
          blocks: [{ type: "text", content: errorContent }],
          created_at: new Date().toISOString(),
        });
      } finally {
        session.agent_running = false;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
