/**
 * @soryos/workspace
 * Source of truth for ActiveWorkspace and workspace state.
 * Shared synchronously between Explorer, Editor, Terminal, Agent, and DevRunner.
 */

import { ActiveWorkspace, ProviderId, WorkspaceStatus } from "@soryos/schema";
import { ExecutionProvider, executionManager } from "@soryos/execution";
import { globalEventBus } from "@soryos/bus";

export class WorkspaceManager {
  private workspaces: Map<string, ActiveWorkspace> = new Map();

  public getOrCreateWorkspace(
    sessionId: string,
    options?: {
      projectId?: string;
      environment?: "local" | "sandbox";
      providerId?: ProviderId;
      workspacePath?: string;
      repository?: string;
      branch?: string;
    }
  ): ActiveWorkspace {
    let ws = this.workspaces.get(sessionId);

    if (!ws) {
      ws = {
        id: `ws-${sessionId}`,
        projectId: options?.projectId || "default-project",
        sessionId,
        title: "Workspace Actif",
        environment: options?.environment || "sandbox",
        providerId: options?.providerId || "github-codespaces",
        workspacePath: options?.workspacePath || `/tmp/soryos-workspaces/${sessionId}`,
        repository: options?.repository,
        branch: options?.branch || "main",
        status: "WORKSPACE_READY",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.workspaces.set(sessionId, ws);
      globalEventBus.emit(sessionId, "session.created", { workspaceId: ws.id });
    }

    return ws;
  }

  public getWorkspace(sessionId: string): ActiveWorkspace | undefined {
    return this.workspaces.get(sessionId);
  }

  public updateWorkspaceState(sessionId: string, status: WorkspaceStatus): void {
    const ws = this.workspaces.get(sessionId);
    if (ws) {
      ws.status = status;
      ws.updatedAt = new Date().toISOString();
      globalEventBus.emit(sessionId, "session.updated", { workspaceId: ws.id, status });
    }
  }

  public async getExecutionProvider(sessionId: string): Promise<ExecutionProvider> {
    const ws = this.getOrCreateWorkspace(sessionId);
    return executionManager.getOrCreateProvider(sessionId, ws.providerId);
  }
}

export const workspaceManager = new WorkspaceManager();
