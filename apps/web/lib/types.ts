export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool_start"; id: string; name: string; input: unknown }
  | { type: "tool_end"; id: string; output: string; isError: boolean }
  | { type: "preview"; url: string }
  | { type: "files_changed"; paths: string[] }
  | { type: "status"; message: string }
  | { type: "done"; usage: { input: number; output: number; cacheRead: number; cacheMiss: number } }
  | { type: "error"; message: string };

export interface GetSessionResponse {
  id: string;
  title: string;
  sandbox_id: string | null;
  sandbox_state: "running" | "paused" | "dead";
  model?: string;
  provider?: string;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    blocks?: MessageBlock[];
    created_at: string;
  }>;
  preview_url: string | null;
  needs_run: boolean;
  agent_running: boolean;
}

export interface ToolStep {
  id: string;
  name: string;
  input: unknown;
  output?: string;
  isError?: boolean;
  status: "running" | "done" | "error";
}

/** Ordered segments inside one assistant turn — text and tools interleaved. */
export type MessageBlock =
  | { type: "text"; content: string }
  | { type: "tool"; step: ToolStep };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocks?: MessageBlock[];
}
