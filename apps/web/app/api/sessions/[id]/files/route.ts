import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "@/lib/agent-engine";
import { GitHubRemoteFilesystem } from "@/lib/filesystem/remote-provider";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = getSessionData(id);

  if (!session) {
    return NextResponse.json({ paths: [] });
  }

  // If session files are empty but session is connected to a remote GitHub Codespace / repo, fetch live
  if (
    Object.keys(session.files).length === 0 &&
    (session.providerId === "github-codespaces" || session.providerId === "github-repository") &&
    session.repository
  ) {
    try {
      const fs = new GitHubRemoteFilesystem(id, session.repository, session.branch || "main");
      const entries = await fs.listFiles();
      for (const entry of entries) {
        if (entry.type === "file") {
          session.files[entry.path] = "";
        }
      }
    } catch (e) {
      console.warn("Auto-sync remote files in files GET warning:", e);
    }
  }

  const paths = Object.keys(session.files);
  return NextResponse.json({ paths });
}
