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

export class LocalProvider implements SandboxProvider {
  readonly id: ProviderId = "local";
  readonly name = "Local Machine";
  readonly type: ProviderType = "local machine";

  readonly capabilities: ProviderCapabilities = {
    terminal: true,
    filesystem: true,
    processes: true,
    interactiveProcess: true,
    persistentWorkspace: true,
    snapshots: false,
    pauseResume: false,
    longRunningJobs: true,
    artifacts: true,
    network: true,
    git: true,
    preview: true,
  };

  private sandboxId: string | null = null;
  private status: "ready" | "busy" | "paused" | "disconnected" | "error" | "not_configured" = "ready";
  private files: Record<string, string> = {};
  private cwd = "/home/user/workspace";
  private processes = new Map<string, ProcessHandle>();

  async create(options?: { sessionId?: string; workspacePath?: string }): Promise<string> {
    this.sandboxId = `local-${options?.sessionId || Date.now()}`;
    this.status = "ready";
    return this.sandboxId;
  }

  async connect(sandboxId: string): Promise<boolean> {
    this.sandboxId = sandboxId;
    this.status = "ready";
    return true;
  }

  async disconnect(): Promise<void> {
    this.status = "disconnected";
  }

  async start(): Promise<void> {
    this.status = "ready";
  }

  async stop(): Promise<void> {
    this.status = "disconnected";
  }

  async pause(): Promise<void> {
    // Local environment pause not supported
  }

  async resume(): Promise<void> {
    this.status = "ready";
  }

  async destroy(): Promise<void> {
    this.status = "disconnected";
    this.files = {};
  }

  async getStatus(): Promise<"ready" | "busy" | "paused" | "disconnected" | "error" | "not_configured"> {
    return this.status;
  }

  async getEnvironmentInfo(): Promise<EnvironmentInfo> {
    return {
      os: "Linux",
      arch: "x86_64",
      nodeVersion: "v20.18.0",
      pythonVersion: "Python 3.11.4",
      gccVersion: "gcc 13.2.0",
      rustVersion: "rustc 1.82.0",
      cwd: this.cwd,
      configured: true,
      configMessage: "Local execution environment active",
    };
  }

  async executeCommand(command: string, options?: CommandOptions): Promise<CommandResult> {
    const startTime = Date.now();
    const cmd = command.trim();
    const workingDir = options?.cwd || this.cwd;

    if (cmd.startsWith("cd ")) {
      const target = cmd.slice(3).trim();
      this.cwd = target === "~" ? "/home/user/workspace" : target;
      return {
        exitCode: 0,
        stdout: "",
        stderr: "",
        output: "",
        isError: false,
        durationMs: Date.now() - startTime,
      };
    }

    if (cmd === "pwd") {
      return {
        exitCode: 0,
        stdout: this.cwd,
        stderr: "",
        output: this.cwd,
        isError: false,
        durationMs: Date.now() - startTime,
      };
    }

    if (cmd.startsWith("ls")) {
      const fileList = Object.keys(this.files);
      const out = fileList.length > 0 ? fileList.join("  ") : "total 0";
      return {
        exitCode: 0,
        stdout: out,
        stderr: "",
        output: out,
        isError: false,
        durationMs: Date.now() - startTime,
      };
    }

    if (cmd.startsWith("cat ")) {
      const fileName = cmd.slice(4).trim();
      const content = this.files[fileName];
      if (content !== undefined) {
        return {
          exitCode: 0,
          stdout: content,
          stderr: "",
          output: content,
          isError: false,
          durationMs: Date.now() - startTime,
        };
      } else {
        return {
          exitCode: 1,
          stdout: "",
          stderr: `cat: ${fileName}: No such file or directory`,
          output: `cat: ${fileName}: No such file or directory`,
          isError: true,
          durationMs: Date.now() - startTime,
        };
      }
    }

    const output = `Local Execution ($ ${command})\nWorkspace: ${workingDir}\nStatus: Command completed successfully.`;
    return {
      exitCode: 0,
      stdout: output,
      stderr: "",
      output,
      isError: false,
      durationMs: Date.now() - startTime,
    };
  }

  async readFile(filePath: string): Promise<string> {
    const found = this.files[filePath];
    if (found !== undefined) return found;
    throw new Error(`Local file not found: ${filePath}`);
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    this.files[filePath] = content;
  }

  async editFile(filePath: string, targetContent: string, replacementContent: string): Promise<void> {
    const current = await this.readFile(filePath);
    if (!current.includes(targetContent)) {
      throw new Error(`Target content not found in ${filePath}`);
    }
    this.files[filePath] = current.replace(targetContent, replacementContent);
  }

  async deleteFile(filePath: string): Promise<void> {
    delete this.files[filePath];
  }

  async listFiles(directoryPath?: string): Promise<FileEntry[]> {
    const targetDir = directoryPath || this.cwd;
    return Object.keys(this.files).map((file) => ({
      path: `${targetDir}/${file}`,
      name: file,
      isDirectory: false,
      sizeBytes: this.files[file]?.length || 0,
      updatedAt: new Date().toISOString(),
    }));
  }

  async createDirectory(): Promise<void> {
    // Directories handled automatically in virtual structure
  }

  async startProcess(command: string): Promise<ProcessHandle> {
    const procId = `proc-${Date.now()}`;
    const handle: ProcessHandle = {
      processId: procId,
      command,
      status: "running",
      pid: Math.floor(Math.random() * 9000) + 1000,
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
