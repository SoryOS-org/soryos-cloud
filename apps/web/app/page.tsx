"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/app-sidebar";
import { createSession } from "@/lib/api";

const EXAMPLES = [
  { icon: "📺", text: "Build a Netflix clone" },
  { icon: "📦", text: "Build an admin dashboard" },
  { icon: "📋", text: "Build a kanban board" },
  { icon: "🛍️", text: "Build a store page" },
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setErrorMessage(null);
    try {
      const session = await createSession(prompt.slice(0, 80), prompt.trim());
      router.push(`/chat/${session.id}`);
    } catch (e) {
      console.error(e);
      setErrorMessage("Failed to create session. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f1ea]">
      <AppSidebar />

      <main className="relative flex min-w-0 flex-1 flex-col items-center justify-center overflow-hidden bg-white p-6">
        <div className="app-watermark pointer-events-none absolute inset-0" />

        <div className="relative z-10 w-full max-w-2xl space-y-10">
          <div className="space-y-3 text-center">
            <img src="/logo1.png" alt="CodeForge" className="mx-auto h-20 w-auto" />
            <p className="text-[15px] text-[#8a8278]">
              AI agent workbench — LangGraph + E2B sandbox
            </p>
          </div>

          <div className="border border-[#e5e0d8] bg-white px-5 py-4">
            <Textarea
              placeholder="What would you like to build?"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[100px] resize-none border-0 bg-transparent p-0 text-[15px] shadow-none placeholder:text-[#a39e94] focus-visible:ring-0"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-[#a39e94]">DeepSeek · Agent</span>
              <Button
                onClick={() => void handleSubmit()}
                disabled={!prompt.trim() || loading}
                size="icon"
                className="h-9 w-9 rounded-none bg-[#3d3830] text-white hover:bg-[#2d2a26]"
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-none border-2 border-white border-t-transparent" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.text}
                onClick={() => setPrompt(ex.text)}
                className="flex items-center gap-2 border border-[#e5e0d8] bg-white px-4 py-2.5 text-sm text-[#5c5348] transition-colors hover:bg-[#faf8f5]"
              >
                <span>{ex.icon}</span>
                <span>{ex.text}</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
