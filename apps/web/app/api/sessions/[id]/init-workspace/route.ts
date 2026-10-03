import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "@/lib/agent-engine";
import { gitHubService } from "@/lib/github/service";
import { GitHubRemoteFilesystem } from "@/lib/filesystem/remote-provider";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSessionData(id);

  if (!session) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const codespaceId = body.codespaceId || session.codespaceId;
  const repository = body.repository || session.repository;
  const branch = body.branch || session.branch || "main";
  const providerId = body.providerId || session.providerId || "github-codespaces";

  session.workspaceState = "WORKSPACE_LOADING";
  session.workspaceError = undefined;
  session.providerId = providerId;
  session.environment = providerId === "local" ? "local" : "sandbox";
  if (codespaceId) session.codespaceId = codespaceId;
  if (repository) session.repository = repository;
  if (branch) session.branch = branch;

  try {
    // 1. GITHUB CODESPACES WORKSPACE INITIALIZATION
    if (providerId === "github-codespaces") {
      const token = gitHubService.getToken(id) || gitHubService.getToken("session");
      if (!token) {
        throw new Error("Authentification GitHub manquante. Veuillez vous connecter à GitHub.");
      }

      const repoFullName = repository || (codespaceId ? codespaceId.split("-").slice(0, 2).join("/") : "");
      if (!repoFullName) {
        throw new Error("Repository non spécifié pour le Codespace.");
      }

      const repoShortName = repoFullName.split("/").pop() || "project";
      session.cwd = `/workspaces/${repoShortName}`;

      // Check Codespace status on GitHub if codespaceId provided
      if (codespaceId && !codespaceId.startsWith("cs-")) {
        try {
          const csRes = await fetch(`https://api.github.com/user/codespaces/${encodeURIComponent(codespaceId)}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github.v3+json",
              "User-Agent": "SoryOS-Code-IDE",
            },
          });

          if (csRes.ok) {
            const cs = await csRes.json();
            // Start codespace if stopped
            if (cs.state === "Stopped" || cs.state === "Shutdown") {
              await fetch(`https://api.github.com/user/codespaces/${encodeURIComponent(codespaceId)}/start`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: "application/vnd.github.v3+json",
                  "User-Agent": "SoryOS-Code-IDE",
                },
              }).catch(() => {});
            }
          }
        } catch (e) {
          console.warn("Could not check codespace status, continuing with filesystem sync:", e);
        }
      }

      // Initialize Remote Filesystem from real repository/codespace
      const fs = new GitHubRemoteFilesystem(id, repoFullName, branch);
      const entries = await fs.listFiles();

      // Clear old template files and populate with real files from repository
      session.files = {};
      const fileEntries = entries.filter((e) => e.type === "file");

      // Populate file paths with empty string or placeholder until loaded
      for (const entry of fileEntries) {
        session.files[entry.path] = "";
      }

      // Pre-load top-level priority files immediately (README, package.json, main, config)
      const priorityFiles = fileEntries.filter((e) => {
        const lower = e.path.toLowerCase();
        return (
          !e.path.includes("/") ||
          lower.endsWith(".json") ||
          lower.endsWith(".md") ||
          lower.includes("main") ||
          lower.includes("app") ||
          lower.includes("index")
        );
      }).slice(0, 15);

      await Promise.all(
        priorityFiles.map(async (f) => {
          try {
            const content = await fs.readFile(f.path);
            session.files[f.path] = content;
          } catch {
            // Keep empty or load on-demand
          }
        })
      );

      session.workspaceState = "WORKSPACE_READY";
      return NextResponse.json({
        success: true,
        workspaceState: session.workspaceState,
        filesCount: fileEntries.length,
        paths: Object.keys(session.files),
        cwd: session.cwd,
        repository: repoFullName,
        branch,
        codespaceId,
      });
    }

    // 2. GITHUB REPOSITORY DIRECT MODE
    if (providerId === "github-repository" && repository) {
      const fs = new GitHubRemoteFilesystem(id, repository, branch);
      const entries = await fs.listFiles();
      session.files = {};
      const fileEntries = entries.filter((e) => e.type === "file");
      for (const entry of fileEntries) {
        session.files[entry.path] = "";
      }

      session.workspaceState = "WORKSPACE_READY";
      return NextResponse.json({
        success: true,
        workspaceState: session.workspaceState,
        filesCount: fileEntries.length,
        paths: Object.keys(session.files),
        repository,
        branch,
      });
    }

    // 3. LOCAL ENVIRONMENT MODE
    if (providerId === "local") {
      session.workspaceState = "WORKSPACE_READY";
      return NextResponse.json({
        success: true,
        workspaceState: session.workspaceState,
        paths: Object.keys(session.files),
      });
    }

    session.workspaceState = "WORKSPACE_READY";
    return NextResponse.json({
      success: true,
      workspaceState: session.workspaceState,
      paths: Object.keys(session.files),
    });
  } catch (err: any) {
    const errorMsg = err?.message || "Échec d'initialisation du Workspace";
    session.workspaceState = "WORKSPACE_ERROR";
    session.workspaceError = errorMsg;
    return NextResponse.json({
      success: false,
      workspaceState: session.workspaceState,
      error: errorMsg,
    }, { status: 500 });
  }
}
