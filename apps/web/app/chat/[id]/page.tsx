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
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { DEFAULT_MODEL_ID } from "@/lib/providers";

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
  const genRef = useRef(0);
  const textBufferRef = useRef("");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshFiles = useCallback(async () => {
    const paths = (await listSessionFiles(sessionId)).filter(isProjectFile);
    if (paths.length) {
      setFilePaths(paths.map(normalizeFilePath));
    }
  }, [sessionId]);

  const scheduleFileRefresh = useCallback(() => {
    if (fileRefreshTimerRef.current) return;
    fileRefreshTimerRef.current = setTimeout(() => {
      fileRefreshTimerRef.current = null;
      void refreshFiles();
    }, 800);
  }, [refreshFiles]);

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

  const makeEventHandler = useCallback(
    (gen: number) => (event: AgentEvent) => {
      if (gen !== genRef.current) return;

      switch (event.type) {
        case "status":
          setStatus(event.message);
          break;

        case "text":
          setStatus(null);
          textBufferRef.current += event.delta;
          scheduleFlush(gen);
          break;

        case "tool_start":
          setStatus(null);
          flushText(gen);
          setMessages((prev) =>
            appendAssistantTool(prev, {
              id: event.id,
              name: event.name,
              input: event.input,
              status: "running",
            }),
          );
          break;

        case "tool_end":
          setMessages((prev) =>
            updateAssistantTool(prev, event.id, {
              output: event.output,
              isError: event.isError,
              status: event.isError ? "error" : "done",
            }),
          );
          break;

        case "preview":
          setPreviewUrl(event.url);
          break;

        case "files_changed":
          scheduleFileRefresh();
          break;

        case "error":
          setStatus(null);
          flushText(gen);
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `**Error:** ${event.message}`,
            },
          ]);
          break;

        case "done":
          setStatus(null);
          flushText(gen);
          void refreshFiles();
          break;
      }
    },
    [flushText, scheduleFlush, scheduleFileRefresh, refreshFiles],
  );

  const refreshFromServer = useCallback(
    async (gen: number) => {
      const s = await getSession(sessionId);
      if (gen !== genRef.current) return s;
      setSessionTitle(s.title);
      if (s.model) setCurrentModel(s.model);
      setMessages(formatMessages(s.messages));
      await refreshFiles();
      return s;
    },
    [sessionId, refreshFiles],
  );

  const pollUntilDone = useCallback(
    async (gen: number) => {
      while (gen === genRef.current) {
        await sleep(1500);
        const s = await refreshFromServer(gen);
        if (!s.agent_running && !s.needs_run) break;
      }
    },
    [refreshFromServer],
  );

  const runStream = useCallback(
    async (gen: number, mode: "run" | "message", content?: string) => {
      setLoading(true);
      setStatus("Starting agent...");
      const onEvent = makeEventHandler(gen);

      try {
        const result =
          mode === "run"
            ? await streamRun(sessionId, onEvent)
            : await sendMessage(sessionId, content!, onEvent, currentModel);

        if (result === "already_running") {
          setStatus("Agent running...");
          await pollUntilDone(gen);
        }
        // ponytail: blocks persisted in DB via assistant+tool rows; live stream still uses block helpers
      } catch (e) {
        if (gen === genRef.current) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `**Error:** ${e instanceof Error ? e.message : "Agent failed"}`,
            },
          ]);
        }
      } finally {
        if (gen === genRef.current) {
          flushText(gen);
          setLoading(false);
          setStatus(null);
        }
      }
    },
    [sessionId, makeEventHandler, pollUntilDone, flushText, currentModel],
  );

  useEffect(() => {
    const gen = ++genRef.current;

    async function init() {
      try {
        const s = await getSession(sessionId);
        if (gen !== genRef.current) return;

        setSessionTitle(s.title);
        const restored = formatMessages(s.messages);
        setMessages(restored);
        await refreshFiles();

        if (s.needs_run) {
          await runStream(gen, "run");
        } else if (s.agent_running) {
          setLoading(true);
          setStatus("Agent running...");
          await pollUntilDone(gen);
          if (gen === genRef.current) {
            setLoading(false);
            setStatus(null);
          }
        }
      } catch {
        /* session not found */
      }
    }

    void init();

    return () => {
      genRef.current++;
    };
  }, [sessionId, runStream, pollUntilDone, refreshFiles]);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => void refreshFiles(), 4000);
    return () => clearInterval(id);
  }, [loading, refreshFiles]);

  const handleSendMessage = (content: string) => {
    if (!content.trim() || loading) return;
    const gen = genRef.current;
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content },
    ]);
    void runStream(gen, "message", content);
  };

  const handleAbort = () => {
    void abortSession(sessionId);
    genRef.current++;
    setLoading(false);
    setStatus(null);
  };

  return (
    <div className="h-screen overflow-hidden bg-white">
      <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
          <ResizablePanel defaultSize={45} minSize={25} className="min-w-0">
            <ChatPanel
              messages={messages}
              loading={loading}
              status={status}
              sessionTitle={sessionTitle}
              currentModelId={currentModel}
              onModelChange={setCurrentModel}
              onSendMessage={handleSendMessage}
              onAbort={handleAbort}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={55} minSize={25} className="min-w-0">
            <PreviewPanel
              sessionId={sessionId}
              previewUrl={previewUrl}
              filePaths={filePaths}
              onPreviewUrl={setPreviewUrl}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
    </div>
  );
}
