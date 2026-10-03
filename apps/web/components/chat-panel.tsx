"use client";

import { useEffect, useRef, useState } from "react";
import { ChatMessage } from "@/lib/types";
import { assistantBlocks } from "@/lib/chat-blocks";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ArrowUp,
  Square,
  FolderDown,
  Sparkles,
  User,
  Wrench,
  Search,
  Code2,
  Bug,
  CornerDownLeft,
  Download,
  FileText,
  FileJson,
  ChevronDown,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ToolStepCard } from "@/components/tool-step-card";
import { ModelSelector } from "@/components/model-selector";
import { AgentSelector } from "@/components/agent-selector";
import { LiveButton } from "@/components/live-button";
import { DEFAULT_MODEL_ID } from "@/lib/providers";
import { exportSessionAsMarkdown, exportSessionAsJSON } from "@/lib/export-session";

interface ChatPanelProps {
  sessionId?: string;
  filePaths?: string[];
  messages: ChatMessage[];
  loading: boolean;
  status?: string | null;
  sessionTitle?: string;
  currentModelId?: string;
  currentAgentId?: string;
  onModelChange?: (modelId: string) => void;
  onAgentChange?: (agentId: string) => void;
  onSendMessage: (content: string) => void;
  onAbort?: () => void;
  onOpenLive?: () => void;
  onOpenImport?: () => void;
}

function AssistantTurn({ message }: { message: ChatMessage }) {
  const blocks = assistantBlocks(message);
  if (!blocks.length) return null;

  return (
    <div className="w-full min-w-0 space-y-2">
      {blocks.map((block, i) =>
        block.type === "text" ? (
          <div
            key={`text-${i}`}
            className="chat-prose prose prose-sm prose-stone max-w-none text-[15px] leading-relaxed text-[#3d3830]"
          >
            <MarkdownRenderer content={block.content} />
          </div>
        ) : (
          <ToolStepCard key={block.step.id} step={block.step} />
        ),
      )}
    </div>
  );
}

const QUICK_PROMPTS = [
  { label: "Ajouter une fonctionnalité", icon: Code2, prompt: "Ajoute un composant interactif avec Tailwind CSS et TypeScript" },
  { label: "Déboguer l'application", icon: Bug, prompt: "Inspecte les fichiers du projet et corrige les erreurs TypeScript" },
  { label: "Recherche Web & Doc", icon: Search, prompt: "Recherche la documentation la plus récente sur React 19 et Vite" },
  { label: "Diagramme d'architecture", icon: Sparkles, prompt: "Génère un diagramme Mermaid montrant l'architecture du projet" },
];

export function ChatPanel({
  sessionId = "session",
  filePaths = [],
  messages,
  loading,
  status,
  sessionTitle = "Session",
  currentModelId = DEFAULT_MODEL_ID,
  currentAgentId = "build",
  onModelChange,
  onAgentChange,
  onSendMessage,
  onAbort,
  onOpenLive,
  onOpenImport,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
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

      {/* Header Bar */}
      <header className="relative z-10 hidden lg:flex h-12 shrink-0 items-center justify-between border-b border-[#eee9e1] bg-white px-5 shadow-2xs">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="shrink-0 transition hover:opacity-80">
            <img src="/logo1.png" alt="CodeForge" className="h-5 w-auto" />
          </Link>
          <div className="h-4 w-px bg-[#e5e0d8]" />
          <h1 className="truncate text-sm font-semibold text-[#3d3830]">
            {sessionTitle ?? "Session"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Export Session Menu */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="h-8 gap-1.5 rounded-lg border-[#e5e0d8] text-xs font-medium text-[#3d3830] hover:border-[#c6623f] hover:bg-[#faf8f5] transition"
              title="Exporter l'historique et la session"
            >
              <Download className="h-3.5 w-3.5 text-[#c6623f]" />
              <span>Exporter</span>
              <ChevronDown className="h-3 w-3 text-gray-400" />
            </Button>

            {exportMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-48 rounded-xl border border-[#e5e0d8] bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false);
                    exportSessionAsMarkdown(sessionTitle, messages, filePaths);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#3d3830] hover:bg-[#faf8f5] transition"
                >
                  <FileText className="h-4 w-4 text-[#c6623f]" />
                  <span>Markdown (.md)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false);
                    exportSessionAsJSON(sessionTitle, sessionId, messages, filePaths);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#3d3830] hover:bg-[#faf8f5] transition"
                >
                  <FileJson className="h-4 w-4 text-[#c6623f]" />
                  <span>JSON (.json)</span>
                </button>
              </div>
            )}
          </div>

          {onOpenImport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenImport}
              className="h-8 gap-1.5 rounded-lg border-[#e5e0d8] text-xs font-medium text-[#3d3830] hover:border-[#c6623f] hover:bg-[#faf8f5] transition"
              title="Importer des fichiers ou un dépôt GitHub/GitLab"
            >
              <FolderDown className="h-3.5 w-3.5 text-[#c6623f]" />
              <span>Importer Repo</span>
            </Button>
          )}
          {onOpenLive && <LiveButton onClick={onOpenLive} />}
          {loading && onAbort && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAbort}
              className="h-8 gap-1.5 rounded-lg border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
            >
              <Square className="h-3 w-3 fill-current" />
              Arrêter
            </Button>
          )}
        </div>
      </header>

      {/* Messages Scroll Area */}
      <ScrollArea className="relative z-10 min-h-0 flex-1">
        <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 py-6 pb-4">
          {messages.map((message) =>
            message.role === "user" ? (
              <div
                key={message.id}
                className="group flex flex-col items-end gap-1"
              >
                <div className="flex items-center gap-2 text-[11px] font-mono font-medium text-[#8c8275] px-1">
                  <span>Vous</span>
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e8e2d8] text-[#3d3830]">
                    <User className="h-3 w-3" />
                  </div>
                </div>
                <div className="rounded-2xl rounded-tr-xs border border-[#e8e2d8] bg-[#f3f1ec] px-4 py-3 shadow-2xs max-w-[90%]">
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words text-[#3d3830]">
                    {message.content}
                  </p>
                </div>
              </div>
            ) : (
              <div key={message.id} className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 text-[11px] font-mono font-medium text-[#c6623f] px-1">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#c6623f]/15 text-[#c6623f]">
                    <Sparkles className="h-3 w-3" />
                  </div>
                  <span>Agent OpenCode</span>
                </div>
                <AssistantTurn message={message} />
              </div>
            ),
          )}

          {/* Loading status pill */}
          {loading && (
            <div className="flex items-center gap-2.5 rounded-xl border border-[#e88d67]/30 bg-[#faf5f2] px-4 py-2.5 text-xs text-[#c6623f] font-mono shadow-2xs animate-pulse">
              <Wrench className="h-3.5 w-3.5 animate-spin shrink-0" />
              <span className="font-medium">{status ?? "L'agent réfléchit et exécute les outils..."}</span>
            </div>
          )}
          <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
        </div>
      </ScrollArea>

      {/* Input Chat Section */}
      <div className="relative z-10 shrink-0 border-t border-[#eee9e1] bg-[#faf8f5]/80 backdrop-blur-sm px-4 sm:px-6 py-4">
        <div className="mx-auto max-w-3xl space-y-3">
          {/* Quick Prompts Chips when input is empty */}
          {messages.length <= 2 && !input && (
            <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {QUICK_PROMPTS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setInput(item.prompt)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#e5e0d8] bg-white px-3 py-1.5 text-xs font-medium text-[#5c5348] hover:border-[#c6623f] hover:bg-white hover:text-[#c6623f] hover:shadow-2xs transition"
                  >
                    <Icon className="h-3.5 w-3.5 text-[#c6623f]" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Main Floating Input Container */}
          <div className="group rounded-2xl border border-[#e5e0d8] bg-white p-3 shadow-md transition-all duration-200 focus-within:border-[#c6623f] focus-within:ring-2 focus-within:ring-[#c6623f]/20">
            <Textarea
              placeholder="Demandez à OpenCode (ex: Crée un composant, exécute une commande, recherche sur le web...)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="min-h-[56px] max-h-[180px] min-w-0 flex-1 resize-none border-0 bg-transparent p-1 text-[15px] shadow-none placeholder:text-[#a39e94] focus-visible:ring-0 focus-visible:ring-offset-0 leading-relaxed"
            />

            {/* Action Bar inside Input Container */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2.5 border-t border-[#f5f1ea] pt-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <AgentSelector
                  currentAgentId={currentAgentId}
                  onAgentChange={onAgentChange ?? (() => {})}
                />
                <ModelSelector
                  currentModelId={currentModelId}
                  onModelChange={onModelChange ?? (() => {})}
                />
                {onOpenLive && <LiveButton onClick={onOpenLive} />}
                {onOpenImport && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onOpenImport}
                    className="h-8 gap-1.5 rounded-full border-[#e5e0d8] bg-white px-2.5 text-xs font-semibold text-[#3d3830] hover:border-[#c6623f] transition"
                    title="Importer un projet local ou dépôt GitHub"
                  >
                    <FolderDown className="h-3.5 w-3.5 text-[#c6623f]" />
                    <span className="hidden sm:inline">Importer</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-[#a39e94]">
                  <span>Entrée</span>
                  <CornerDownLeft className="h-3 w-3" />
                </span>

                {loading && onAbort ? (
                  <Button
                    type="button"
                    onClick={onAbort}
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-xl bg-red-600 text-white hover:bg-red-700 shadow-xs transition"
                    title="Arrêter l'exécution"
                  >
                    <Square className="h-4 w-4 fill-current" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!input.trim() || loading}
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-xl bg-[#c6623f] text-white hover:bg-[#b05332] disabled:opacity-30 shadow-xs transition"
                    title="Envoyer la demande (Entrée)"
                  >
                    <ArrowUp className="h-4.5 w-4.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
