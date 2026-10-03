import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "@/lib/agent-engine";
import { sandboxManager } from "@/lib/sandbox";
import { GitHubRemoteFilesystem } from "@/lib/filesystem/remote-provider";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = getSessionData(id);

  if (!session) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const rawCommand = (body.command || "").trim();

  if (!rawCommand) {
    return NextResponse.json({ output: "", isError: false, cwd: session.cwd });
  }

  const providerId = session.providerId || "github-codespaces";
  const repoName = session.repository ? session.repository.split("/").pop() : "project";
  const workingDir = session.cwd || `/workspaces/${repoName}`;

  // If running in GitHub Codespaces or GitHub Repository environment
  if (providerId === "github-codespaces" || providerId === "github-repository") {
    // 1. pwd
    if (rawCommand === "pwd") {
      return NextResponse.json({
        output: workingDir,
        isError: false,
        cwd: workingDir,
        providerId,
      });
    }

    // 2. ls / dir
    if (rawCommand === "ls" || rawCommand.startsWith("ls ") || rawCommand === "dir") {
      const allPaths = Object.keys(session.files);
      const topLevelItems = new Set<string>();

      for (const p of allPaths) {
        const parts = p.split("/");
        if (parts.length > 1) {
          topLevelItems.add(parts[0] + "/");
        } else if (parts[0]) {
          topLevelItems.add(parts[0]);
        }
      }

      const items = Array.from(topLevelItems).sort();
      const output = items.length > 0 ? items.join("  ") : "README.md";

      return NextResponse.json({
        output,
        isError: false,
        cwd: workingDir,
        providerId,
      });
    }

    // 3. git status
    if (rawCommand === "git status") {
      const branch = session.branch || "main";
      const output = `On branch ${branch}\nYour branch is up to date with 'origin/${branch}'.\nnothing to commit, working tree clean`;
      return NextResponse.json({
        output,
        isError: false,
        cwd: workingDir,
        providerId,
      });
    }

    // 4. git branch
    if (rawCommand === "git branch") {
      const branch = session.branch || "main";
      return NextResponse.json({
        output: `* ${branch}`,
        isError: false,
        cwd: workingDir,
        providerId,
      });
    }

    // 5. cat <file>
    if (rawCommand.startsWith("cat ")) {
      const targetFile = rawCommand.slice(4).trim().replace(/^\//, "");
      let content = session.files[targetFile];

      if (!content && session.repository) {
        try {
          const fs = new GitHubRemoteFilesystem(id, session.repository, session.branch || "main");
          content = await fs.readFile(targetFile);
          session.files[targetFile] = content;
        } catch {
          // not found
        }
      }

      if (content !== undefined) {
        return NextResponse.json({
          output: content,
          isError: false,
          cwd: workingDir,
          providerId,
        });
      }

      return NextResponse.json({
        output: `cat: ${targetFile}: No such file or directory`,
        isError: true,
        cwd: workingDir,
        providerId,
      });
    }
  }

  // Fallback to standard execution in sandboxManager
  const result = await sandboxManager.executeCommand(id, rawCommand, { cwd: session.cwd }, providerId);

  return NextResponse.json({
    output: result.output,
    isError: result.isError,
    cwd: session.cwd,
    providerId,
    artifacts: result.artifacts,
  });
}
