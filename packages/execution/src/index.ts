/**
 * @soryos/execution
 * Unified execution provider layer for real sandboxes (Local, Codespaces, E2B, Vercel, Cloud Run).
 * Browser-safe guarded against native Node.js module bundler failures using dynamic evaluation.
 */

import { CommandOptions, CommandResult, FileEntry, ProviderId } from "@soryos/schema";
import { ExecutionError } from "@soryos/core";
import { sandboxManager, type SandboxProvider } from "@soryos/sandbox";

const isServer = typeof window === "undefined";

declare const __non_webpack_require__: ((id: string) => unknown) | undefined;

function dynamicRequire(moduleName: string): any {
  if (!isServer) {
    throw new ExecutionError(`Node.js native module '${moduleName}' cannot be executed in browser environment.`);
  }
  try {
    const req = typeof __non_webpack_require__ === "function" ? __non_webpack_require__ : eval("require");
    return req(moduleName);
  } catch {
    throw new ExecutionError(`Failed to dynamically load native Node.js module '${moduleName}'.`);
  }
}

function getNodeFs() {
  return dynamicRequire("fs/promises") as typeof import("fs/promises");
}

function getNodePath() {
  return dynamicRequire("path") as typeof import("path");
}

function getNodeExecAsync() {
  const { exec } = dynamicRequire("child_process");
  const { promisify } = dynamicRequire("util");
  return promisify(exec);
}

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
  createDirectory?(dirPath: string): Promise<void>;
  moveFile?(sourcePath: string, destinationPath: string): Promise<void>;
}

export class LocalExecutionProvider implements ExecutionProvider {
  readonly id: ProviderId = "local";
  readonly name = "Machine Locale";
  readonly type = "local" as const;

  private workspaceDir: string;

  constructor(customWorkspaceDir?: string) {
    this.workspaceDir = customWorkspaceDir || (isServer && typeof process !== "undefined" && process.cwd ? process.cwd() : "/");
  }

  async init(workspacePath?: string): Promise<void> {
    if (workspacePath) {
      this.workspaceDir = workspacePath;
    }
    const fs = getNodeFs();
    const path = getNodePath();
    await fs.mkdir(this.workspaceDir, { recursive: true });

    // Seed empty workspace directory with project codebase if different from root project dir
    const rootDir = typeof process !== "undefined" && process.cwd ? process.cwd() : "/app/applet";
    if (this.workspaceDir !== rootDir) {
      try {
        const files = await fs.readdir(this.workspaceDir);
        if (files.length === 0) {
          const copyDir = async (src: string, dest: string) => {
            await fs.mkdir(dest, { recursive: true });
            const entries = await fs.readdir(src, { withFileTypes: true });
            for (const entry of entries) {
              if (
                entry.name === "node_modules" ||
                entry.name === ".git" ||
                entry.name === ".next" ||
                entry.name === "dist"
              ) {
                continue;
              }
              const srcPath = path.join(src, entry.name);
              const destPath = path.join(dest, entry.name);
              if (entry.isDirectory()) {
                await copyDir(srcPath, destPath);
              } else {
                await fs.copyFile(srcPath, destPath);
              }
            }
          };
          await copyDir(rootDir, this.workspaceDir);
        }
      } catch {
        // ignore seed errors
      }
    }
  }

  getWorkspacePath(): string {
    return this.workspaceDir;
  }

  /**
   * Resolve a path relative to the workspace, with security checks.
   * Prevents directory traversal attacks and ensures paths stay within workspace.
   */
  private resolvePath(relPath: string): string {
    const path = getNodePath();
    
    // First, check for any ".." in the path - this is a security risk
    // We reject any path containing ".." to prevent directory traversal
    if (relPath.includes("..")) {
      throw new ExecutionError(
        `Path traversal attempt detected: paths with ".." are not allowed: '${relPath}'`
      );
    }
    
    // If the path is absolute, we need to check if it's within workspace
    if (path.isAbsolute(relPath)) {
      const normalizedPath = path.normalize(relPath);
      const normalizedWorkspace = path.normalize(this.workspaceDir);
      
      // For absolute paths, we ONLY allow paths that are within the workspace
      // This is a strict security requirement - no absolute paths outside workspace
      if (!normalizedPath.startsWith(normalizedWorkspace + path.sep) && 
          normalizedPath !== normalizedWorkspace) {
        throw new ExecutionError(
          `Absolute path '${relPath}' is outside workspace '${this.workspaceDir}'. All absolute paths must be within the workspace.`
        );
      }
      return normalizedPath;
    }
    
    // For relative paths, normalize and resolve
    let normalizedPath = relPath;
    
    // Remove leading slashes for relative paths (treat as relative to workspace)
    while (normalizedPath.startsWith("/")) {
      normalizedPath = normalizedPath.slice(1);
    }
    
    // Resolve the full path
    const fullPath = path.resolve(this.workspaceDir, normalizedPath);
    
    // Security check: ensure the resolved path is within the workspace
    // Use path.normalize to handle . correctly
    const normalizedFullPath = path.normalize(fullPath);
    const normalizedWorkspace = path.normalize(this.workspaceDir);
    
    // Check if the path starts with the workspace path
    if (!normalizedFullPath.startsWith(normalizedWorkspace + path.sep) && 
        normalizedFullPath !== normalizedWorkspace) {
      throw new ExecutionError(
        `Path traversal attempt detected: '${relPath}' resolves to '${normalizedFullPath}' which is outside workspace '${normalizedWorkspace}'`
      );
    }
    
    return fullPath;
  }



  async executeCommand(command: string, options?: CommandOptions): Promise<CommandResult> {
    const start = Date.now();
    const cwd = options?.cwd ? this.resolvePath(options.cwd) : this.workspaceDir;
    const timeoutMs = options?.timeoutMs || 60_000;
    const execAsync = getNodeExecAsync();

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        env: { ...(typeof process !== "undefined" ? process.env : {}), ...(options?.env || {}) },
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
    const fs = getNodeFs();
    const fullPath = this.resolvePath(filePath);
    
    // Additional security: check for symlink traversal
    // If the resolved path contains symlinks that point outside workspace, reject
    try {
      const realPath = await fs.realpath(fullPath);
      const path = getNodePath();
      const normalizedWorkspace = path.normalize(this.workspaceDir);
      const normalizedRealPath = path.normalize(realPath);
      
      if (!normalizedRealPath.startsWith(normalizedWorkspace + path.sep) && 
          normalizedRealPath !== normalizedWorkspace) {
        throw new ExecutionError(
          `Symlink traversal detected: '${filePath}' resolves to '${realPath}' which is outside workspace`
        );
      }
    } catch {
      // If realpath fails (file doesn't exist yet), proceed with the resolved path
    }
    
    try {
      return await fs.readFile(fullPath, "utf-8");
    } catch (err: unknown) {
      throw new ExecutionError(`Impossible de lire le fichier ${filePath}: ${(err as Error).message}`);
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const fs = getNodeFs();
    const path = getNodePath();
    const fullPath = this.resolvePath(filePath);
    
    // Additional security: check for symlink traversal
    try {
      const realPath = await fs.realpath(fullPath);
      const normalizedWorkspace = path.normalize(this.workspaceDir);
      const normalizedRealPath = path.normalize(realPath);
      
      if (!normalizedRealPath.startsWith(normalizedWorkspace + path.sep) && 
          normalizedRealPath !== normalizedWorkspace) {
        throw new ExecutionError(
          `Symlink traversal detected: '${filePath}' resolves to '${realPath}' which is outside workspace`
        );
      }
    } catch {
      // If realpath fails (directory doesn't exist yet), proceed with the resolved path
    }
    
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
    const fs = getNodeFs();
    const fullPath = this.resolvePath(filePath);
    
    // Additional security: check for symlink traversal
    try {
      const realPath = await fs.realpath(fullPath);
      const path = getNodePath();
      const normalizedWorkspace = path.normalize(this.workspaceDir);
      const normalizedRealPath = path.normalize(realPath);
      
      if (!normalizedRealPath.startsWith(normalizedWorkspace + path.sep) && 
          normalizedRealPath !== normalizedWorkspace) {
        throw new ExecutionError(
          `Symlink traversal detected: '${filePath}' resolves to '${realPath}' which is outside workspace`
        );
      }
    } catch {
      // If realpath fails (file doesn't exist), that's fine - we're deleting it
    }
    
    try {
      await fs.unlink(fullPath);
    } catch {
      // ignore
    }
  }

  async listFiles(dirPath = ""): Promise<FileEntry[]> {
    const fs = getNodeFs();
    const path = getNodePath();
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

  async createDirectory(dirPath: string): Promise<void> {
    const fs = getNodeFs();
    const path = getNodePath();
    
    // Use our secure path resolution
    const targetDir = this.resolvePath(dirPath);
    await fs.mkdir(targetDir, { recursive: true });
  }

  async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    const fs = getNodeFs();
    const path = getNodePath();
    
    // Use our secure path resolution for both source and destination
    const src = this.resolvePath(sourcePath);
    const dst = this.resolvePath(destinationPath);
    
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.rename(src, dst);
  }
}

/**
 * ExecutionProvider implementation that wraps a SandboxProvider.
 * This allows the execution layer to use the real sandbox providers (E2B, Vercel, etc.)
 * while maintaining backward compatibility with the ExecutionProvider interface.
 */
class SandboxBackedExecutionProvider implements ExecutionProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly type: "local" | "cloud" | "container";

  private sandboxProvider: SandboxProvider;
  private sessionId: string;

  constructor(sandboxProvider: SandboxProvider, sessionId: string) {
    this.sandboxProvider = sandboxProvider;
    this.id = sandboxProvider.id as ProviderId;
    this.name = sandboxProvider.name;
    this.sessionId = sessionId;
    this.type = sandboxProvider.type.includes("local") ? "local" : sandboxProvider.type.includes("cloud") ? "cloud" : "container";
  }

  async init(workspacePath?: string): Promise<void> {
    if (workspacePath) {
      // If a specific workspace path is provided, we need to handle it
      // For now, we'll use the sandbox provider's existing workspace
    }
    // Sandbox is already initialized via sandboxManager
  }

  getWorkspacePath(): string {
    // For sandbox providers, the workspace path is managed internally
    // Return a representative path based on provider type
    if (this.sandboxProvider.id === "local") {
      const path = getNodePath();
      const rootDir = typeof process !== "undefined" && process.cwd ? process.cwd() : "/app/applet";
      return path.join("/tmp/soryos-workspaces", this.sessionId);
    }
    return `/sandbox/${this.sandboxProvider.id}/${this.sessionId}`;
  }

  async executeCommand(command: string, options?: CommandOptions): Promise<CommandResult> {
    const result = await this.sandboxProvider.executeCommand(command, {
      cwd: options?.cwd,
      env: options?.env,
      timeoutMs: options?.timeoutMs,
      background: options?.background,
    });

    return {
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      exitCode: result.exitCode || 0,
      durationMs: result.durationMs || 0,
    };
  }

  async readFile(filePath: string): Promise<string> {
    return this.sandboxProvider.readFile(filePath);
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await this.sandboxProvider.writeFile(filePath, content);
  }

  async editFile(filePath: string, targetContent: string, replacementContent: string): Promise<void> {
    await this.sandboxProvider.editFile(filePath, targetContent, replacementContent);
  }

  async deleteFile(filePath: string): Promise<void> {
    await this.sandboxProvider.deleteFile(filePath);
  }

  async listFiles(dirPath?: string): Promise<FileEntry[]> {
    const entries = await this.sandboxProvider.listFiles(dirPath);
    return entries.map((e) => ({
      path: e.path,
      name: e.name,
      isDirectory: e.isDirectory,
      sizeBytes: e.sizeBytes || 0,
      updatedAt: e.updatedAt || new Date().toISOString(),
    }));
  }

  async createDirectory(dirPath: string): Promise<void> {
    if (this.sandboxProvider.createDirectory) {
      await this.sandboxProvider.createDirectory(dirPath);
    } else {
      // Fallback: use mkdir command
      await this.executeCommand(`mkdir -p "${dirPath}"`);
    }
  }

  async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    if (this.sandboxProvider.moveFile) {
      await this.sandboxProvider.moveFile(sourcePath, destinationPath);
    } else {
      // Fallback: use mv command
      await this.executeCommand(`mv "${sourcePath}" "${destinationPath}"`);
    }
  }
}

export class ExecutionManager {
  private providers: Map<string, ExecutionProvider> = new Map();

  /**
   * Get a provider instance for the given provider ID.
   * This now uses the sandbox registry to get the real provider implementation.
   */
  public async getProvider(providerId: ProviderId = "local"): Promise<ExecutionProvider> {
    const key = `default:${providerId}`;
    let provider = this.providers.get(key);

    if (!provider) {
      // Use sandbox registry to create the real provider
      try {
        const sandboxEntry = await sandboxManager.getOrCreateSandbox(
          `default-session-${providerId}`,
          providerId
        );
        provider = new SandboxBackedExecutionProvider(sandboxEntry.provider, `default-session-${providerId}`);
        this.providers.set(key, provider);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // For configuration errors, throw explicitly instead of falling back
        if (errorMessage.includes("API_KEY") || 
            errorMessage.includes("not configured") ||
            errorMessage.includes("not_configured") ||
            errorMessage.includes("not found or not supported")) {
          throw new ExecutionError(
            `Provider '${providerId}' is not available: ${errorMessage}`
          );
        }
        
        // For other errors, we might still want to fall back to local
        // but only for non-cloud providers
        if (providerId === "local") {
          console.warn(`[ExecutionManager] Failed to create local provider:`, error);
          provider = new LocalExecutionProvider();
          await provider.init();
          this.providers.set(key, provider);
        } else {
          // For cloud providers, don't silently fall back
          throw new ExecutionError(
            `Failed to create provider '${providerId}': ${errorMessage}`
          );
        }
      }
    }

    return provider;
  }

  /**
   * Get or create a provider for a specific session.
   * This ensures each session gets its own isolated provider instance.
   */
  public async getOrCreateProvider(sessionId: string, providerId: ProviderId = "local"): Promise<ExecutionProvider> {
    const key = `${sessionId}:${providerId}`;
    let provider = this.providers.get(key);

    if (!provider) {
      try {
        // Use sandbox manager to get or create the real sandbox for this session
        const sandboxEntry = await sandboxManager.getOrCreateSandbox(sessionId, providerId);
        provider = new SandboxBackedExecutionProvider(sandboxEntry.provider, sessionId);
        this.providers.set(key, provider);
      } catch (error) {
        // If sandbox creation fails, we need to handle it properly
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Check if this is a configuration error (missing API key, etc.)
        if (errorMessage.includes("API_KEY") || 
            errorMessage.includes("not configured") ||
            errorMessage.includes("not_configured")) {
          // For configuration errors, we should NOT fall back to local
          // Instead, we throw the error so the caller knows the provider is not available
          throw new ExecutionError(
            `Provider '${providerId}' is not configured: ${errorMessage}. ` +
            `Please configure the required API keys or credentials.`
          );
        }
        
        // For other errors, we might still want to fall back, but let's be explicit
        console.warn(`[ExecutionManager] Failed to create ${providerId} provider for session ${sessionId}:`, error);
        
        // Create a local provider with session-specific workspace
        const path = getNodePath();
        const workspaceDir = path.join("/tmp/soryos-workspaces", sessionId);
        provider = new LocalExecutionProvider(workspaceDir);
        await provider.init();
        this.providers.set(key, provider);
      }
    }

    return provider;
  }

  /**
   * Get a provider for a specific session without creating a new sandbox.
   * Useful when you already have a sandbox and just need the execution provider.
   */
  public getSessionProvider(sessionId: string): ExecutionProvider | undefined {
    return this.providers.get(`${sessionId}:${sessionId}`);
  }

  /**
   * Clear all providers (useful for testing and cleanup)
   */
  public clear(): void {
    this.providers.clear();
  }

  /**
   * Check if a provider is configured and available
   */
  public async isProviderAvailable(providerId: ProviderId): Promise<boolean> {
    try {
      await this.getProvider(providerId);
      return true;
    } catch {
      return false;
    }
  }
}

export const executionManager = new ExecutionManager();
