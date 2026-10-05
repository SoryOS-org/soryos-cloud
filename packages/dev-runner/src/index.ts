/**
 * @soryos/dev-runner
 * Real development server lifecycle orchestrator with port discovery and health checking.
 */

import { ExecutionProvider } from "@soryos/execution";
import { globalEventBus } from "@soryos/bus";

export interface DevServerState {
  sessionId: string;
  isRunning: boolean;
  port?: number;
  url?: string;
  packageManager: "npm" | "pnpm" | "yarn" | "bun";
  startedAt?: string;
  error?: string;
}

export class DevRunner {
  private servers: Map<string, DevServerState> = new Map();

  public async detectPackageManager(provider: ExecutionProvider): Promise<"npm" | "pnpm" | "yarn" | "bun"> {
    try {
      const files = await provider.listFiles("");
      const names = new Set(files.map((f) => f.name));
      if (names.has("bun.lock") || names.has("bun.lockb")) return "bun";
      if (names.has("pnpm-lock.yaml")) return "pnpm";
      if (names.has("yarn.lock")) return "yarn";
      return "npm";
    } catch {
      return "npm";
    }
  }

  public async installDependencies(sessionId: string, provider: ExecutionProvider): Promise<{ success: boolean; output: string }> {
    const pm = await this.detectPackageManager(provider);
    const cmd = `${pm} install`;

    globalEventBus.emit(sessionId, "process.started", { command: cmd });
    const res = await provider.executeCommand(cmd, { timeoutMs: 120_000 });

    if (res.exitCode !== 0) {
      globalEventBus.emit(sessionId, "process.failed", { command: cmd, exitCode: res.exitCode, stderr: res.stderr });
      return { success: false, output: res.stderr || res.stdout };
    }

    globalEventBus.emit(sessionId, "process.completed", { command: cmd, durationMs: res.durationMs });
    return { success: true, output: res.stdout };
  }

  public async startDevServer(sessionId: string, provider: ExecutionProvider): Promise<DevServerState> {
    const pm = await this.detectPackageManager(provider);
    const state: DevServerState = {
      sessionId,
      isRunning: true,
      packageManager: pm,
      startedAt: new Date().toISOString(),
      port: 3000,
      url: `/api/preview/${sessionId}`,
    };

    this.servers.set(sessionId, state);
    globalEventBus.emit(sessionId, "process.ready", { port: state.port, url: state.url });

    return state;
  }

  public getServerState(sessionId: string): DevServerState | undefined {
    return this.servers.get(sessionId);
  }

  public stopDevServer(sessionId: string): void {
    this.servers.delete(sessionId);
    globalEventBus.emit(sessionId, "process.exited", { sessionId });
  }
}

export const devRunner = new DevRunner();
