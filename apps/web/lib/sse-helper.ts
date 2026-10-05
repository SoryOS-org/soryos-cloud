import { SessionData } from "./agent-engine";
import { runAgentLoop } from "./agent/agent-loop";
import type { AgentEvent } from "./types";

export function createAgentStream(
  session: SessionData,
  userMessage?: string,
  modelId?: string,
  agentId?: string,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: AgentEvent) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream might be closed by client
        }
      }

      try {
        await runAgentLoop({
          session,
          userMessage,
          modelId,
          agentId,
          emit: send,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: "error", message: msg });
      } finally {
        try {
          controller.close();
        } catch {
          // ignore
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
