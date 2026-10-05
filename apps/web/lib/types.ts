/**
 * @codeforge/web
 * Types spécifiques pour l'application web.
 * 
 * Ce fichier contient UNIQUEMENT des types pour l'UI.
 * Tous les types métier doivent être dans @soryos/schema.
 */

// Réexporter les types de base depuis @soryos/schema
export * from "@soryos/schema";

// Types spécifiques à l'application web
import type { MessageBlock, ToolStep } from "@soryos/schema";

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool_start"; id: string; name: string; input: unknown }
  | { type: "tool_end"; id: string; output: string; isError: boolean }
  | { type: "preview"; url: string }
  | { type: "files_changed"; paths: string[] }
  | { type: "status"; message: string }
  | { type: "done"; usage?: { input: number; output: number; cacheRead: number; cacheMiss: number } }
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
    blocks?: MessageBlock[];
    created_at: string;
  }>;
  preview_url: string | null;
  needs_run: boolean;
  agent_running: boolean;
}

// Types pour l'UI
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocks?: MessageBlock[];
  created_at?: string;
}

// Types pour les composants UI
export type EnvironmentType = "sandbox" | "local";
export type ProviderId = "e2b" | "vercel" | "google-cloud-run" | "github-codespaces" | "github-repository" | "local";
