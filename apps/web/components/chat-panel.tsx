"use client";

import { useEffect, useRef, useState } from "react";
import { ChatMessage } from "@/lib/types";
import { assistantBlocks } from "@/lib/chat-blocks";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowUp, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ToolStepCard } from "@/components/tool-step-card";
import { ModelSelector } from "@/components/model-selector";
import { DEFAULT_MODEL_ID } from "@/lib/providers";

interface ChatPanelProps {
  messages: ChatMessage[];
  loading: boolean;
  status?: string | null;
  sessionTitle?: string;
  currentModelId?: string;
  onModelChange?: (modelId: string) => void;
  onSendMessage: (content: string) => void;
  onAbort?: () => void;
}

function AssistantTurn({ message }: { message: ChatMessage }) {
  const blocks = assistantBlocks(message);
  if (!blocks.length) return null;

  return (
    <div className="w-full min-w-0 space-y-1">
      {blocks.map((block, i) =>
        block.type === "text" ? (
          <div
            key={`text-${i}`}
            className="chat-prose prose prose-sm prose-stone max-w-none text-[15px] leading-relaxed text-[#3d3830]"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>
          </div>
        ) : (
          <ToolStepCard key={block.step.id} step={block.step} />
        ),
      )}
    </div>
  );
}

export function ChatPanel({
  messages,
  loading,
  status,
  sessionTitle,
  currentModelId = DEFAULT_MODEL_ID,
  onModelChange,
  onSendMessage,
  onAbort,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, status]);

  const handleSubmit = () => {
    if (!input.trim() || loading) return;
    onSendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
      <div className="app-watermark pointer-events-none absolute inset-0" />

      <header className="relative z-10 flex h-12 shrink-0 items-center justify-between border-b border-[#eee9e1] bg-white px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="shrink-0">
            <img src="/logo1.png" alt="CodeForge" className="h-5 w-auto" />
          </Link>
          <h1 className="truncate text-sm font-medium text-[#3d3830]">
            {sessionTitle ?? "Session"}
          </h1>
        </div>
        {loading && onAbort && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAbort}
            className="h-8 gap-1.5 border-[#e5e0d8] text-xs"
          >
            <Square className="h-3 w-3 fill-current" />
            Stop
          </Button>
        )}
      </header>

      <ScrollArea className="relative z-10 min-h-0 flex-1">
        <div className="mx-auto max-w-3xl space-y-8 px-6 py-8 pb-4">
          {messages.map((message) =>
            message.role === "user" ? (
              <div
                key={message.id}
                className="border border-[#e8e2d8] bg-[#f3f1ec] px-4 py-3.5"
              >
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words text-[#3d3830]">
                  {message.content}
                </p>
              </div>
            ) : (
              <div key={message.id} className="min-w-0">
                <AssistantTurn message={message} />
              </div>
            ),
          )}

          {loading && (
            <p className="animate-pulse text-sm text-[#8a8278]">
              {status ?? "Agent is working..."}
            </p>
          )}
          <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
        </div>
      </ScrollArea>

      <div className="relative z-10 shrink-0 border-t border-[#eee9e1] bg-white px-5 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="border border-[#e5e0d8] bg-white px-4 py-3">
            <Textarea
              placeholder="Push it further..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="min-h-[52px] max-h-[160px] min-w-0 flex-1 resize-none border-0 bg-transparent p-0 text-[15px] shadow-none placeholder:text-[#a39e94] focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <ModelSelector
                currentModelId={currentModelId}
                onModelChange={onModelChange ?? (() => {})}
              />
              <Button
                onClick={handleSubmit}
                disabled={!input.trim() || loading}
                size="icon"
                className="h-9 w-9 shrink-0 rounded-none bg-[#3d3830] text-white hover:bg-[#2d2a26]"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
