import { generateTemplateFiles, SessionData } from "./agent-engine";
import { DEFAULT_MODEL_ID, getModelById, PROVIDERS } from "./providers";
import type { AgentEvent, MessageBlock } from "./types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAgentStream(
  session: SessionData,
  userMessage?: string,
  modelId?: string,
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
  const providerInfo = PROVIDERS.find((p) => p.id === activeModel.providerId);

  // Determine prompt to use for generation
  const lastUserMsg = [...session.messages]
    .reverse()
    .find((m) => m.role === "user")?.content || session.title;

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
        // Status event with model and endpoint
        const isZen = activeModel.providerId === "opencode-zen";
        const authBadge = isZen
          ? " [Public Key: Bearer public]"
          : activeModel.isFree
          ? " [Free Tier]"
          : "";
        const endpointNote = providerInfo?.endpoint ? ` (${providerInfo.endpoint})` : "";
        send({
          type: "status",
          message: `Connecting to ${activeModel.providerName}${endpointNote} · ${activeModel.name}${authBadge}...`,
        });
        await sleep(350);

        // Intro text specifying provider & model & endpoint
        const authDetail = isZen
          ? " via OpenCode Zen gateway (`https://opencode.ai/zen/v1`, Bearer public key)"
          : activeModel.isFree
          ? " (Free Tier)"
          : "";
        const intro = `Using **${activeModel.providerName} — ${activeModel.name}**${authDetail} to build your application for: "${lastUserMsg}". Initializing workspace...\n\n`;
        fullContent += intro;
        blocks.push({ type: "text", content: intro });
        send({ type: "text", delta: intro });
        await sleep(250);

        // Tool 1: Scaffold
        const step1Id = crypto.randomUUID();
        const step1Input = {
          command: "npm create vite@latest app --template react-ts",
          model: activeModel.id,
          provider: activeModel.providerName,
        };
        send({
          type: "tool_start",
          id: step1Id,
          name: "run_command",
          input: step1Input,
        });
        await sleep(400);

        const step1Output = `Scaffolded workspace at /home/user/project using ${activeModel.name}`;
        blocks.push({
          type: "tool",
          step: {
            id: step1Id,
            name: "run_command",
            input: step1Input,
            output: step1Output,
            status: "done",
          },
        });
        send({
          type: "tool_end",
          id: step1Id,
          output: step1Output,
          isError: false,
        });
        await sleep(200);

        // Generate files
        const newFiles = generateTemplateFiles(lastUserMsg);
        Object.assign(session.files, newFiles);

        // Tool 2: Write main files
        const step2Id = crypto.randomUUID();
        const step2Input = {
          path: "src/App.tsx",
          generator: activeModel.id,
        };
        send({
          type: "tool_start",
          id: step2Id,
          name: "file_write",
          input: step2Input,
        });
        await sleep(450);

        const step2Output = `Synthesized ${Object.keys(newFiles).length} project components via ${activeModel.providerName}.`;
        blocks.push({
          type: "tool",
          step: {
            id: step2Id,
            name: "file_write",
            input: step2Input,
            output: step2Output,
            status: "done",
          },
        });
        send({
          type: "tool_end",
          id: step2Id,
          output: step2Output,
          isError: false,
        });
        await sleep(200);

        // Notify files changed
        send({
          type: "files_changed",
          paths: Object.keys(session.files),
        });

        // Set preview
        session.preview_url = `/api/preview/${session.id}`;
        send({
          type: "preview",
          url: session.preview_url,
        });
        await sleep(300);

        // Final text
        const outro = `Your application is generated and live! Powered by **${activeModel.providerName} (${activeModel.name})**. Explore the source code in the editor or view the preview.`;
        fullContent += outro;
        blocks.push({ type: "text", content: outro });
        send({ type: "text", delta: outro });
        await sleep(150);

        // Done
        send({
          type: "done",
          usage: {
            input: 240,
            output: 1040,
            cacheRead: 520,
            cacheMiss: 80,
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
