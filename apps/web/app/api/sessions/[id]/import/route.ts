import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "@/lib/agent-engine";
import JSZip from "jszip";

// Files to exclude from text extraction
const IGNORED_PREFIXES = [
  "node_modules/",
  ".git/",
  ".next/",
  "dist/",
  "build/",
  ".turbo/",
  ".cache/",
];

const IGNORED_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".ico",
  ".webp",
  ".mp4",
  ".mp3",
  ".wav",
  ".zip",
  ".tar",
  ".gz",
  ".pdf",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".pyc",
  ".DS_Store",
];

function isTextFile(path: string): boolean {
  const lower = path.toLowerCase();
  if (IGNORED_PREFIXES.some((p) => lower.includes(p))) return false;
  if (IGNORED_EXTENSIONS.some((ext) => lower.endsWith(ext))) return false;
  return true;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = getSessionData(id);

    if (!session) {
      return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
    }

    const body = await req.json();
    const { files, repoUrl } = body;

    // Direct files payload (from local directory scan or drag-and-drop)
    if (files && typeof files === "object") {
      const added: string[] = [];
      for (const [rawPath, content] of Object.entries(files)) {
        if (typeof content === "string" && isTextFile(rawPath)) {
          const cleanPath = rawPath.replace(/^\//, "").replace(/^home\/user\//, "");
          session.files[cleanPath] = content;
          added.push(cleanPath);
        }
      }

      session.preview_url = `/api/preview/${session.id}`;

      return NextResponse.json({
        success: true,
        count: added.length,
        paths: added,
      });
    }

    // Remote GitHub / GitLab Repo URL import
    if (repoUrl && typeof repoUrl === "string") {
      const cleanUrl = repoUrl.trim().replace(/\.git$/, "");
      const githubMatch = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      const gitlabMatch = cleanUrl.match(/gitlab\.com\/([^/]+)\/([^/]+)/);

      let zipUrls: string[] = [];

      if (githubMatch) {
        const [, owner, repo] = githubMatch;
        zipUrls = [
          `https://github.com/${owner}/${repo}/archive/refs/heads/main.zip`,
          `https://github.com/${owner}/${repo}/archive/refs/heads/master.zip`,
          `https://api.github.com/repos/${owner}/${repo}/zipball`,
        ];
      } else if (gitlabMatch) {
        const [, owner, repo] = gitlabMatch;
        zipUrls = [
          `https://gitlab.com/${owner}/${repo}/-/archive/main/${repo}-main.zip`,
          `https://gitlab.com/${owner}/${repo}/-/archive/master/${repo}-master.zip`,
        ];
      } else {
        return NextResponse.json(
          { error: "Format d'URL non supporté. Exemples: https://github.com/owner/repo ou https://gitlab.com/owner/repo" },
          { status: 400 },
        );
      }

      let zipBuffer: ArrayBuffer | null = null;
      let lastErr = "";

      for (const url of zipUrls) {
        try {
          const res = await fetch(url, {
            headers: {
              "User-Agent": "CodeForge-Importer",
              Accept: "application/vnd.github.v3+json",
            },
          });

          if (res.ok) {
            zipBuffer = await res.arrayBuffer();
            break;
          } else {
            lastErr = `HTTP ${res.status}: ${res.statusText}`;
          }
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
        }
      }

      if (!zipBuffer) {
        return NextResponse.json(
          { error: `Impossible de télécharger le dépôt GitHub (${lastErr})` },
          { status: 400 },
        );
      }

      const zip = await JSZip.loadAsync(zipBuffer);
      const added: string[] = [];

      // Extract text files
      for (const [rawPath, file] of Object.entries(zip.files)) {
        if (file.dir) continue;

        // Strip GitHub top-level archive directory (e.g. repo-main/)
        const parts = rawPath.split("/");
        if (parts.length > 1) {
          parts.shift();
        }
        const normalizedPath = parts.join("/");

        if (!isTextFile(normalizedPath)) continue;

        try {
          const content = await file.async("string");
          // Ignore oversized files > 500KB
          if (content.length < 500_000) {
            session.files[normalizedPath] = content;
            added.push(normalizedPath);
          }
        } catch {
          // Skip unreadable binary
        }
      }

      session.preview_url = `/api/preview/${session.id}`;

      return NextResponse.json({
        success: true,
        count: added.length,
        paths: added,
      });
    }

    return NextResponse.json({ error: "Aucun fichier ou URL fournie" }, { status: 400 });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur lors de l'importation" },
      { status: 500 },
    );
  }
}
