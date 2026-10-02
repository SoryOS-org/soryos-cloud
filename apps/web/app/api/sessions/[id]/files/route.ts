import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "@/lib/agent-engine";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = getSessionData(id);

  if (!session) {
    return NextResponse.json({ paths: [] });
  }

  const paths = Object.keys(session.files);
  return NextResponse.json({ paths });
}
