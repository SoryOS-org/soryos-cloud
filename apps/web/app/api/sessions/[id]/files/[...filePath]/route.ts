import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "@/lib/agent-engine";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; filePath: string[] }> },
) {
  const { id, filePath } = await params;
  const session = getSessionData(id);

  if (!session) {
    return new NextResponse("Session not found", { status: 404 });
  }

  const rawPath = Array.isArray(filePath) ? filePath.join("/") : filePath;
  const decodedPath = decodeURIComponent(rawPath)
    .replace(/^\/home\/user\//, "")
    .replace(/^home\/user\//, "")
    .replace(/^\.\//, "");

  const content = session.files[decodedPath];
  if (content === undefined) {
    // Try matching without leading slash
    const fallback = Object.entries(session.files).find(
      ([k]) => k.endsWith(decodedPath) || decodedPath.endsWith(k),
    );
    if (fallback) {
      return new NextResponse(fallback[1], {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return new NextResponse("File not found", { status: 404 });
  }

  return new NextResponse(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
