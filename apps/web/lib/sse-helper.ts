import { generateTemplateFiles, SessionData } from "./agent-engine";
import type { AgentEvent, MessageBlock } from "./types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAgentStream(
  session: SessionData,
  userMessage?: string,
): Response {
  if (userMessage) {
    session.messages.push({
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
    });
  }

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
        // Status event
        send({ type: "status", message: "Analyzing architecture and workspace..." });
        await sleep(300);

        // Intro text
        const intro = `I'll build the project based on your requirements: "${lastUserMsg}". Setting up structure and creating components...\n\n`;
        fullContent += intro;
        blocks.push({ type: "text", content: intro });
        send({ type: "text", delta: intro });
        await sleep(250);

        // Tool 1: Scaffold
        const step1Id = crypto.randomUUID();
        const step1Input = { command: "npm create vite@latest app --template react-ts" };
        send({
          type: "tool_start",
          id: step1Id,
          name: "run_command",
          input: step1Input,
        });
        await sleep(400);

        const step1Output = "Created project workspace in /home/user/project";
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

        // Tool 2: Write main file
        const step2Id = crypto.randomUUID();
        const step2Input = { path: "src/App.tsx" };
        send({
          type: "tool_start",
          id: step2Id,
          name: "file_write",
          input: step2Input,
        });
        await sleep(450);

        const step2Output = `Wrote component files to project workspace (${Object.keys(newFiles).length} files).`;
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
        const outro = `Application is compiled and running! You can inspect the source code in the editor or interact with the live demo in the preview tab.`;
        fullContent += outro;
        blocks.push({ type: "text", content: outro });
        send({ type: "text", delta: outro });
        await sleep(150);

        // Done
        send({
          type: "done",
          usage: {
            input: 180,
            output: 920,
            cacheRead: 450,
            cacheMiss: 60,
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
