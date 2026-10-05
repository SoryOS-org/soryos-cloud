"use client";

import { useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Loader2,
  XCircle,
  FileCode,
  FileText,
  Terminal,
  Server,
  Wrench,
  Search,
  Globe,
  Clock,
  Ban,
  FileDiff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolStep } from "@/lib/types";

const TOOL_CONFIG: Record<
  string,
  { label: (i: unknown) => string; icon: typeof FileText; color: string; category: "command" | "file_edit" | "file_write" | "file_read" | "search" | "web" | "system" }
> = {
  websearch: {
    label: (i) => (i as { query?: string }).query ? `Recherche : "${(i as { query?: string }).query}"` : "Recherche web",
    icon: Globe,
    color: "text-amber-700 bg-amber-50 border-amber-200",
    category: "web",
  },
  web_search: {
    label: (i) => (i as { query?: string }).query ? `Recherche : "${(i as { query?: string }).query}"` : "Recherche web",
    icon: Globe,
    color: "text-amber-700 bg-amber-50 border-amber-200",
    category: "web",
  },
  search_web: {
    label: (i) => (i as { query?: string }).query ? `Recherche : "${(i as { query?: string }).query}"` : "Recherche web",
    icon: Globe,
    color: "text-amber-700 bg-amber-50 border-amber-200",
    category: "web",
  },
  webfetch: {
    label: (i) => (i as { url?: string }).url ? `Fetch : ${(i as { url?: string }).url}` : "Extraction web",
    icon: Globe,
    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
    category: "web",
  },
  write_file: {
    label: (i) => (i as { path?: string; filePath?: string }).path ?? (i as { filePath?: string }).filePath ?? "Nouveau fichier",
    icon: FileCode,
    color: "text-amber-600 bg-amber-50 border-amber-200",
    category: "file_write",
  },
  edit_file: {
    label: (i) => (i as { path?: string; filePath?: string }).path ?? (i as { filePath?: string }).filePath ?? "Fichier modifié",
    icon: FileDiff,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    category: "file_edit",
  },
  read_file: {
    label: (i) => (i as { path?: string; filePath?: string }).path ?? (i as { filePath?: string }).filePath ?? "Fichier lu",
    icon: FileText,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    category: "file_read",
  },
  list_files: {
    label: (i) => (i as { pattern?: string; dir?: string }).pattern ?? (i as { dir?: string }).dir ?? "Exploration des fichiers",
    icon: Search,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    category: "search",
  },
  run_command: {
    label: (i) => (i as { command?: string; CommandLine?: string }).command ?? (i as { CommandLine?: string }).CommandLine ?? "Commande shell",
    icon: Terminal,
    color: "text-slate-800 bg-slate-100 border-slate-300",
    category: "command",
  },
  start_dev_server: {
    label: () => "Démarrage du serveur de développement",
    icon: Server,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    category: "system",
  },
  get_dev_server_logs: {
    label: () => "Consultation des logs du serveur",
    icon: Terminal,
    color: "text-teal-600 bg-teal-50 border-teal-200",
    category: "system",
  },
  check_project: {
    label: () => "Vérification TypeScript & ESLint",
    icon: Wrench,
    color: "text-rose-600 bg-rose-50 border-rose-200",
    category: "system",
  },
};

function getToolConfig(name: string) {
  return TOOL_CONFIG[name] ?? {
    label: (i: unknown) => typeof i === "string" ? i : JSON.stringify(i) || name,
    icon: Wrench,
    color: "text-gray-600 bg-gray-50 border-gray-200",
    category: "system" as const,
  };
}

export function ToolStepCard({ step }: { step: ToolStep }) {
  const [copied, setCopied] = useState(false);
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const isRunning = step.status === "running";
  const isPending = step.status === "pending";
  const isCancelled = step.status === "cancelled";
  const open = userToggled !== null ? userToggled : (isRunning || isPending);
  const hasError = Boolean(step.isError || step.status === "error" || step.error);
  const showOutput = Boolean((step.output || step.error) && !isRunning && !isPending);
  const config = getToolConfig(step.name);
  const Icon = config.icon;

  const copyContent = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const outputText = step.error || step.output || "";

  return (
    <div className="my-3 min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-xs transition-all">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => setUserToggled(!open)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left text-xs font-semibold text-[var(--foreground)] hover:text-[var(--primary)] transition cursor-pointer"
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)] transition-transform duration-200",
              !open && "-rotate-90",
            )}
          />
          <div className={cn("flex h-6 w-6 items-center justify-center rounded-md border shrink-0", config.color)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="truncate uppercase tracking-wide font-mono text-[11px] text-[var(--foreground)] font-bold">
            {step.name.replace(/_/g, " ")}
          </span>
          <span className="truncate text-xs font-mono font-normal text-[var(--muted-foreground)] max-w-[200px]">
            {config.label(step.input)}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {/* Discreet Environment Badge if provided */}
          {typeof step.metadata?.providerId === "string" && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded bg-[var(--surface-hover)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-medium text-[var(--foreground)] font-mono">
              {step.metadata.providerId === "local"
                ? "💻 Local"
                : `☁️ Sandbox · ${step.metadata.providerId.toUpperCase()}`}
            </span>
          )}

          {/* Status badge */}
          {isPending ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Clock className="h-3 w-3 text-amber-500" />
              <span>En attente</span>
            </span>
          ) : isRunning ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
              <span>En cours</span>
            </span>
          ) : isCancelled ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)] border border-[var(--border)]">
              <Ban className="h-3 w-3 text-[var(--muted-foreground)]" />
              <span>Annulé</span>
            </span>
          ) : hasError ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400 border border-red-500/20">
              <XCircle className="h-3 w-3 text-red-500" />
              <span>Erreur</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span>Succès</span>
            </span>
          )}

          {showOutput && outputText && (
            <button
              onClick={() => void copyContent(outputText)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition cursor-pointer"
              title="Copier le résultat"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Body content */}
      {open && (
        <div className="p-3.5 space-y-3 bg-[var(--surface-elevated)] text-[var(--foreground)]">
          {/* INPUT / ARGUMENTS SECTION */}
          <div className="space-y-1">
            <div className="text-[10px] font-mono font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
              Arguments / Input
            </div>
            {config.category === "command" ? (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--terminal-background)] p-2.5 font-mono text-xs text-emerald-400 border border-[var(--border)]">
                <span className="text-[var(--muted-foreground)]">$</span>
                <span className="break-all">{config.label(step.input)}</span>
              </div>
            ) : config.category === "file_edit" || config.category === "file_write" || config.category === "file_read" ? (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface)] px-3 py-2 text-xs font-mono border border-[var(--border)] text-[var(--foreground)]">
                <span className="font-semibold text-[var(--foreground)]">{config.label(step.input)}</span>
                <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wide">{config.category.replace("_", " ")}</span>
              </div>
            ) : (
              <pre className="rounded-lg bg-[var(--surface)] p-2.5 font-mono text-xs text-[var(--foreground)] border border-[var(--border)] max-h-28 overflow-auto whitespace-pre-wrap break-all">
                {typeof step.input === "object" ? JSON.stringify(step.input, null, 2) : String(step.input)}
              </pre>
            )}
          </div>

          {/* RESULT / OUTPUT SECTION */}
          {showOutput && (
            <div className="overflow-hidden rounded-lg border border-[var(--border)] space-y-0">
              <div className="bg-[var(--surface)] px-3 py-1 font-mono text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider border-b border-[var(--border)] flex justify-between items-center">
                <span>{hasError ? "Erreur" : "Résultat / Sortie"}</span>
                {step.completedAt && (
                  <span className="text-[9px] font-normal text-[var(--muted-foreground)] lowercase">
                    {new Date(step.completedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <pre
                className={`max-h-60 overflow-auto p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words ${
                  hasError
                    ? "bg-red-500/10 text-red-500 dark:text-red-400 border-l-4 border-red-500"
                    : "bg-[var(--terminal-background)] text-[var(--terminal-foreground)] border-l-4 border-[var(--primary)]"
                }`}
              >
                {outputText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
