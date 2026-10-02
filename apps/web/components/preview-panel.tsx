"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ensurePreview, fetchFile } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  Code,
  Monitor,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderDown,
  File,
  Globe,
  RefreshCw,
  ExternalLink,
  Terminal as TerminalIcon,
  Loader2,
} from "lucide-react";
import { Terminal } from "@/components/terminal";
import { ImportRepoModal } from "@/components/import-repo-modal";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
      Loading editor...
    </div>
  ),
});

interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
}

function buildFileTree(paths: string[]): FileNode[] {
  const root: FileNode[] = [];

  for (const fullPath of paths) {
    const parts = fullPath.split("/").filter(Boolean);
    let current = root;

    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      let node = current.find((n) => n.name === part);
      if (!node) {
        node = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          type: isFile ? "file" : "folder",
          children: isFile ? undefined : [],
        };
        current.push(node);
      }
      if (!isFile && node.children) current = node.children;
    });
  }

  const sort = (nodes: FileNode[]): FileNode[] =>
    nodes
      .sort((a, b) =>
        a.type === b.type
          ? a.name.localeCompare(b.name)
          : a.type === "folder"
            ? -1
            : 1,
      )
      .map((n) => (n.children ? { ...n, children: sort(n.children) } : n));

  return sort(root);
}

interface PreviewPanelProps {
  sessionId: string;
  previewUrl: string | null;
  filePaths: string[];
  onPreviewUrl?: (url: string | null) => void;
  onRefreshFiles?: () => void;
}

export function PreviewPanel({
  sessionId,
  previewUrl,
  filePaths,
  onPreviewUrl,
  onRefreshFiles,
}: PreviewPanelProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [activeTab, setActiveTab] = useState("code");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [loadingFile, setLoadingFile] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const ensureRef = useRef<Promise<void> | null>(null);

  const loadFile = useCallback(
    async (path: string) => {
      const normalized = path
        .replace(/^\/home\/user\//, "")
        .replace(/^home\/user\//, "")
        .replace(/^\.\//, "");
      setLoadingFile(true);
      try {
        const content = await fetchFile(sessionId, normalized);
        setFileContent(content);
        setSelectedPath(normalized);
      } catch {
        setFileContent("// Failed to load file");
      } finally {
        setLoadingFile(false);
      }
    },
    [sessionId],
  );

  const ensurePreviewRunning = useCallback(
    async (force = false) => {
      if (!force && ensureRef.current) {
        setPreviewLoading(true);
        return ensureRef.current;
      }

      const task = (async () => {
        setPreviewLoading(true);
        setPreviewError(null);
        try {
          const result = await ensurePreview(sessionId);
          if (result.preview_url) {
            onPreviewUrl?.(result.preview_url);
            if (iframeRef.current) {
              // ponytail: force iframe reload even when URL unchanged
              iframeRef.current.src = "";
              iframeRef.current.src = result.preview_url;
            }
          } else if (result.status === "error") {
            onPreviewUrl?.(null);
            setPreviewError(result.output ?? "Failed to start dev server");
          } else if (result.status === "no_sandbox") {
            setPreviewError("Sandbox not ready yet");
          }
        } catch (e) {
          setPreviewError(e instanceof Error ? e.message : "Failed to load preview");
        } finally {
          setPreviewLoading(false);
          ensureRef.current = null;
        }
      })();

      ensureRef.current = task;
      return task;
    },
    [sessionId, onPreviewUrl],
  );

  useEffect(() => {
    if (filePaths.length) {
      if (!selectedPath || !filePaths.includes(selectedPath)) {
        const preferred =
          filePaths.find((p) => p === "src/App.tsx") ??
          filePaths.find((p) => p === "main.py") ??
          filePaths.find((p) => p.endsWith(".tsx") || p.endsWith(".jsx")) ??
          filePaths.find((p) => p.endsWith(".py")) ??
          filePaths.find((p) => p.includes("/") && !p.split("/").some((s) => s.startsWith("."))) ??
          filePaths.find((p) => p.includes(".")) ??
          filePaths[0];
        if (preferred) void loadFile(preferred);
      } else {
        // Reload currently open file so latest code created by AI appears immediately
        void loadFile(selectedPath);
      }
    }
  }, [filePaths, selectedPath, loadFile]);

  useEffect(() => {
    if (previewUrl && iframeRef.current) {
      iframeRef.current.src = previewUrl;
    }
  }, [previewUrl]);

  useEffect(() => {
    if (activeTab !== "demo") return;
    if (filePaths.length === 0) return;
    // ponytail: tab switch only fetches when we have no URL yet; use reload for re-check
    if (previewUrl) return;
    void ensurePreviewRunning();
  }, [activeTab, filePaths.length, previewUrl, ensurePreviewRunning]);

  useEffect(() => {
    ensureRef.current = null;
  }, [sessionId]);

  const tree = buildFileTree(filePaths);

  const FileTreeNode = ({ node, depth = 0 }: { node: FileNode; depth?: number }) => {
    const isCollapsed = collapsed.has(node.path);

    if (node.type === "file") {
      return (
        <button
          onClick={() => loadFile(node.path)}
          className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors ${
            selectedPath === node.path
              ? "bg-foreground/10 text-black/80"
              : "text-muted-foreground hover:bg-foreground/10"
          }`}
          style={{ paddingLeft: `${depth * 16 + 24}px` }}
        >
          <File className="h-4 w-4 shrink-0" />
          <span className="truncate text-left text-[13px]">{node.name}</span>
        </button>
      );
    }

    return (
      <div>
        <button
          onClick={() =>
            setCollapsed((prev) => {
              const next = new Set(prev);
              if (next.has(node.path)) next.delete(node.path);
              else next.add(node.path);
              return next;
            })
          }
          className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-sm text-muted-foreground hover:bg-foreground/10"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          )}
          <Folder className="h-4 w-4 shrink-0" />
          <span className="truncate text-left text-[13px]">{node.name}</span>
        </button>
        {!isCollapsed &&
          node.children?.map((child, i) => (
            <FileTreeNode key={i} node={child} depth={depth + 1} />
          ))}
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l border-[#e8e2d8] bg-white">
      <ResizablePanelGroup direction="vertical" className="h-full min-h-0">
        <ResizablePanel defaultSize={72} minSize={35} className="min-h-0">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex h-full min-h-0 flex-col overflow-hidden"
          >
            <div className="flex h-12 shrink-0 items-center border-b border-[#eee9e1] px-4">
              <TabsList className="h-9 bg-[#f5f1ea]">
                <TabsTrigger value="code" className="gap-2">
                  <Code className="h-4 w-4" />
                  Code
                </TabsTrigger>
                <TabsTrigger value="demo" className="gap-2">
                  <Monitor className="h-4 w-4" />
                  Demo
                </TabsTrigger>
              </TabsList>
            </div>

            {activeTab === "demo" && previewUrl && (
              <div className="shrink-0 border-b border-[#eee9e1] bg-[#faf8f5] px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-lg border bg-white px-3 py-2">
                    <Globe className="h-4 w-4 shrink-0 text-gray-500" />
                    <span className="flex-1 truncate font-mono text-sm">{previewUrl}</span>
                  </div>
                  <button
                    onClick={() => void ensurePreviewRunning(true)}
                    disabled={previewLoading}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
                    title="Refresh preview"
                  >
                    <RefreshCw className={`h-4 w-4 ${previewLoading ? "animate-spin" : ""}`} />
                  </button>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border bg-white hover:bg-gray-50"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}

            <TabsContent value="code" className="m-0 flex min-h-0 flex-1 overflow-hidden">
              <div className="flex w-56 shrink-0 flex-col overflow-hidden border-r border-[#eee9e1] bg-[#faf8f5]">
                <div className="shrink-0 flex items-center justify-between border-b border-[#eee9e1] px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#c6623f]/80">
                    Files
                  </span>
                  <button
                    onClick={() => setIsImportOpen(true)}
                    className="flex items-center gap-1 text-[11px] font-medium text-[#5c5348] hover:text-[#c6623f] transition"
                    title="Importer un dossier local ou un dépôt GitHub"
                  >
                    <FolderDown className="h-3.5 w-3.5" />
                    <span>Importer</span>
                  </button>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-0.5 p-2">
                    {tree.length ? (
                      tree.map((node, i) => <FileTreeNode key={i} node={node} depth={0} />)
                    ) : (
                      <p className="px-2 py-4 text-xs text-muted-foreground">
                        Files appear as the agent edits the project
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {selectedPath ? (
                  <>
                    <div className="shrink-0 flex items-center justify-between border-b bg-muted/20 px-4 py-2">
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4 text-[#c6623f]" />
                        <span className="font-mono text-sm font-medium text-foreground">
                          {selectedPath}
                        </span>
                      </div>
                      <span className="rounded bg-[#eee9e1]/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground uppercase">
                        {selectedPath.endsWith(".tsx") || selectedPath.endsWith(".ts")
                          ? "TypeScript React"
                          : selectedPath.endsWith(".py")
                            ? "Python"
                            : selectedPath.endsWith(".css")
                              ? "CSS"
                              : selectedPath.endsWith(".json")
                                ? "JSON"
                                : selectedPath.endsWith(".html")
                                  ? "HTML"
                                  : "Text"}
                      </span>
                    </div>
                    <div className="min-h-0 flex-1">
                      {loadingFile ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          Loading...
                        </div>
                      ) : (
                        <MonacoEditor
                          height="100%"
                          language={
                            selectedPath.endsWith(".tsx") || selectedPath.endsWith(".ts")
                              ? "typescript"
                              : selectedPath.endsWith(".py")
                                ? "python"
                                : selectedPath.endsWith(".css")
                                  ? "css"
                                  : selectedPath.endsWith(".json")
                                    ? "json"
                                    : selectedPath.endsWith(".html")
                                      ? "html"
                                      : selectedPath.endsWith(".js") || selectedPath.endsWith(".jsx")
                                        ? "javascript"
                                        : "plaintext"
                          }
                          value={fileContent}
                          options={{
                            readOnly: true,
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineNumbers: "on",
                            scrollBeyondLastLine: false,
                          }}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-muted-foreground">
                    <p>Select a file from the tree</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="demo" className="relative m-0 min-h-0 flex-1 overflow-hidden">
              {previewUrl ? (
                <>
                  <iframe
                    ref={iframeRef}
                    src={previewUrl}
                    className="h-full w-full border-0"
                    title="Preview"
                  />
                  {previewLoading && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 text-muted-foreground">
                      <Loader2 className="mb-3 h-10 w-10 animate-spin opacity-40" />
                      <p>Starting dev server...</p>
                    </div>
                  )}
                  {previewError && !previewLoading && (
                    <p className="absolute bottom-4 left-1/2 z-10 max-w-md -translate-x-1/2 rounded border border-red-200 bg-white px-3 py-2 text-xs text-red-600">
                      {previewError}
                    </p>
                  )}
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <div className="space-y-3 text-center">
                    {previewLoading ? (
                      <>
                        <Loader2 className="mx-auto h-10 w-10 animate-spin opacity-40" />
                        <p>Starting dev server...</p>
                      </>
                    ) : (
                      <>
                        <Monitor className="mx-auto h-12 w-12 opacity-20" />
                        <p>
                          {filePaths.length === 0
                            ? "Preview will appear once the project is ready"
                            : "Could not load preview"}
                        </p>
                      </>
                    )}
                    {previewError && (
                      <p className="max-w-md text-xs text-red-600">{previewError}</p>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={28} minSize={15} className="min-h-0">
          <div className="flex h-full min-h-0 flex-col overflow-hidden border-t border-[#eee9e1] bg-white">
            <div className="flex shrink-0 items-center gap-2 border-b border-[#eee9e1] px-3 py-2">
              <TerminalIcon className="h-3.5 w-3.5 text-[#8a8278]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8a8278]">
                Console
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <Terminal sessionId={sessionId} />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <ImportRepoModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        sessionId={sessionId}
        onImportSuccess={() => {
          onRefreshFiles?.();
        }}
      />
    </div>
  );
}
