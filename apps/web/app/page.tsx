"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, FolderDown, Menu, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/app-sidebar";
import { createSession } from "@/lib/api";
import { ModelSelector } from "@/components/model-selector";
import { AgentSelector } from "@/components/agent-selector";
import { LiveButton } from "@/components/live-button";
import { LiveVoiceModal } from "@/components/live-voice-modal";
import { ImportRepoModal } from "@/components/import-repo-modal";
import { PWAInstallButton } from "@/components/pwa-install-button";
import { DEFAULT_MODEL_ID } from "@/lib/providers";

const EXAMPLES = [
  { icon: "📺", text: "Build a Netflix clone" },
  { icon: "📦", text: "Build an admin dashboard" },
  { icon: "📋", text: "Build a kanban board" },
  { icon: "🛍️", text: "Build a store page" },
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL_ID);
  const [selectedAgent, setSelectedAgent] = useState<string>("build");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLiveOpen, setIsLiveOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setErrorMessage(null);
    try {
      const session = await createSession(
        prompt.slice(0, 80),
        prompt.trim(),
        selectedModel,
      );
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
    <div className="flex h-screen h-[100dvh] overflow-hidden bg-[#f5f1ea]">
      <AppSidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-white">
        <div className="app-watermark pointer-events-none absolute inset-0" />

        {/* Mobile / Tablet Header Bar */}
        <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-[#eee9e1] bg-white/90 backdrop-blur-sm px-4 md:hidden">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5e0d8] bg-white text-[#3d3830] active:bg-[#f5f1ea]"
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <img src="/logo1.png" alt="CodeForge" className="h-6 w-auto" />
          </div>

          <div className="flex items-center gap-2">
            <PWAInstallButton />
          </div>
        </header>

        {/* Desktop Header Actions */}
        <div className="hidden md:flex relative z-10 w-full items-center justify-end p-4">
          <PWAInstallButton />
        </div>

        {/* Center Content Card */}
        <div className="relative z-10 flex min-h-[calc(100%-3.5rem)] flex-1 flex-col items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-2xl space-y-6 sm:space-y-8">
            <div className="space-y-2.5 text-center">
              <img
                src="/logo1.png"
                alt="CodeForge"
                className="mx-auto h-16 sm:h-20 w-auto"
              />
              <p className="text-sm sm:text-[15px] text-[#8a8278] max-w-md mx-auto">
                AI agent workbench — Multi-provider code generation & execution on any device
              </p>
            </div>

            {/* Prompt Input Area */}
            <div className="border border-[#e5e0d8] bg-white p-4 sm:px-5 sm:py-4 shadow-sm">
              <Textarea
                placeholder="What would you like to build?"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[85px] sm:min-h-[100px] resize-none border-0 bg-transparent p-0 text-sm sm:text-[15px] shadow-none placeholder:text-[#a39e94] focus-visible:ring-0"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[#f5f1ea]">
                <div className="flex flex-wrap items-center gap-2">
                  <AgentSelector
                    currentAgentId={selectedAgent}
                    onAgentChange={setSelectedAgent}
                  />
                  <ModelSelector
                    currentModelId={selectedModel}
                    onModelChange={setSelectedModel}
                  />
                  <LiveButton onClick={() => setIsLiveOpen(true)} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsImportOpen(true)}
                    className="flex items-center gap-1.5 rounded-full border-[#e5e0d8] bg-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#3d3830] hover:bg-[#faf8f5] hover:border-[#c6623f]"
                    title="Importer un dossier local ou un dépôt GitHub"
                  >
                    <FolderDown className="h-3.5 w-3.5 text-[#c6623f]" />
                    <span className="hidden xs:inline">Importer un dépôt</span>
                    <span className="xs:hidden">Importer</span>
                  </Button>
                </div>
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={!prompt.trim() || loading}
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-none bg-[#3d3830] text-white hover:bg-[#2d2a26]"
                >
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-none border-2 border-white border-t-transparent" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <LiveVoiceModal
              isOpen={isLiveOpen}
              onClose={() => setIsLiveOpen(false)}
            />

            <ImportRepoModal
              isOpen={isImportOpen}
              onClose={() => setIsImportOpen(false)}
            />

            {/* Quick Free Model Chips */}
            <div className="space-y-1.5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[#8a8278]">
                <Sparkles className="h-3 w-3 text-[#c6623f]" />
                <span>Popular Free OpenCode Zen & Gateway Models</span>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {[
                  { id: "opencode/zen-coder-free", label: "Zen Coder Free", badge: "Default" },
                  { id: "mimo-v2.5:free", label: "MiMo V2.5", badge: "Free" },
                  { id: "deepseek-v4-flash:free", label: "DeepSeek v4 Flash", badge: "Fast" },
                  { id: "laguna-s-2.1:free", label: "Laguna S 2.1", badge: "Top Free" },
                  { id: "nemotron-3-ultra:free", label: "Nemotron 3", badge: "MoE" },
                  { id: "deepseek/deepseek-r1:free", label: "DeepSeek R1", badge: "CoT Free" },
                ].map((chip) => {
                  const isActive = selectedModel === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setSelectedModel(chip.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs border rounded-none transition-colors cursor-pointer ${
                        isActive
                          ? "bg-[#3d3830] text-white border-[#3d3830]"
                          : "bg-white text-[#5c5348] border-[#e5e0d8] hover:bg-[#faf8f5]"
                      }`}
                    >
                      <span>{chip.label}</span>
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {chip.badge}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {errorMessage && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            {/* Example prompts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.text}
                  onClick={() => setPrompt(ex.text)}
                  className="flex items-center gap-2 border border-[#e5e0d8] bg-white px-4 py-2.5 text-xs sm:text-sm text-[#5c5348] transition-colors hover:bg-[#faf8f5] text-left"
                >
                  <span className="text-base">{ex.icon}</span>
                  <span className="truncate">{ex.text}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
