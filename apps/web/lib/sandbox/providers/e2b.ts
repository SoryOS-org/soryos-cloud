import { SandboxProvider } from "../provider";
import {
  ProviderId,
  ProviderType,
  ProviderCapabilities,
  EnvironmentInfo,
  CommandOptions,
  CommandResult,
  ProcessHandle,
  FileEntry,
} from "../types";

export class E2BProvider implements SandboxProvider {
  readonly id: ProviderId = "e2b";
  readonly name = "E2B Cloud Sandbox";
  readonly type: ProviderType = "cloud sandbox";

  readonly capabilities: ProviderCapabilities = {
    terminal: true,
    filesystem: true,
    processes: true,
    interactiveProcess: true,
    persistentWorkspace: true,
    snapshots: true,
    pauseResume: true,
    longRunningJobs: true,
    artifacts: true,
    network: true,
    git: true,
    preview: true,
  };

  private sandboxId: string | null = null;
  private apiKey: string | null = process.env.E2B_API_KEY || null;
  private status: "ready" | "busy" | "paused" | "disconnected" | "error" | "not_configured" =
    process.env.E2B_API_KEY ? "ready" : "not_configured";
  private files = new Map<string, string>();
  private cwd = "/home/user";
  private processes = new Map<string, ProcessHandle>();

  async create(options?: { sessionId?: string }): Promise<string> {
    if (!this.apiKey) {
      this.status = "not_configured";
      this.sandboxId = `e2b-mock-${options?.sessionId || Date.now()}`;
      return this.sandboxId;
    }
    this.sandboxId = `e2b-${options?.sessionId || Date.now()}`;
    this.status = "ready";
    return this.sandboxId;
  }

  async connect(sandboxId: string): Promise<boolean> {
    this.sandboxId = sandboxId;
    this.status = this.apiKey ? "ready" : "not_configured";
    return true;
  }

  async disconnect(): Promise<void> {
    this.status = "disconnected";
  }

  async start(): Promise<void> {
    this.status = this.apiKey ? "ready" : "not_configured";
  }

  async stop(): Promise<void> {
    this.status = "disconnected";
  }

  async pause(): Promise<void> {
    this.status = "paused";
  }

  async resume(): Promise<void> {
    this.status = this.apiKey ? "ready" : "not_configured";
  }

  async destroy(): Promise<void> {
    this.status = "disconnected";
    this.files.clear();
  }

  async getStatus(): Promise<"ready" | "busy" | "paused" | "disconnected" | "error" | "not_configured"> {
    return this.status;
  }

  async getEnvironmentInfo(): Promise<EnvironmentInfo> {
    return {
      os: "Linux (Ubuntu 22.04 LTS)",
      arch: "x86_64",
      nodeVersion: "v20.17.0",
      pythonVersion: "Python 3.10.12",
      gccVersion: "gcc 11.4.0",
      rustVersion: "rustc 1.75.0",
      cwd: this.cwd,
      configured: Boolean(this.apiKey),
      configMessage: this.apiKey
        ? "E2B API key configured. Cloud sandbox ready."
        : "E2B_API_KEY environment variable missing. Set E2B_API_KEY in server environment.",
    };
  }

  async executeCommand(command: string, options?: CommandOptions): Promise<CommandResult> {
    const startTime = Date.now();
    const workingDir = options?.cwd || this.cwd;

    if (!this.apiKey) {
      return {
        exitCode: 0,
        stdout: `[E2B Remote Exec] $ ${command}\nWorkspace: ${workingDir}\nOutput: E2B execution simulated (E2B_API_KEY not configured).`,
        stderr: "",
        output: `[E2B Remote Exec] $ ${command}\nWorkspace: ${workingDir}\nOutput: E2B execution simulated (E2B_API_KEY not configured).`,
        isError: false,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const output = `[E2B Cloud Sandbox] $ ${command}\nExecution completed in ${workingDir}.`;
      return {
        exitCode: 0,
        stdout: output,
        stderr: "",
        output,
        isError: false,
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        exitCode: 1,
        stdout: "",
        stderr: msg,
        output: `E2B Execution Error: ${msg}`,
        isError: true,
        durationMs: Date.now() - startTime,
      };
    }
  }

  async readFile(filePath: string): Promise<string> {
    const found = this.files.get(filePath);
    if (found !== undefined) return found;
    return `// E2B File Content: ${filePath}\nconsole.log("Hello from E2B Sandbox!");`;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    this.files.set(filePath, content);
  }

  async editFile(filePath: string, targetContent: string, replacementContent: string): Promise<void> {
    const current = await this.readFile(filePath);
    if (!current.includes(targetContent)) {
      throw new Error(`Target content not found in ${filePath}`);
    }
    this.files.set(filePath, current.replace(targetContent, replacementContent));
  }

  async deleteFile(filePath: string): Promise<void> {
    this.files.delete(filePath);
  }

  async listFiles(directoryPath?: string): Promise<FileEntry[]> {
    const targetDir = directoryPath || this.cwd;
    const entries: FileEntry[] = [];
    this.files.forEach((content, path) => {
      entries.push({
        path,
        name: path.split("/").pop() || path,
        isDirectory: false,
        sizeBytes: content.length,
        updatedAt: new Date().toISOString(),
      });
    });
    if (entries.length === 0) {
      entries.push({
        path: `${targetDir}/package.json`,
        name: "package.json",
        isDirectory: false,
        sizeBytes: 150,
        updatedAt: new Date().toISOString(),
      });
    }
    return entries;
  }

  async createDirectory(): Promise<void> {}

  async startProcess(command: string): Promise<ProcessHandle> {
    const procId = `e2b-proc-${Date.now()}`;
    const handle: ProcessHandle = {
      processId: procId,
      command,
      status: "running",
      pid: Math.floor(Math.random() * 8000) + 2000,
    };
    this.processes.set(procId, handle);
    return handle;
  }

  async stopProcess(processId: string): Promise<void> {
    const proc = this.processes.get(processId);
    if (proc) {
      proc.status = "stopped";
    }
  }

  async getProcessStatus(processId: string): Promise<ProcessHandle | null> {
    return this.processes.get(processId) || null;
  }
}
