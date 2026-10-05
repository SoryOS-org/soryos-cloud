/**
 * Unified types re-exported from official @soryos/schema
 */

export * from "@soryos/schema";

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool_start"; id: string; name: string; input: unknown }
  | { type: "tool_end"; id: string; output: string; isError: boolean }
  | { type: "preview"; url: string }
  | { type: "files_changed"; paths: string[] }
  | { type: "status"; message: string }
  | { type: "done"; usage: { input: number; output: number; cacheRead: number; cacheMiss: number } }
  | { type: "error"; message: string };

export interface GitHubSessionContext {
  username?: string;
  avatarUrl?: string;
  connected: boolean;
  repository?: string;
  branch?: string;
  codespaceId?: string;
  codespaceState?: "Running" | "Stopped" | "Building" | "Failed";
}

export interface GetSessionResponse {
  id: string;
  title: string;
  sandbox_id: string | null;
  sandbox_state: "running" | "paused" | "dead";
  environment?: "sandbox" | "local";
  providerId?: string;
  model?: string;
  provider?: string;
  github?: GitHubSessionContext;
  repository?: string;
  branch?: string;
  codespaceId?: string;
  workspaceState?: "NO_WORKSPACE" | "WORKSPACE_LOADING" | "WORKSPACE_READY" | "WORKSPACE_ERROR" | string;
  workspaceError?: string;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    blocks?: import("@soryos/schema").MessageBlock[];
    created_at: string;
  }>;
  preview_url: string | null;
  needs_run: boolean;
  agent_running: boolean;
}
