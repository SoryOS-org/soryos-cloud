import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "@/lib/agent-engine";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = getSessionData(id);

  if (session) {
    session.agent_running = false;
  }

  return NextResponse.json({ ok: true });
}
