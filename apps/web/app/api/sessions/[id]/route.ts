import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "@/lib/agent-engine";

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
    messages: session.messages,
    preview_url: session.preview_url,
    needs_run: session.needs_run,
    agent_running: session.agent_running,
  });
}
