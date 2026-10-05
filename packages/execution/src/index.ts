/**
 * @soryos/execution
 * Unified execution provider layer for real sandboxes (Local, Codespaces, E2B, Vercel, Cloud Run).
 */

import { CommandOptions, CommandResult, FileEntry, ProviderId } from "@soryos/schema";
import { ExecutionError } from "@soryos/core";
import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface ExecutionProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly type: "local" | "cloud" | "container";

  init(workspacePath?: string): Promise<void>;
  getWorkspacePath(): string;
  executeCommand(command: string, options?: CommandOptions): Promise<CommandResult>;
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  editFile(filePath: string, targetContent: string, replacementContent: string): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  listFiles(dirPath?: string): Promise<FileEntry[]>;
}

export class LocalExecutionProvider implements ExecutionProvider {
  readonly id: ProviderId = "local";
  readonly name = "Machine Locale";
  readonly type = "local" as const;

  private workspaceDir: string;

  constructor(customWorkspaceDir?: string) {
    this.workspaceDir = customWorkspaceDir || process.cwd();
  }

  async init(workspacePath?: string): Promise<void> {
    if (workspacePath) {
      this.workspaceDir = workspacePath;
    }
    await fs.mkdir(this.workspaceDir, { recursive: true });
  }

  getWorkspacePath(): string {
    return this.workspaceDir;
  }

  private resolvePath(relPath: string): string {
    const clean = relPath.startsWith("/") ? relPath.slice(1) : relPath;
    return path.resolve(this.workspaceDir, clean);
  }

  async executeCommand(command: string, options?: CommandOptions): Promise<CommandResult> {
    const start = Date.now();
    const cwd = options?.cwd ? this.resolvePath(options.cwd) : this.workspaceDir;
    const timeoutMs = options?.timeoutMs || 60_000;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        env: { ...process.env, ...(options?.env || {}) },
        timeout: timeoutMs,
      });

      return {
        stdout: stdout.trimEnd(),
        stderr: stderr.trimEnd(),
        exitCode: 0,
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string; code?: number; message?: string };
      return {
        stdout: (execErr.stdout || "").trimEnd(),
        stderr: (execErr.stderr || execErr.message || "").trimEnd(),
        exitCode: typeof execErr.code === "number" ? execErr.code : 1,
        durationMs: Date.now() - start,
      };
    }
  }

  async readFile(filePath: string): Promise<string> {
    const fullPath = this.resolvePath(filePath);
    try {
      return await fs.readFile(fullPath, "utf-8");
    } catch (err: unknown) {
      throw new ExecutionError(`Impossible de lire le fichier ${filePath}: ${(err as Error).message}`);
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, "utf-8");
    } catch (err: unknown) {
      throw new ExecutionError(`Impossible d'écrire dans ${filePath}: ${(err as Error).message}`);
    }
  }

  async editFile(filePath: string, targetContent: string, replacementContent: string): Promise<void> {
    const current = await this.readFile(filePath);
    if (!current.includes(targetContent)) {
      throw new ExecutionError(`Le bloc cible à remplacer n'a pas été trouvé dans ${filePath}.`);
    }
    const updated = current.replace(targetContent, replacementContent);
    await this.writeFile(filePath, updated);
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    try {
      await fs.unlink(fullPath);
    } catch {
      // ignore
    }
  }

  async listFiles(dirPath = ""): Promise<FileEntry[]> {
    const targetDir = this.resolvePath(dirPath);
    const results: FileEntry[] = [];

    const scan = async (currentDir: string, relativeRoot: string) => {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next") {
            continue;
          }
          const fullPath = path.join(currentDir, entry.name);
          const relPath = path.join(relativeRoot, entry.name);
          const stat = await fs.stat(fullPath);

          results.push({
            path: relPath,
            name: entry.name,
            isDirectory: entry.isDirectory(),
            sizeBytes: stat.size,
            updatedAt: stat.mtime.toISOString(),
          });

          if (entry.isDirectory()) {
            await scan(fullPath, relPath);
          }
        }
      } catch {
        // ignore
      }
    };

    await scan(targetDir, "");
    return results;
  }
}

export class ExecutionManager {
  private providers: Map<string, ExecutionProvider> = new Map();

  public async getOrCreateProvider(sessionId: string, providerId: ProviderId = "local"): Promise<ExecutionProvider> {
    const key = `${sessionId}:${providerId}`;
    let provider = this.providers.get(key);

    if (!provider) {
      const workspaceDir = path.join("/tmp/soryos-workspaces", sessionId);
      provider = new LocalExecutionProvider(workspaceDir);
      await provider.init();
      this.providers.set(key, provider);
    }

    return provider;
  }
}

export const executionManager = new ExecutionManager();
