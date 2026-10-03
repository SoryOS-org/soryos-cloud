import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "@/lib/agent-engine";
import { sandboxManager } from "@/lib/sandbox";
import { ProviderId } from "@/lib/sandbox/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = getSessionData(id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: session.id,
    title: session.title,
    sandbox_id: session.sandbox_id,
    sandbox_state: session.sandbox_state,
    environment: session.environment || (session.providerId === "local" ? "local" : "sandbox"),
    providerId: session.providerId || "e2b",
    codespaceId: session.codespaceId,
    repository: session.repository,
    branch: session.branch,
    workspaceState: session.workspaceState || "WORKSPACE_READY",
    workspaceError: session.workspaceError,
    cwd: session.cwd,
    model: session.model,
    provider: session.provider,
    messages: session.messages,
    files: session.files || {},
    preview_url: session.preview_url,
    needs_run: session.needs_run,
    agent_running: session.agent_running,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = getSessionData(id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));

  if (body.codespaceId) session.codespaceId = body.codespaceId;
  if (body.repository) session.repository = body.repository;
  if (body.branch) session.branch = body.branch;
  if (body.workspaceState) session.workspaceState = body.workspaceState;
  if (body.workspaceError) session.workspaceError = body.workspaceError;
  
  if (body.environment) {
    session.environment = body.environment as "sandbox" | "local";
    if (session.environment === "local") {
      session.providerId = "local";
    } else if (session.providerId === "local") {
      session.providerId = "e2b";
    }
  }

  if (body.providerId) {
    const newProviderId = body.providerId as ProviderId;
    session.providerId = newProviderId;
    session.environment = newProviderId === "local" ? "local" : "sandbox";
  }

  // Switch sandbox in manager
  const { sandboxId } = await sandboxManager.switchProvider(id, session.providerId);
  session.sandbox_id = sandboxId;

  return NextResponse.json({
    id: session.id,
    environment: session.environment,
    providerId: session.providerId,
    sandbox_id: session.sandbox_id,
    codespaceId: session.codespaceId,
    repository: session.repository,
    branch: session.branch,
    workspaceState: session.workspaceState,
    cwd: session.cwd,
  });
}
