"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { runTerminal } from "@/lib/api";

interface TerminalProps {
  sessionId: string | null;
  providerId?: string;
}

interface TerminalLine {
  type: "input" | "output" | "error";
  content: string;
}

export function Terminal({ sessionId, providerId = "e2b" }: TerminalProps) {
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState("~");
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      type: "output",
      content: "SoryOS-Code Unified Sandbox Terminal\nSupported Providers: ☁️ E2B | ☁️ Vercel Sandbox | ☁️ Google Cloud Run | ☁️ GitHub Codespaces | 💻 Local Machine\nCommands execute through the selected SandboxProvider API contract.",
    },
  ]);
  const [executing, setExecuting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const executeCommand = async (command: string) => {
    if (!sessionId || !command.trim()) return;

    setLines((prev) => [
      ...prev,
      { type: "input", content: `${cwd} $ ${command}` },
    ]);
    setInput("");
    setExecuting(true);

    try {
      const result = await runTerminal(sessionId, command.trim());
      setCwd(result.cwd || "~");
      if (result.output) {
        setLines((prev) => [
          ...prev,
          {
            type: result.isError ? "error" : "output",
            content: result.output,
          },
        ]);
      }
    } catch (error) {
      setLines((prev) => [
        ...prev,
        {
          type: "error",
          content: `Error: ${error instanceof Error ? error.message : "Command failed"}`,
        },
      ]);
    } finally {
      setExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !executing) executeCommand(input);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 font-mono text-sm">
        {lines.map((line, index) => (
          <div
            key={index}
            className={`${
              line.type === "input"
                ? "text-green-600"
                : line.type === "error"
                  ? "text-red-600"
                  : "text-gray-800"
            } whitespace-pre-wrap break-words`}
          >
            {line.content}
          </div>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-[#eee9e1] bg-[#faf8f5] px-3 py-2">
        <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-[#e8e2d8] text-[10px] font-mono text-[#5c5348] font-bold">
          {providerId === "local" ? "💻 Local" : `☁️ Sandbox · ${providerId.toUpperCase()}`}
        </span>
        <span className="font-mono text-sm text-[#5c5348]">{cwd}</span>
        <span className="font-mono text-sm text-emerald-600">$</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={executing || !sessionId}
          placeholder={sessionId ? "Type a command..." : "Waiting for sandbox..."}
          className="flex-1 bg-transparent text-gray-800 font-mono text-sm outline-none disabled:opacity-50"
        />
        {executing && (
          <Loader2 className="h-4 w-4 text-gray-600 animate-spin" />
        )}
      </div>
    </div>
  );
}
