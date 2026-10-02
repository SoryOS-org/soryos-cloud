import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "@/lib/agent-engine";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = getSessionData(id);

  if (!session) {
    return NextResponse.json({
      preview_url: null,
      status: "no_sandbox",
      output: "Session not found",
    });
  }

  const preview_url = `/api/preview/${session.id}`;
  session.preview_url = preview_url;

  return NextResponse.json({
    preview_url,
    status: "ready",
    output: null,
  });
}
