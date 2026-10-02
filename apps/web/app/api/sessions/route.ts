import { NextRequest, NextResponse } from "next/server";
import { createNewSession, listSessionsData } from "@/lib/agent-engine";

export async function GET() {
  const sessions = listSessionsData();
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const session = createNewSession(body.title, body.message, body.model);
    return NextResponse.json({
      id: session.id,
      title: session.title,
      sandbox_id: session.sandbox_id,
      model: session.model,
      provider: session.provider,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create session" },
      { status: 500 },
    );
  }
}
