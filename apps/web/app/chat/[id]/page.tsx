"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { use } from "react";
import {
  abortSession,
  getSession,
  listSessionFiles,
  sendMessage,
  streamRun,
} from "@/lib/api";
import {
  appendAssistantText,
  appendAssistantTool,
  updateAssistantTool,
} from "@/lib/chat-blocks";
import type { AgentEvent, ChatMessage, GetSessionResponse } from "@/lib/types";
import { ChatPanel } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { LiveVoiceModal } from "@/components/live-voice-modal";
import { ImportRepoModal } from "@/components/import-repo-modal";
import { AppSidebar } from "@/components/app-sidebar";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { DEFAULT_MODEL_ID } from "@/lib/providers";
import { MessageSquare, Code2, Menu, Loader2, Check, AlertCircle, Cloud, FolderTree, Terminal as TerminalIcon, Monitor } from "lucide-react";
import { Terminal } from "@/components/terminal";

function formatMessages(
  messages: GetSessionResponse["messages"],
): ChatMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    blocks: m.blocks,
  }));
}

function normalizeFilePath(path: string): string {
  return path
    .replace(/^\/home\/user\//, "")
    .replace(/^home\/user\//, "")
    .replace(/^\.\//, "");
}

function isProjectFile(path: string): boolean {
  const parts = normalizeFilePath(path).split("/").filter(Boolean);
  return parts.length > 0 && !parts.some((p) => p.startsWith("."));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

import { EnvironmentType, ProviderId } from "@/components/sandbox-selector";

export default function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = use(params);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [sessionTitle, setSessionTitle] = useState<string>("Session");
  const [currentModel, setCurrentModel] = useState<string>(DEFAULT_MODEL_ID);
  const [currentAgent, setCurrentAgent] = useState<string>("build");
  const [currentEnvironment, setCurrentEnvironment] = useState<EnvironmentType>("sandbox");
  const [currentProvider, setCurrentProvider] = useState<ProviderId>("e2b");
  const [workspaceState, setWorkspaceState] = useState<
    "NO_WORKSPACE" | "WORKSPACE_LOADING" | "WORKSPACE_READY" | "WORKSPACE_ERROR"
  >("WORKSPACE_READY");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceDetails, setWorkspaceDetails] = useState<{
    repository?: string;
    branch?: string;
    codespaceId?: string;
  }>({});
  const [isLiveOpen, setIsLiveOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"files" | "code" | "chat" | "terminal" | "preview">("chat");

  const genRef = useRef(0);
  const textBufferRef = useRef("");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshFiles = useCallback(async () => {
    const paths = (await listSessionFiles(sessionId)).filter(isProjectFile);
    if (paths.length) {
      setFilePaths(paths.map(normalizeFilePath));
    }
  }, [sessionId]);

  const initWorkspace = useCallback(async (overrides?: {
    codespaceId?: string;
    repository?: string;
    branch?: string;
    providerId?: ProviderId;
  }) => {
    setWorkspaceState("WORKSPACE_LOADING");
    setWorkspaceError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/init-workspace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overrides || {}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Impossible d'initialiser le Workspace");
      }
      setWorkspaceState("WORKSPACE_READY");
      if (Array.isArray(data.paths)) {
        setFilePaths(data.paths.filter(isProjectFile).map(normalizeFilePath));
      }
    } catch (err: any) {
      setWorkspaceState("WORKSPACE_ERROR");
      setWorkspaceError(err?.message || "Erreur de connexion au Workspace");
    }
  }, [sessionId]);

  const flushText = useCallback((gen: number) => {
    const delta = textBufferRef.current;
    if (!delta) return;
    textBufferRef.current = "";

    setMessages((prev) => {
      if (gen !== genRef.current) return prev;
      return appendAssistantText(prev, delta);
    });
  }, []);

  const scheduleFlush = useCallback(
    (gen: number) => {
      if (flushTimerRef.current) return;
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        flushText(gen);
      }, 30);
    },
    [flushText],
  );

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await getSession(sessionId);
        if (!mounted) return;
        setMessages(formatMessages(data.messages));
        setPreviewUrl(data.preview_url);
        setSessionTitle(data.title || "Session");
        if (data.environment) {
          setCurrentEnvironment(data.environment as EnvironmentType);
        }
        if (data.providerId) {
          setCurrentProvider(data.providerId as ProviderId);
        }
        const details = {
          repository: data.repository,
          branch: data.branch,
          codespaceId: data.codespaceId,
        };
        setWorkspaceDetails(details);

        const paths = (await listSessionFiles(sessionId)).filter(isProjectFile);

        // Auto-initialize remote workspace if files are empty
        const isRemote =
          (data.providerId === "github-codespaces" || data.providerId === "github-repository") &&
          Boolean(data.repository || data.codespaceId);

        if (isRemote && paths.length === 0) {
          void initWorkspace({
            ...details,
            providerId: data.providerId as ProviderId,
          });
        } else {
          setWorkspaceState((data.workspaceState as "NO_WORKSPACE" | "WORKSPACE_LOADING" | "WORKSPACE_READY" | "WORKSPACE_ERROR") || "WORKSPACE_READY");
          if (paths.length) {
            setFilePaths(paths.map(normalizeFilePath));
          }
        }
      } catch (e) {
        console.error("Failed to load session:", e);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [sessionId, initWorkspace]);

  const handleEnvironmentAndProviderChange = async (
    newEnv: EnvironmentType,
    newProviderId: ProviderId
  ) => {
    setCurrentEnvironment(newEnv);
    setCurrentProvider(newProviderId);
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment: newEnv, providerId: newProviderId }),
      });
    } catch (e) {
      console.error("Failed to switch environment/provider:", e);
    }
  };

  const runStream = useCallback(
    async (messageContent?: string) => {
      const gen = ++genRef.current;
      setLoading(true);
      setStatus("Starting agent...");

      const handleEvent = (ev: AgentEvent) => {
        if (gen !== genRef.current) return;

        if (ev.type === "status") {
          const cleanStatus = (ev.message || "").replace(/\s+/g, " ").trim();
          if (cleanStatus) {
            setStatus(cleanStatus);
          }
        } else if (ev.type === "text" && ev.delta) {
          textBufferRef.current += ev.delta;
          scheduleFlush(gen);
        } else if (ev.type === "tool_start") {
          flushText(gen);
          setMessages((prev) =>
            appendAssistantTool(prev, {
              id: ev.id,
              name: ev.name,
              input: ev.input,
              status: "running",
            }),
          );
        } else if (ev.type === "tool_end") {
          flushText(gen);
          setMessages((prev) =>
            updateAssistantTool(prev, ev.id, {
              output: ev.output,
              isError: Boolean(ev.isError),
              status: ev.isError ? "error" : "done",
            }),
          );
          void refreshFiles();
        } else if (ev.type === "preview" && ev.url) {
          setPreviewUrl(ev.url);
        } else if (ev.type === "files_changed") {
          void refreshFiles();
        }
      };

      try {
        if (messageContent) {
          const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content: messageContent,
          };
          setMessages((prev) => [...prev, userMsg]);
          await sendMessage(sessionId, messageContent, handleEvent, currentModel, currentAgent);
        } else {
          await streamRun(sessionId, handleEvent);
        }
      } catch (e) {
        console.error("Stream failed:", e);
        if (gen === genRef.current) {
          setStatus("Connection lost. Polling for updates...");
          for (let i = 0; i < 30; i++) {
            await sleep(2000);
            if (gen !== genRef.current) break;
            try {
              const s = await getSession(sessionId);
              setMessages(formatMessages(s.messages));
              setPreviewUrl(s.preview_url);
              setSessionTitle(s.title || "Session");
              await refreshFiles();
            } catch {
              // ignore retry error
            }
          }
        }
      } finally {
        if (gen === genRef.current) {
          flushText(gen);
          setLoading(false);
          setStatus(null);
          await refreshFiles();
          try {
            const finalSession = await getSession(sessionId);
            setMessages(formatMessages(finalSession.messages));
            setPreviewUrl(finalSession.preview_url);
            setSessionTitle(finalSession.title || "Session");
          } catch {
            // ignore
          }
        }
      }
    },
    [sessionId, currentModel, currentAgent, refreshFiles, scheduleFlush, flushText],
  );

  const handleSendMessage = (content: string) => {
    void runStream(content);
  };

  const handleAbort = () => {
    void abortSession(sessionId);
    genRef.current++;
    setLoading(false);
    setStatus(null);
  };

  return (
    <div className="flex h-screen h-[100dvh] w-full overflow-hidden bg-white">
      {/* App Sidebar with Mobile Drawer support */}
      <AppSidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Workspace Loading Overlay */}
        {workspaceState === "WORKSPACE_LOADING" && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#faf8f5]/95 backdrop-blur-sm p-6 text-center space-y-4 animate-in fade-in">
            <Loader2 className="h-10 w-10 text-[#c6623f] animate-spin" />
            <div className="space-y-1.5 max-w-md">
              <h2 className="text-base font-bold text-slate-900">
                Connexion au GitHub Codespace & Initialisation...
              </h2>
              {workspaceDetails.repository && (
                <p className="text-xs font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                  {workspaceDetails.repository} {workspaceDetails.branch ? `(${workspaceDetails.branch})` : ""}
                </p>
              )}
              {workspaceDetails.codespaceId && (
                <p className="text-[11px] text-slate-500 font-mono">
                  Machine: {workspaceDetails.codespaceId}
                </p>
              )}
              <div className="space-y-2 text-xs text-slate-600 pt-3 text-left bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                  <Check className="h-3.5 w-3.5" />
                  <span>Authentification GitHub vérifiée</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                  <Check className="h-3.5 w-3.5" />
                  <span>Codespace distant identifié</span>
                </div>
                <div className="flex items-center gap-2 text-slate-900 font-semibold">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#c6623f]" />
                  <span>Chargement du Remote Filesystem & de l&apos;arborescence...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Workspace Error Overlay */}
        {workspaceState === "WORKSPACE_ERROR" && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white p-6 text-center space-y-4 animate-in fade-in">
            <div className="rounded-full bg-red-100 p-3 text-red-600">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div className="space-y-1 max-w-md">
              <h2 className="text-base font-bold text-slate-900">
                Impossible de connecter le Codespace
              </h2>
              <p className="text-xs text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200 leading-relaxed">
                {workspaceError || "Échec d'initialisation du Workspace distant."}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void initWorkspace(workspaceDetails)}
                className="py-2 px-4 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm cursor-pointer"
              >
                Réessayer la connexion
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceState("WORKSPACE_READY")}
                className="py-2 px-3 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Ignorer et continuer
              </button>
            </div>
          </div>
        )}
        {/* Mobile / Tablet View Switcher Header (< lg) */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#eee9e1] bg-[#faf8f5] px-3 lg:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#e5e0d8] bg-white text-[#3d3830] active:bg-[#f5f1ea]"
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="max-w-[120px] truncate text-xs font-semibold text-[#3d3830]">
              {sessionTitle}
            </span>
          </div>

          {/* Segmented Control: Chat vs Code */}
          <div className="flex items-center rounded-lg bg-[#eee9e1] p-0.5 text-xs font-medium">
            <button
              onClick={() => setMobileTab("chat")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition ${
                mobileTab === "chat"
                  ? "bg-white text-[#3d3830] shadow-sm font-semibold"
                  : "text-[#5c5348] hover:text-[#3d3830]"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => setMobileTab("preview")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition ${
                mobileTab === "preview"
                  ? "bg-white text-[#3d3830] shadow-sm font-semibold"
                  : "text-[#5c5348] hover:text-[#3d3830]"
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>Code & Démo</span>
              {filePaths.length > 0 && (
                <span className="rounded-full bg-[#c6623f] px-1 py-0.2 text-[9px] font-bold text-white">
                  {filePaths.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5" />
        </div>

        {/* Desktop Layout (>= lg): Split Resizable Panels */}
        <div className="hidden lg:flex min-h-0 flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
            <ResizablePanel defaultSize={45} minSize={25} className="min-w-0">
              <ChatPanel
                sessionId={sessionId}
                filePaths={filePaths}
                messages={messages}
                loading={loading}
                status={status}
                sessionTitle={sessionTitle}
                currentModelId={currentModel}
                currentAgentId={currentAgent}
                currentEnvironment={currentEnvironment}
                currentProviderId={currentProvider}
                onModelChange={setCurrentModel}
                onAgentChange={setCurrentAgent}
                onEnvironmentAndProviderChange={handleEnvironmentAndProviderChange}
                onSendMessage={handleSendMessage}
                onAbort={handleAbort}
                onOpenLive={() => setIsLiveOpen(true)}
                onOpenImport={() => setIsImportOpen(true)}
              />
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={55} minSize={25} className="min-w-0">
              <PreviewPanel
                sessionId={sessionId}
                previewUrl={previewUrl}
                filePaths={filePaths}
                providerId={currentProvider}
                onPreviewUrl={setPreviewUrl}
                onRefreshFiles={refreshFiles}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Mobile / Tablet Layout (< lg): Active Tab Fullscreen + Bottom Navigation */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden pb-14">
          {mobileTab === "chat" && (
            <ChatPanel
              sessionId={sessionId}
              filePaths={filePaths}
              messages={messages}
              loading={loading}
              status={status}
              sessionTitle={sessionTitle}
              currentModelId={currentModel}
              currentAgentId={currentAgent}
              currentEnvironment={currentEnvironment}
              currentProviderId={currentProvider}
              onModelChange={setCurrentModel}
              onAgentChange={setCurrentAgent}
              onEnvironmentAndProviderChange={handleEnvironmentAndProviderChange}
              onSendMessage={handleSendMessage}
              onAbort={handleAbort}
              onOpenLive={() => setIsLiveOpen(true)}
              onOpenImport={() => setIsImportOpen(true)}
            />
          )}
          {(mobileTab === "preview" || mobileTab === "files" || mobileTab === "code") && (
            <PreviewPanel
              sessionId={sessionId}
              previewUrl={previewUrl}
              filePaths={filePaths}
              providerId={currentProvider}
              onPreviewUrl={setPreviewUrl}
              onRefreshFiles={refreshFiles}
            />
          )}
          {mobileTab === "terminal" && (
            <Terminal sessionId={sessionId} providerId={currentProvider} />
          )}
        </div>

        {/* Mobile Bottom Navigation Bar (< lg) */}
        <nav className="flex lg:hidden shrink-0 items-center justify-around border-t border-[var(--border)] bg-[var(--surface-elevated)] h-14 px-2 z-40 fixed bottom-0 left-0 right-0 shadow-lg">
          <button
            onClick={() => setMobileTab("files")}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-semibold transition cursor-pointer ${
              mobileTab === "files" ? "text-[var(--primary)] font-bold" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <FolderTree className="h-5 w-5 mb-0.5" />
            <span>Files</span>
          </button>
          <button
            onClick={() => setMobileTab("code")}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-semibold transition cursor-pointer ${
              mobileTab === "code" ? "text-[var(--primary)] font-bold" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <Code2 className="h-5 w-5 mb-0.5" />
            <span>Code</span>
          </button>
          <button
            onClick={() => setMobileTab("chat")}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-semibold transition cursor-pointer ${
              mobileTab === "chat" ? "text-[var(--primary)] font-bold" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <MessageSquare className="h-5 w-5 mb-0.5" />
            <span>Chat</span>
          </button>
          <button
            onClick={() => setMobileTab("terminal")}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-semibold transition cursor-pointer ${
              mobileTab === "terminal" ? "text-[var(--primary)] font-bold" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <TerminalIcon className="h-5 w-5 mb-0.5" />
            <span>Terminal</span>
          </button>
          <button
            onClick={() => setMobileTab("preview")}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-semibold transition cursor-pointer ${
              mobileTab === "preview" ? "text-[var(--primary)] font-bold" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <Monitor className="h-5 w-5 mb-0.5" />
            <span>Preview</span>
          </button>
        </nav>
      </div>

      <LiveVoiceModal
        isOpen={isLiveOpen}
        onClose={() => setIsLiveOpen(false)}
        sessionId={sessionId}
        messages={messages}
        loading={loading}
        status={status}
        onSendMessage={handleSendMessage}
        onCodeGenerated={async () => {
          await refreshFiles();
        }}
      />

      <ImportRepoModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        sessionId={sessionId}
        onImportSuccess={() => {
          void refreshFiles();
        }}
      />
    </div>
  );
}
