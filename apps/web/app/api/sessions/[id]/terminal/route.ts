import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "@/lib/agent-engine";
import { ptyManager, TerminalInstance } from "@/lib/terminal/pty-manager";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = getSessionData(id);

  if (!session) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const terminalId = searchParams.get("terminalId");
  const state = ptyManager.getOrCreateSessionState(id);

  const terminalsList = Array.from(state.terminals.values()).map((t) => ({
    id: t.id,
    title: t.title,
    shell: t.shell,
    cwd: t.cwd,
    gitBranch: t.gitBranch,
    gitStatus: t.gitStatus,
    isRunning: Boolean(t.activeProcess),
    activeCommand: t.activeProcess?.command,
    detectedPort: t.detectedPort,
  }));

  const active = terminalId ? state.terminals.get(terminalId) : state.terminals.get(state.activeTerminalId);

  return NextResponse.json({
    sessionId: id,
    activeTerminalId: state.activeTerminalId,
    terminals: terminalsList,
    activeTerminal: active
      ? {
          id: active.id,
          title: active.title,
          shell: active.shell,
          cwd: active.cwd,
          buffer: active.buffer,
          history: active.history,
          gitBranch: active.gitBranch,
          gitStatus: active.gitStatus,
          isRunning: Boolean(active.activeProcess),
          activeCommand: active.activeProcess?.command,
          exitCode: active.exitCode,
          detectedPort: active.detectedPort,
        }
      : null,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = getSessionData(id);

  if (!session) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action || "exec";
  const state = ptyManager.getOrCreateSessionState(id);
  const terminalId = body.terminalId || state.activeTerminalId;

  // 1. Create a new terminal tab
  if (action === "create") {
    const shell = body.shell || "/bin/bash";
    const newTerm = ptyManager.createTerminal(id, shell);
    return NextResponse.json({
      success: true,
      terminal: {
        id: newTerm.id,
        title: newTerm.title,
        shell: newTerm.shell,
        cwd: newTerm.cwd,
        gitBranch: newTerm.gitBranch,
        gitStatus: newTerm.gitStatus,
      },
      activeTerminalId: newTerm.id,
    });
  }

  // 2. Close terminal tab
  if (action === "close") {
    const closed = ptyManager.closeTerminal(id, terminalId);
    return NextResponse.json({
      success: closed,
      activeTerminalId: state.activeTerminalId,
      terminals: Array.from(state.terminals.values()).map((t) => ({
        id: t.id,
        title: t.title,
        cwd: t.cwd,
      })),
    });
  }

  // 3. Clear terminal buffer
  if (action === "clear") {
    ptyManager.clearTerminal(id, terminalId);
    return NextResponse.json({ success: true });
  }

  // 4. Send signal (Ctrl+C / SIGINT)
  if (action === "signal") {
    const signal = body.signal || "SIGINT";
    const sent = ptyManager.sendSignal(id, terminalId, signal);
    return NextResponse.json({ success: sent });
  }

  // 5. Switch active terminal
  if (action === "switch") {
    if (state.terminals.has(terminalId)) {
      state.activeTerminalId = terminalId;
    }
    return NextResponse.json({ success: true, activeTerminalId: state.activeTerminalId });
  }

  // 6. Execute real command
  const command = (body.command || "").trim();
  if (!command) {
    const term = state.terminals.get(terminalId);
    return NextResponse.json({
      output: "",
      isError: false,
      cwd: term?.cwd || session.cwd || `/workspaces/project`,
      gitBranch: term?.gitBranch || session.branch || "main",
      gitStatus: term?.gitStatus || "clean",
      exitCode: 0,
    });
  }

  try {
    const result = await ptyManager.executeCommand({
      sessionId: id,
      terminalId,
      command,
    });

    return NextResponse.json({
      output: result.output,
      isError: result.isError,
      cwd: result.cwd,
      exitCode: result.exitCode,
      gitBranch: result.gitBranch,
      gitStatus: result.gitStatus,
      detectedPort: result.detectedPort,
      providerId: session.providerId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur d'exécution";
    return NextResponse.json(
      {
        output: `\x1b[31mTerminal execution error: ${msg}\x1b[0m\r\n`,
        isError: true,
        cwd: session.cwd,
        exitCode: 1,
      },
      { status: 500 },
    );
  }
}
