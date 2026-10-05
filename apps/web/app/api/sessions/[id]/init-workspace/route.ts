import { NextRequest, NextResponse } from "next/server";
import { sessionStore, workspaceManager } from "@soryos/session";
import { sandboxManager } from "@soryos/sandbox";
import { GitHubRemoteFilesystem } from "@soryos/filesystem";
import type { SessionData } from "@soryos/schema";

/**
 * Initialisation du workspace pour une session.
 * Utilise UNIQUEMENT @soryos/* - Aucune logique métier ici.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session: SessionData | undefined = sessionStore.get(id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const overrides = {
      codespaceId: body.codespaceId,
      repository: body.repository,
      branch: body.branch,
      providerId: body.providerId,
    };

    // Initialize workspace
    const ws = workspaceManager.getOrCreateWorkspace(id, {
      environment: session.environment,
      providerId: session.providerId,
      repository: overrides.repository,
      branch: overrides.branch,
    });

    // Initialize sandbox
    const { sandboxId } = await sandboxManager.getOrCreateSandbox(id, ws.providerId);
    session.sandbox_id = sandboxId;

    // If GitHub repository, sync files
    if (overrides.repository && (ws.providerId === "github-codespaces" || ws.providerId === "github-repository")) {
      try {
        const fs = new GitHubRemoteFilesystem(id, overrides.repository, overrides.branch || "main");
        const entries = await fs.listFiles();
        for (const entry of entries) {
          if (entry.type === "file") {
            const content = await fs.readFile(entry.path);
            session.files[entry.path] = content;
          }
        }
      } catch (e) {
        console.warn("GitHub file sync warning:", e);
      }
    }

    session.workspaceState = "WORKSPACE_READY";
    sessionStore.save(session);

    return NextResponse.json({
      success: true,
      sandboxId,
      paths: Object.keys(session.files),
    });
  } catch (err) {
    session.workspaceState = "WORKSPACE_ERROR";
    session.workspaceError = err instanceof Error ? err.message : "Initialization failed";
    sessionStore.save(session);

    return NextResponse.json(
      { error: session.workspaceError },
      { status: 500 }
    );
  }
}
