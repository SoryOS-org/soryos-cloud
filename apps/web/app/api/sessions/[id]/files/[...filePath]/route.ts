import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "@/lib/agent-engine";
import { GitHubRemoteFilesystem } from "@/lib/filesystem/remote-provider";

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

  let content = session.files[decodedPath];

  // If content is empty string or undefined and session is connected to a remote GitHub repo/codespace, fetch live
  if (
    (!content || content === "") &&
    (session.providerId === "github-codespaces" || session.providerId === "github-repository") &&
    session.repository
  ) {
    try {
      const fs = new GitHubRemoteFilesystem(id, session.repository, session.branch || "main");
      content = await fs.readFile(decodedPath);
      session.files[decodedPath] = content;
    } catch (e) {
      console.warn(`Failed to fetch ${decodedPath} live from GitHub:`, e);
    }
  }

  if (content === undefined) {
    // Try matching without leading slash or relative variations
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

export async function PUT(
  req: NextRequest,
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

  const newContent = await req.text();
  session.files[decodedPath] = newContent;

  // If remote GitHub Codespace / repository, write back to remote repository
  if (
    (session.providerId === "github-codespaces" || session.providerId === "github-repository") &&
    session.repository
  ) {
    try {
      const fs = new GitHubRemoteFilesystem(id, session.repository, session.branch || "main");
      await fs.writeFile(decodedPath, newContent);
    } catch (e) {
      console.error(`Failed to write ${decodedPath} to GitHub:`, e);
    }
  }

  return new NextResponse("OK", { status: 200 });
}

export async function DELETE(
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

  delete session.files[decodedPath];

  // If remote GitHub repository / codespace, attempt remote deletion
  if (
    (session.providerId === "github-codespaces" || session.providerId === "github-repository") &&
    session.repository
  ) {
    try {
      const fs = new GitHubRemoteFilesystem(id, session.repository, session.branch || "main");
      await fs.deleteFile(decodedPath);
    } catch (e) {
      console.error(`Failed to delete ${decodedPath} on GitHub:`, e);
    }
  }

  return new NextResponse("Deleted", { status: 200 });
}
