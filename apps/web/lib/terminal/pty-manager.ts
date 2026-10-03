import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { getSessionData } from "@/lib/agent-engine";

export interface TerminalInstance {
  id: string;
  title: string;
  shell: string;
  cwd: string;
  history: string[];
  buffer: string;
  activeProcess: {
    pid: number;
    command: string;
    startTime: string;
    child?: ChildProcess;
  } | null;
  exitCode: number | null;
  gitBranch: string;
  gitStatus: string;
  detectedPort?: number;
  createdAt: string;
}

export interface SessionTerminalState {
  sessionId: string;
  activeTerminalId: string;
  terminals: Map<string, TerminalInstance>;
  workspaceDir: string;
}

declare global {
  var __soryos_pty_sessions: Map<string, SessionTerminalState> | undefined;
}

const ptySessions = globalThis.__soryos_pty_sessions ?? new Map<string, SessionTerminalState>();
globalThis.__soryos_pty_sessions = ptySessions;

export class PTYManager {
  private baseWorkspacesDir = "/tmp/soryos-workspaces";

  constructor() {
    if (!fs.existsSync(this.baseWorkspacesDir)) {
      try {
        fs.mkdirSync(this.baseWorkspacesDir, { recursive: true });
      } catch {
        // ignore
      }
    }
  }

  /**
   * Get or initialize the disk workspace directory for a session
   */
  public ensureWorkspaceDir(sessionId: string): string {
    const session = getSessionData(sessionId);
    const repoName = session?.repository ? session.repository.split("/").pop() : "project";
    const dir = path.join(this.baseWorkspacesDir, sessionId, repoName || "project");

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Sync session.files to physical disk workspace
    if (session && session.files) {
      for (const [relPath, content] of Object.entries(session.files)) {
        if (typeof content === "string") {
          const fullPath = path.join(dir, relPath);
          const parentDir = path.dirname(fullPath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }
          fs.writeFileSync(fullPath, content, "utf-8");
        }
      }
    }

    // Initialize real git repo if not present
    const gitDir = path.join(dir, ".git");
    if (!fs.existsSync(gitDir)) {
      try {
        const branch = session?.branch || "main";
        spawn("git", ["init", "-b", branch], { cwd: dir });
        spawn("git", ["config", "user.name", "SoryOS User"], { cwd: dir });
        spawn("git", ["config", "user.email", "user@soryos.internal"], { cwd: dir });
        spawn("git", ["add", "-A"], { cwd: dir });
        spawn("git", ["commit", "-m", "Initial workspace commit", "--allow-empty"], { cwd: dir });
      } catch {
        // git initialization optional
      }
    }

    return dir;
  }

  /**
   * Get or initialize the multi-terminal session state
   */
  public getOrCreateSessionState(sessionId: string): SessionTerminalState {
    let state = ptySessions.get(sessionId);
    if (!state) {
      const session = getSessionData(sessionId);
      const repoName = session?.repository ? session.repository.split("/").pop() : "project";
      const branch = session?.branch || "main";
      const workspaceDir = this.ensureWorkspaceDir(sessionId);
      const displayCwd = session?.providerId === "github-codespaces" || session?.providerId === "github-repository"
        ? `/workspaces/${repoName}`
        : `/workspaces/${repoName}`;

      const defaultTerminal: TerminalInstance = {
        id: "terminal-1",
        title: "1: bash",
        shell: "/bin/bash",
        cwd: displayCwd,
        history: [],
        buffer: `\x1b[1;38;2;198;98;63mWelcome to SoryOS-Code Integrated Terminal (PTY Engine)\x1b[0m\r\n` +
          `Environment: \x1b[32m${session?.providerId === "github-codespaces" ? "☁ GitHub Codespaces" : "💻 Local Container"}\x1b[0m\r\n` +
          `Repository: \x1b[36m${session?.repository || "soryos/project"}\x1b[0m | Branch: \x1b[33m${branch}\x1b[0m\r\n\r\n`,
        activeProcess: null,
        exitCode: null,
        gitBranch: branch,
        gitStatus: "clean",
        createdAt: new Date().toISOString(),
      };

      state = {
        sessionId,
        activeTerminalId: "terminal-1",
        terminals: new Map([["terminal-1", defaultTerminal]]),
        workspaceDir,
      };

      ptySessions.set(sessionId, state);
    }
    return state;
  }

  /**
   * Create a new terminal tab
   */
  public createTerminal(sessionId: string, shell: string = "/bin/bash"): TerminalInstance {
    const state = this.getOrCreateSessionState(sessionId);
    const count = state.terminals.size + 1;
    const terminalId = `terminal-${Date.now()}`;
    const session = getSessionData(sessionId);
    const repoName = session?.repository ? session.repository.split("/").pop() : "project";
    const branch = session?.branch || "main";

    const newTerm: TerminalInstance = {
      id: terminalId,
      title: `${count}: ${shell.split("/").pop() || "bash"}`,
      shell,
      cwd: session?.cwd || `/workspaces/${repoName}`,
      history: [],
      buffer: `\x1b[1;32m● Terminal instance #${count} started (${shell})\x1b[0m\r\n\r\n`,
      activeProcess: null,
      exitCode: null,
      gitBranch: branch,
      gitStatus: "clean",
      createdAt: new Date().toISOString(),
    };

    state.terminals.set(terminalId, newTerm);
    state.activeTerminalId = terminalId;
    return newTerm;
  }

  /**
   * Close a terminal instance
   */
  public closeTerminal(sessionId: string, terminalId: string): boolean {
    const state = this.getOrCreateSessionState(sessionId);
    const term = state.terminals.get(terminalId);
    if (!term) return false;

    // Kill active process if running
    if (term.activeProcess?.child) {
      try {
        term.activeProcess.child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }

    state.terminals.delete(terminalId);

    // If active was deleted, point to another one or create one
    if (state.activeTerminalId === terminalId) {
      const remaining = Array.from(state.terminals.keys());
      if (remaining.length > 0) {
        state.activeTerminalId = remaining[0];
      } else {
        const fresh = this.createTerminal(sessionId);
        state.activeTerminalId = fresh.id;
      }
    }

    return true;
  }

  /**
   * Clear terminal buffer
   */
  public clearTerminal(sessionId: string, terminalId: string): void {
    const state = this.getOrCreateSessionState(sessionId);
    const term = state.terminals.get(terminalId);
    if (term) {
      term.buffer = "";
    }
  }

  /**
   * Send signal (SIGINT / Ctrl+C) to active process
   */
  public sendSignal(sessionId: string, terminalId: string, signal: "SIGINT" | "SIGTERM" | "SIGKILL" = "SIGINT"): boolean {
    const state = this.getOrCreateSessionState(sessionId);
    const term = state.terminals.get(terminalId);
    if (!term || !term.activeProcess?.child) return false;

    try {
      term.activeProcess.child.kill(signal);
      term.buffer += `^C\r\n`;
      term.activeProcess = null;
      term.exitCode = 130;
      return true;
    } catch (err) {
      console.warn("Signal send error:", err);
      return false;
    }
  }

  /**
   * Execute real command in terminal PTY
   */
  public async executeCommand(params: {
    sessionId: string;
    terminalId: string;
    command: string;
    onData?: (chunk: string) => void;
  }): Promise<{
    output: string;
    isError: boolean;
    cwd: string;
    exitCode: number;
    gitBranch: string;
    gitStatus: string;
    detectedPort?: number;
  }> {
    const { sessionId, terminalId, command, onData } = params;
    const state = this.getOrCreateSessionState(sessionId);
    const term = state.terminals.get(terminalId);
    if (!term) throw new Error("Terminal instance introuvable");

    const session = getSessionData(sessionId);
    const repoName = session?.repository ? session.repository.split("/").pop() : "project";
    const workspaceDir = this.ensureWorkspaceDir(sessionId);

    const trimmed = command.trim();
    if (!trimmed) {
      return {
        output: "",
        isError: false,
        cwd: term.cwd,
        exitCode: 0,
        gitBranch: term.gitBranch,
        gitStatus: term.gitStatus,
      };
    }

    // Add to history
    term.history.push(trimmed);

    // 1. Handle `clear` / `cls` command
    if (trimmed === "clear" || trimmed === "cls") {
      term.buffer = "";
      return {
        output: "",
        isError: false,
        cwd: term.cwd,
        exitCode: 0,
        gitBranch: term.gitBranch,
        gitStatus: term.gitStatus,
      };
    }

    // 2. Handle `cd` command directly to update cwd
    if (trimmed === "cd" || trimmed.startsWith("cd ")) {
      const target = trimmed === "cd" ? `/workspaces/${repoName}` : trimmed.slice(3).trim();
      let newCwd = term.cwd;

      if (target === "~" || target === "") {
        newCwd = `/workspaces/${repoName}`;
      } else if (target === ".." || target.startsWith("../")) {
        const parts = term.cwd.split("/").filter(Boolean);
        const upCount = target.split("/").filter((p) => p === "..").length;
        const remainder = target.split("/").filter((p) => p !== ".." && p !== ".").join("/");
        const base = parts.slice(0, Math.max(1, parts.length - upCount)).join("/");
        newCwd = `/${base}${remainder ? "/" + remainder : ""}`;
      } else if (target.startsWith("/")) {
        newCwd = target;
      } else {
        newCwd = `${term.cwd.replace(/\/$/, "")}/${target}`;
      }

      term.cwd = newCwd;
      if (session) session.cwd = newCwd;

      // Update git info
      await this.refreshGitInfo(term, workspaceDir);

      return {
        output: "",
        isError: false,
        cwd: term.cwd,
        exitCode: 0,
        gitBranch: term.gitBranch,
        gitStatus: term.gitStatus,
      };
    }

    // 3. Resolve actual execution directory on disk
    let execDir = workspaceDir;
    const relFromRoot = term.cwd.replace(new RegExp(`^/workspaces/${repoName}`), "").replace(/^\//, "");
    if (relFromRoot) {
      const subDir = path.join(workspaceDir, relFromRoot);
      if (fs.existsSync(subDir)) {
        execDir = subDir;
      }
    }

    // 4. Spawn real child process in the workspace
    return new Promise((resolve) => {
      let fullOutput = "";
      let detectedPort: number | undefined;

      const env = {
        ...process.env,
        TERM: "xterm-256color",
        FORCE_COLOR: "1",
        PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
        PWD: execDir,
        WORKSPACE: workspaceDir,
        GIT_BRANCH: term.gitBranch,
        SHELL: term.shell,
      };

      const child = spawn(term.shell || "/bin/bash", ["-c", trimmed], {
        cwd: execDir,
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });

      term.activeProcess = {
        pid: child.pid || Date.now(),
        command: trimmed,
        startTime: new Date().toISOString(),
        child,
      };

      term.title = `${state.terminals.size}: ${trimmed.split(" ")[0]}`;

      const handleData = (chunk: Buffer) => {
        const text = chunk.toString("utf-8");
        fullOutput += text;
        term.buffer += text;
        onData?.(text);

        // Detect dev server ports from stdout
        const portMatch = text.match(/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|port|Port)\s*[:=]?\s*(\d{4,5})/i);
        if (portMatch && portMatch[1]) {
          const p = parseInt(portMatch[1], 10);
          if (p >= 1024 && p <= 65535) {
            detectedPort = p;
            term.detectedPort = p;
            if (session) {
              session.preview_url = `/api/preview/${sessionId}`;
            }
          }
        }
      };

      child.stdout.on("data", handleData);
      child.stderr.on("data", handleData);

      child.on("error", (err) => {
        const errText = `\x1b[31mProcess error: ${err.message}\x1b[0m\r\n`;
        fullOutput += errText;
        term.buffer += errText;
        term.activeProcess = null;
        term.exitCode = 1;
        resolve({
          output: fullOutput,
          isError: true,
          cwd: term.cwd,
          exitCode: 1,
          gitBranch: term.gitBranch,
          gitStatus: term.gitStatus,
        });
      });

      child.on("close", async (code) => {
        term.activeProcess = null;
        term.exitCode = code ?? 0;
        term.title = `${state.terminals.size}: ${term.shell.split("/").pop() || "bash"}`;

        // Sync modified physical files back to session.files
        this.syncWorkspaceToSession(sessionId, workspaceDir);

        // Update Git Branch & Status
        await this.refreshGitInfo(term, workspaceDir);

        resolve({
          output: fullOutput,
          isError: (code ?? 0) !== 0,
          cwd: term.cwd,
          exitCode: code ?? 0,
          gitBranch: term.gitBranch,
          gitStatus: term.gitStatus,
          detectedPort,
        });
      });
    });
  }

  /**
   * Sync physical files from workspace to session memory
   */
  private syncWorkspaceToSession(sessionId: string, workspaceDir: string): void {
    const session = getSessionData(sessionId);
    if (!session) return;

    const walk = (dir: string, base: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".next") continue;
        const full = path.join(dir, entry.name);
        const rel = path.join(base, entry.name);
        if (entry.isDirectory()) {
          walk(full, rel);
        } else if (entry.isFile()) {
          try {
            const content = fs.readFileSync(full, "utf-8");
            session.files[rel] = content;
          } catch {
            // ignore binary files
          }
        }
      }
    };

    walk(workspaceDir, "");
  }

  /**
   * Refresh git branch and git status
   */
  private async refreshGitInfo(term: TerminalInstance, workspaceDir: string): Promise<void> {
    try {
      const branchProcess = spawn("git", ["branch", "--show-current"], { cwd: workspaceDir });
      let branchName = "";
      branchProcess.stdout.on("data", (d) => {
        branchName += d.toString();
      });

      await new Promise((r) => branchProcess.on("close", r));
      if (branchName.trim()) {
        term.gitBranch = branchName.trim();
      }

      const statusProcess = spawn("git", ["status", "--short"], { cwd: workspaceDir });
      let statusText = "";
      statusProcess.stdout.on("data", (d) => {
        statusText += d.toString();
      });

      await new Promise((r) => statusProcess.on("close", r));
      term.gitStatus = statusText.trim().length > 0 ? "modified" : "clean";
    } catch {
      // ignore git error
    }
  }
}

export const ptyManager = new PTYManager();
