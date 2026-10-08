/**
 * @soryos/session
 * Session lifecycle, persistence, message history, and state management.
 */

import { SessionData, ChatMessage } from "@soryos/schema";
import { workspaceManager } from "@soryos/workspace";
import { globalEventBus } from "@soryos/bus";

declare global {
  var __soryos_sessions: Map<string, SessionData> | undefined;
}

const sessionsStore: Map<string, SessionData> =
  globalThis.__soryos_sessions ?? new Map();
globalThis.__soryos_sessions = sessionsStore;

export class SessionStore {
  public static async get(id: string): Promise<SessionData | null> {
    return sessionStore.get(id) || null;
  }

  public get(id: string): SessionData | undefined {
    return sessionsStore.get(id);
  }

  public getOrCreate(id: string, initialTitle?: string): SessionData {
    let session = sessionsStore.get(id);

    if (!session) {
      const ws = workspaceManager.getOrCreateWorkspace(id);

      session = {
        id,
        title: initialTitle || "Workspace Session",
        sandbox_id: `sandbox-${id}`,
        sandbox_state: "running",
        environment: ws.environment,
        providerId: ws.providerId,
        model: "gemini-2.5-flash",
        provider: "Google Gemini",
        created_at: new Date().toISOString(),
        messages: [],
        files: {},
        preview_url: `/api/preview/${id}`,
        needs_run: false,
        agent_running: false,
        cwd: ws.workspacePath,
      };

      sessionsStore.set(id, session);
      globalEventBus.emit(id, "session.created", { sessionId: id });
    }

    return session;
  }

  public save(session: SessionData): void {
    sessionsStore.set(session.id, session);
    globalEventBus.emit(session.id, "session.updated", { sessionId: session.id });
  }

  public delete(id: string): boolean {
    return sessionsStore.delete(id);
  }

  public list(): Array<{ id: string; title: string; created_at: string }> {
    const list: Array<{ id: string; title: string; created_at: string }> = [];
    for (const s of sessionsStore.values()) {
      list.push({ id: s.id, title: s.title, created_at: s.created_at });
    }
    return list.reverse();
  }

  public addMessage(sessionId: string, message: Omit<ChatMessage, "id" | "created_at">): ChatMessage {
    const session = this.getOrCreate(sessionId);
    const fullMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: message.role,
      content: message.content,
      blocks: message.blocks,
      created_at: new Date().toISOString(),
    };
    session.messages.push(fullMsg);
    this.save(session);
    return fullMsg;
  }
}

export const sessionStore = new SessionStore();
export { workspaceManager } from "@soryos/workspace";

export class MessageStore {
  public static async getBySession(sessionId: string): Promise<ChatMessage[]> {
    const session = sessionStore.get(sessionId);
    return session?.messages || [];
  }
}
