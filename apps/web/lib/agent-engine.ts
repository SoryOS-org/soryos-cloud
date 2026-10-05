/**
 * SoryOS-Code Session Engine Adapter
 * Replaces old duplicate session/workspace logic by delegating to official @soryos/session and @soryos/workspace packages.
 */

export * from "@soryos/schema";

import { sessionStore } from "@soryos/session";
import { workspaceManager } from "@soryos/workspace";
import { SessionData, ProviderId } from "@soryos/schema";

export function getSessionData(id: string): SessionData {
  return sessionStore.getOrCreate(id);
}

export const getSession = getSessionData;
export const getOrCreateSession = getSessionData;

export function saveSession(session: SessionData): void {
  sessionStore.save(session);
}

export function deleteSessionData(id: string): boolean {
  return sessionStore.delete(id);
}

export function updateSessionTitle(id: string, title: string): boolean {
  const session = sessionStore.get(id);
  if (!session) return false;
  session.title = title;
  sessionStore.save(session);
  return true;
}

export function listSessionsData() {
  return sessionStore.list();
}

export function createNewSession(
  title = "New Session",
  environment: "sandbox" | "local" = "sandbox",
  providerId: ProviderId = "github-codespaces"
): SessionData {
  const id = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const ws = workspaceManager.getOrCreateWorkspace(id, { environment, providerId });
  const session = sessionStore.getOrCreate(id, title);
  session.environment = ws.environment;
  session.providerId = ws.providerId;
  sessionStore.save(session);
  return session;
}
