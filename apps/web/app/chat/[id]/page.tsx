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
import { MessageSquare, Code2, Menu, FolderDown } from "lucide-react";
import { LiveButton } from "@/components/live-button";

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
  const [isLiveOpen, setIsLiveOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat");

  const genRef = useRef(0);
  const textBufferRef = useRef("");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshFiles = useCallback(async () => {
    const paths = (await listSessionFiles(sessionId)).filter(isProjectFile);
    if (paths.length) {
      setFilePaths(paths.map(normalizeFilePath));
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
        const paths = (await listSessionFiles(sessionId)).filter(isProjectFile);
        if (mounted && paths.length) {
          setFilePaths(paths.map(normalizeFilePath));
        }
      } catch (e) {
        console.error("Failed to load session:", e);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [sessionId]);

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

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
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

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsImportOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#e5e0d8] bg-white text-[#5c5348] hover:text-[#c6623f]"
              title="Importer un dépôt ou dossier"
            >
              <FolderDown className="h-4 w-4 text-[#c6623f]" />
            </button>
            <LiveButton onClick={() => setIsLiveOpen(true)} />
          </div>
        </div>

        {/* Desktop Layout (>= lg): Split Resizable Panels */}
        <div className="hidden lg:flex min-h-0 flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
            <ResizablePanel defaultSize={45} minSize={25} className="min-w-0">
              <ChatPanel
                messages={messages}
                loading={loading}
                status={status}
                sessionTitle={sessionTitle}
                currentModelId={currentModel}
                currentAgentId={currentAgent}
                onModelChange={setCurrentModel}
                onAgentChange={setCurrentAgent}
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
                onPreviewUrl={setPreviewUrl}
                onRefreshFiles={refreshFiles}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Mobile / Tablet Layout (< lg): Active Tab Fullscreen */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden">
          {mobileTab === "chat" ? (
            <ChatPanel
              messages={messages}
              loading={loading}
              status={status}
              sessionTitle={sessionTitle}
              currentModelId={currentModel}
              currentAgentId={currentAgent}
              onModelChange={setCurrentModel}
              onAgentChange={setCurrentAgent}
              onSendMessage={handleSendMessage}
              onAbort={handleAbort}
              onOpenLive={() => setIsLiveOpen(true)}
              onOpenImport={() => setIsImportOpen(true)}
            />
          ) : (
            <PreviewPanel
              sessionId={sessionId}
              previewUrl={previewUrl}
              filePaths={filePaths}
              onPreviewUrl={setPreviewUrl}
              onRefreshFiles={refreshFiles}
            />
          )}
        </div>
      </div>

      <LiveVoiceModal
        isOpen={isLiveOpen}
        onClose={() => setIsLiveOpen(false)}
        sessionId={sessionId}
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
