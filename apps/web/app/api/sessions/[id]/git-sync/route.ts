import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "@/lib/agent-engine";
import { gitSyncManager } from "@/lib/sandbox/git-sync-manager";
import { ProviderId } from "@/lib/sandbox/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSessionData(id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const providerId = session.providerId || "e2b";
  const gitStatus = await gitSyncManager.getGitStatus(id, providerId);

  return NextResponse.json({
    sessionId: id,
    environment: session.environment || (providerId === "local" ? "local" : "sandbox"),
    providerId,
    gitStatus,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSessionData(id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action as "commit_and_push" | "sync_cloud" | "check_status";
  const targetProviderId = (body.providerId as ProviderId) || session.providerId || "e2b";

  if (action === "commit_and_push") {
    const result = await gitSyncManager.commitAndPush(
      id,
      targetProviderId,
      body.commitMessage || `soryos-code: save session checkpoint`
    );
    return NextResponse.json(result);
  }

  if (action === "sync_cloud") {
    const result = await gitSyncManager.syncWorkingCopyFromGitHub(
      id,
      targetProviderId,
      body.repoUrl
    );
    return NextResponse.json(result);
  }

  const status = await gitSyncManager.getGitStatus(id, targetProviderId);
  return NextResponse.json({ success: true, status });
}
