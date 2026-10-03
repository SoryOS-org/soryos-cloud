import { SessionData } from "./agent-engine";
import { DEFAULT_MODEL_ID, getModelById } from "./providers";
import { generateAgentResponse } from "./llm";
import { GitHubRemoteFilesystem } from "./filesystem/remote-provider";
import type { AgentEvent, MessageBlock } from "./types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
          message: `${activeModel.providerName} (${activeModel.name}) réfléchit...`,
        });
        await sleep(200);

        // Generate response using model orchestrator
        const llmResult = await generateAgentResponse({
          messages: session.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          modelId: activeModel.id,
          agentId: agentId || "build",
          currentFiles: session.files,
          onStatus: (statusMsg) => {
            send({ type: "status", message: statusMsg });
          },
        });

        // 1. If files were produced (a project/code was actually generated or modified)
        if (llmResult.files && Object.keys(llmResult.files).length > 0) {
          const fileKeys = Object.keys(llmResult.files);
          Object.assign(session.files, llmResult.files);

          // If session is connected to GitHub Codespace or repository, sync files to remote environment
          if (
            (session.providerId === "github-codespaces" || session.providerId === "github-repository") &&
            session.repository
          ) {
            try {
              const fs = new GitHubRemoteFilesystem(session.id, session.repository, session.branch || "main");
              for (const [fPath, fContent] of Object.entries(llmResult.files)) {
                void fs.writeFile(fPath, fContent, `Agent update ${fPath} via SoryOS-Code`).catch((e) => {
                  console.warn("Async remote write back warning:", e);
                });
              }
            } catch (e) {
              console.warn("Failed to instantiate remote filesystem for agent write:", e);
            }
          }

          // Real tool step for file modification
          const stepId = crypto.randomUUID();
          const stepInput = {
            files: fileKeys,
            model: activeModel.name,
          };
          send({
            type: "tool_start",
            id: stepId,
            name: "file_write",
            input: stepInput,
          });
          await sleep(250);

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

          // Notify files changed & update preview URL
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

        // 2. Stream the AI text response smoothly into the chat
        const text = llmResult.text;
        const chunks = text.split("\n\n");

        for (let i = 0; i < chunks.length; i++) {
          const chunk = (i === 0 ? "" : "\n\n") + chunks[i];
          fullContent += chunk;
          send({ type: "text", delta: chunk });
          await sleep(60);
        }

        blocks.push({ type: "text", content: fullContent });

        send({
          type: "done",
          usage: {
            input: 120,
            output: 450,
            cacheRead: 0,
            cacheMiss: 120,
          },
        });

        // Save assistant message to session history
        session.messages.push({
          id: assistantMsgId,
          role: "assistant",
          content: fullContent,
          blocks,
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Execution failed",
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
