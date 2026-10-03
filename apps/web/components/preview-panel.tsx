"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ensurePreview, fetchFile } from "@/lib/api";
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
  RefreshCw,
  ExternalLink,
  Terminal as TerminalIcon,
  Loader2,
  Smartphone,
  Tablet,
  Laptop,
  Columns,
  FolderTree,
  PanelLeftClose,
  PanelLeftOpen,
  PanelBottomClose,
} from "lucide-react";
import { Terminal } from "@/components/terminal";
import { ImportRepoModal } from "@/components/import-repo-modal";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
      Chargement de l&apos;éditeur de code...
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
  providerId?: string;
  onPreviewUrl?: (url: string | null) => void;
  onRefreshFiles?: () => void;
}

export function PreviewPanel({
  sessionId,
  previewUrl,
  filePaths,
  providerId,
  onPreviewUrl,
  onRefreshFiles,
}: PreviewPanelProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [activeMode, setActiveMode] = useState<"code" | "demo" | "split">("code");
  const [showFileExplorer, setShowFileExplorer] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [loadingFile, setLoadingFile] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
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
        setFileContent("// Échec du chargement du fichier");
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
              iframeRef.current.src = "";
              iframeRef.current.src = result.preview_url;
            }
          } else if (result.status === "error") {
            onPreviewUrl?.(null);
            setPreviewError(result.output ?? "Échec du démarrage du serveur");
          } else if (result.status === "no_sandbox") {
            setPreviewError("Sandbox en cours d'initialisation...");
          }
        } catch (e) {
          setPreviewError(e instanceof Error ? e.message : "Erreur chargement aperçu");
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
    if (activeMode === "code") return;
    if (filePaths.length === 0) return;
    if (previewUrl) return;
    void ensurePreviewRunning();
  }, [activeMode, filePaths.length, previewUrl, ensurePreviewRunning]);

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
              ? "bg-[#3d3830] text-white font-medium"
              : "text-[#5c5348] hover:bg-[#eee9e1]/60 hover:text-[#3d3830]"
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <File className={`h-3.5 w-3.5 shrink-0 ${selectedPath === node.path ? "text-white" : "text-[#c6623f]"}`} />
          <span className="truncate text-left text-[13px]">{node.name}</span>
        </button>
      );
    }

    return (
      <div>
        <button
          onClick={() => {
            setCollapsed((prev) => {
              const next = new Set(prev);
              if (next.has(node.path)) next.delete(node.path);
              else next.add(node.path);
              return next;
            });
          }}
          className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-sm text-[#5c5348] hover:bg-[#eee9e1]/60 hover:text-[#3d3830] transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          )}
          <Folder className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span className="truncate text-left text-[13px] font-medium">{node.name}</span>
        </button>
        {!isCollapsed &&
          node.children?.map((child, i) => (
            <FileTreeNode key={i} node={child} depth={depth + 1} />
          ))}
      </div>
    );
  };

  const renderCodeEditor = () => (
    <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      {/* Collapsible File Explorer Sidebar */}
      {showFileExplorer && (
        <div className="flex w-56 shrink-0 flex-col overflow-hidden border-r border-[#eee9e1] bg-[#faf8f5]">
          <div className="shrink-0 flex items-center justify-between border-b border-[#eee9e1] px-3 py-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#c6623f]">
              <FolderTree className="h-3.5 w-3.5" />
              <span>Explorateur</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsImportOpen(true)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-[#5c5348] hover:bg-[#eee9e1] hover:text-[#c6623f] transition"
                title="Importer un projet ou dépôt GitHub"
              >
                <FolderDown className="h-3.5 w-3.5" />
                <span>Importer</span>
              </button>
              <button
                onClick={() => setShowFileExplorer(false)}
                className="rounded p-1 text-gray-400 hover:bg-[#eee9e1] hover:text-gray-700 transition"
                title="Masquer l'explorateur pour agrandir l'éditeur"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-0.5 p-2">
              {tree.length ? (
                tree.map((node, i) => <FileTreeNode key={i} node={node} depth={0} />)
              ) : (
                <div className="px-2 py-4 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {providerId === "github-codespaces" || providerId === "github-repository"
                      ? "Synchronisation du Workspace distant..."
                      : "Aucun fichier dans ce workspace."}
                  </p>
                  {onRefreshFiles && (
                    <button
                      type="button"
                      onClick={() => onRefreshFiles()}
                      className="text-[11px] font-semibold text-[#c6623f] hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Actualiser les fichiers</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Monaco Code Editor Area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
        {selectedPath ? (
          <>
            <div className="shrink-0 flex items-center justify-between border-b border-[#eee9e1] bg-[#faf8f5] px-4 py-2">
              <div className="flex items-center gap-2 min-w-0">
                {!showFileExplorer && (
                  <button
                    onClick={() => setShowFileExplorer(true)}
                    className="mr-1 rounded p-1 text-gray-500 hover:bg-[#eee9e1] hover:text-[#c6623f] transition"
                    title="Afficher l'explorateur de fichiers"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                )}
                <File className="h-4 w-4 shrink-0 text-[#c6623f]" />
                <span className="font-mono text-xs sm:text-sm font-semibold text-[#3d3830] truncate">
                  {selectedPath}
                </span>
              </div>
              <span className="rounded bg-[#eee9e1]/70 px-2 py-0.5 font-mono text-[10px] font-bold text-[#5c5348] uppercase tracking-wider">
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
                  Chargement du fichier...
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
                    fontSize: 13,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    theme: "vs-light",
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground p-6 text-center">
            <Code className="h-10 w-10 text-gray-300 mb-2" />
            <p className="text-sm font-medium">Sélectionnez un fichier dans l&apos;explorateur</p>
            {!showFileExplorer && (
              <button
                onClick={() => setShowFileExplorer(true)}
                className="mt-3 flex items-center gap-1.5 rounded-lg border border-[#e5e0d8] bg-white px-3 py-1.5 text-xs font-semibold text-[#3d3830] hover:bg-[#faf8f5]"
              >
                <PanelLeftOpen className="h-3.5 w-3.5 text-[#c6623f]" />
                <span>Ouvrir l&apos;explorateur de fichiers</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderLiveDemo = () => (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f0ede6]">
      <div className="relative m-0 min-h-0 flex-1 overflow-auto p-0 sm:p-4">
        {previewUrl ? (
          <div className="flex h-full w-full items-center justify-center">
            <div
              className={`relative transition-all duration-300 bg-white ${
                deviceMode === "mobile"
                  ? "h-[667px] w-[375px] max-h-full max-w-full rounded-3xl border-8 border-[#3d3830] shadow-2xl overflow-hidden"
                  : deviceMode === "tablet"
                    ? "h-[900px] w-[768px] max-h-full max-w-full rounded-2xl border-8 border-[#3d3830] shadow-2xl overflow-hidden"
                    : "h-full w-full shadow-md"
              }`}
            >
              <iframe
                ref={iframeRef}
                src={previewUrl}
                className="h-full w-full border-0 bg-white"
                title="Live Application Preview"
              />
              {previewLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 text-muted-foreground">
                  <Loader2 className="mb-3 h-10 w-10 animate-spin text-[#c6623f]" />
                  <p className="text-xs font-semibold">Démarrage du serveur dev...</p>
                </div>
              )}
              {previewError && !previewLoading && (
                <p className="absolute bottom-4 left-1/2 z-10 max-w-md -translate-x-1/2 rounded border border-red-200 bg-white px-3 py-2 text-xs text-red-600 shadow">
                  {previewError}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="space-y-3 text-center">
              {previewLoading ? (
                <>
                  <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#c6623f]" />
                  <p className="text-sm font-medium">Compilation & lancement de l&apos;application...</p>
                </>
              ) : (
                <>
                  <Monitor className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="text-sm">
                    {filePaths.length === 0
                      ? "L'aperçu apparaîtra dès que le projet sera généré."
                      : "Aperçu en attente"}
                  </p>
                  <button
                    onClick={() => void ensurePreviewRunning(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e0d8] bg-white px-3 py-1.5 text-xs font-semibold text-[#3d3830] hover:bg-[#faf8f5]"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-[#c6623f]" />
                    <span>Lancer le serveur de preview</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l border-[#e8e2d8] bg-white">
      {/* Unified Single Header Bar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[#eee9e1] bg-[#faf8f5] px-3 sm:px-4">
        {/* Mode Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-[#eee9e1] p-0.5">
            <button
              onClick={() => setActiveMode("code")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                activeMode === "code"
                  ? "bg-white text-[#3d3830] shadow-xs"
                  : "text-[#5c5348] hover:text-[#3d3830]"
              }`}
              title="Afficher l'éditeur de code Monaco"
            >
              <Code className="h-3.5 w-3.5 text-[#c6623f]" />
              <span>Code</span>
            </button>
            <button
              onClick={() => setActiveMode("demo")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                activeMode === "demo"
                  ? "bg-white text-[#3d3830] shadow-xs"
                  : "text-[#5c5348] hover:text-[#3d3830]"
              }`}
              title="Afficher l'aperçu Live Web"
            >
              <Monitor className="h-3.5 w-3.5 text-emerald-600" />
              <span>Aperçu Live</span>
            </button>
            <button
              onClick={() => setActiveMode("split")}
              className={`hidden sm:flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                activeMode === "split"
                  ? "bg-white text-[#3d3830] shadow-xs"
                  : "text-[#5c5348] hover:text-[#3d3830]"
              }`}
              title="Afficher le Code et l'Aperçu côte à côte"
            >
              <Columns className="h-3.5 w-3.5 text-blue-600" />
              <span>Split View</span>
            </button>
          </div>

          {/* Device Switcher (when Demo or Split is active) */}
          {(activeMode === "demo" || activeMode === "split") && previewUrl && (
            <div className="hidden md:flex items-center rounded-lg bg-[#eee9e1] p-0.5 ml-1">
              <button
                onClick={() => setDeviceMode("desktop")}
                className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
                  deviceMode === "desktop"
                    ? "bg-white text-[#3d3830] shadow-xs"
                    : "text-gray-500 hover:text-[#3d3830]"
                }`}
                title="Vue Bureau"
              >
                <Laptop className="h-3 w-3" />
              </button>
              <button
                onClick={() => setDeviceMode("tablet")}
                className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
                  deviceMode === "tablet"
                    ? "bg-white text-[#3d3830] shadow-xs"
                    : "text-gray-500 hover:text-[#3d3830]"
                }`}
                title="Vue Tablette (768px)"
              >
                <Tablet className="h-3 w-3" />
              </button>
              <button
                onClick={() => setDeviceMode("mobile")}
                className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
                  deviceMode === "mobile"
                    ? "bg-white text-[#3d3830] shadow-xs"
                    : "text-gray-500 hover:text-[#3d3830]"
                }`}
                title="Vue Mobile (375px)"
              >
                <Smartphone className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-1.5">
          {/* File Explorer Toggle (only in Code / Split view) */}
          {(activeMode === "code" || activeMode === "split") && (
            <button
              onClick={() => setShowFileExplorer((v) => !v)}
              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition ${
                showFileExplorer
                  ? "border-[#c6623f]/40 bg-[#c6623f]/10 text-[#c6623f]"
                  : "border-[#e5e0d8] bg-white text-[#5c5348] hover:bg-[#faf8f5]"
              }`}
              title={showFileExplorer ? "Masquer l'explorateur" : "Afficher l'explorateur"}
            >
              <FolderTree className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Fichiers</span>
            </button>
          )}

          {/* Terminal Toggle */}
          <button
            onClick={() => setShowTerminal((v) => !v)}
            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition ${
              showTerminal
                ? "border-[#3d3830]/40 bg-[#3d3830]/10 text-[#3d3830]"
                : "border-[#e5e0d8] bg-white text-[#5c5348] hover:bg-[#faf8f5]"
            }`}
            title={showTerminal ? "Masquer la console" : "Afficher la console"}
          >
            <TerminalIcon className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Console</span>
          </button>

          {/* Refresh / Popout for Demo */}
          {previewUrl && (
            <>
              <button
                onClick={() => void ensurePreviewRunning(true)}
                disabled={previewLoading}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e0d8] bg-white text-[#5c5348] hover:bg-gray-50 disabled:opacity-50 transition"
                title="Recompiler et rafraîchir l'aperçu"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${previewLoading ? "animate-spin text-[#c6623f]" : ""}`} />
              </button>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e0d8] bg-white text-[#5c5348] hover:bg-gray-50 transition"
                title="Ouvrir dans un nouvel onglet"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </>
          )}
        </div>
      </div>

      {/* Main Content: Editor / Preview / Split + Resizable Terminal */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {showTerminal ? (
          <ResizablePanelGroup direction="vertical" className="h-full min-h-0">
            <ResizablePanel defaultSize={72} minSize={30} className="min-h-0">
              {activeMode === "code" && renderCodeEditor()}
              {activeMode === "demo" && renderLiveDemo()}
              {activeMode === "split" && (
                <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
                  <ResizablePanel defaultSize={50} minSize={25} className="min-w-0">
                    {renderCodeEditor()}
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={50} minSize={25} className="min-w-0">
                    {renderLiveDemo()}
                  </ResizablePanel>
                </ResizablePanelGroup>
              )}
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={28} minSize={15} className="min-h-0">
              <div className="flex h-full min-h-0 flex-col overflow-hidden border-t border-[#eee9e1] bg-white">
                <div className="flex shrink-0 items-center justify-between border-b border-[#eee9e1] bg-[#faf8f5] px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <TerminalIcon className="h-3.5 w-3.5 text-[#c6623f]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#3d3830]">
                      Console Terminal & Dev Server
                    </span>
                  </div>
                  <button
                    onClick={() => setShowTerminal(false)}
                    className="rounded p-1 text-gray-400 hover:bg-[#eee9e1] hover:text-gray-700"
                    title="Masquer la console"
                  >
                    <PanelBottomClose className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  <Terminal
                    sessionId={sessionId}
                    providerId={providerId}
                    onPortDetected={(port) => {
                      if (port) {
                        onPreviewUrl?.(`/api/preview/${sessionId}`);
                      }
                    }}
                  />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="h-full min-h-0">
            {activeMode === "code" && renderCodeEditor()}
            {activeMode === "demo" && renderLiveDemo()}
            {activeMode === "split" && (
              <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
                <ResizablePanel defaultSize={50} minSize={25} className="min-w-0">
                  {renderCodeEditor()}
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50} minSize={25} className="min-w-0">
                  {renderLiveDemo()}
                </ResizablePanel>
              </ResizablePanelGroup>
            )}
          </div>
        )}
      </div>

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
