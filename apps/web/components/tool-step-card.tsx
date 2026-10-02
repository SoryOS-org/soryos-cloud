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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolStep } from "@/lib/types";

const TOOL_CONFIG: Record<string, { label: (i: unknown) => string; icon: typeof FileText; color: string }> = {
  write_file: {
    label: (i) => `Création de ${(i as { path?: string }).path ?? "fichier"}`,
    icon: FileCode,
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  edit_file: {
    label: (i) => `Modification de ${(i as { path?: string }).path ?? "fichier"}`,
    icon: FileCode,
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  read_file: {
    label: (i) => `Lecture de ${(i as { path?: string }).path ?? "fichier"}`,
    icon: FileText,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  list_files: {
    label: () => "Exploration des fichiers du projet",
    icon: Search,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  run_command: {
    label: (i) => `Exécution : ${(i as { command?: string }).command ?? "commande"}`,
    icon: Terminal,
    color: "text-slate-700 bg-slate-100 border-slate-200",
  },
  start_dev_server: {
    label: () => "Démarrage du serveur de développement",
    icon: Server,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
  },
  get_dev_server_logs: {
    label: () => "Consultation des logs du serveur",
    icon: Terminal,
    color: "text-teal-600 bg-teal-50 border-teal-200",
  },
  check_project: {
    label: () => "Vérification TypeScript & ESLint",
    icon: Wrench,
    color: "text-rose-600 bg-rose-50 border-rose-200",
  },
};

function getToolConfig(name: string) {
  return TOOL_CONFIG[name] ?? {
    label: (i: unknown) => JSON.stringify(i) || name,
    icon: Wrench,
    color: "text-gray-600 bg-gray-50 border-gray-200",
  };
}

export function ToolStepCard({ step }: { step: ToolStep }) {
  const [copied, setCopied] = useState(false);
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const open = userToggled !== null ? userToggled : step.status === "running";
  const hasError = step.isError || step.status === "error";
  const showOutput = step.output && step.status !== "running";
  const config = getToolConfig(step.name);
  const Icon = config.icon;

  const copyOutput = async () => {
    if (!step.output) return;
    await navigator.clipboard.writeText(step.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 min-w-0 overflow-hidden rounded-xl border border-[#e5e0d8] bg-white shadow-xs transition-all">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 border-b border-[#eee9e1] bg-[#faf8f5] px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => setUserToggled(!open)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left text-xs font-semibold text-[#3d3830] hover:text-[#c6623f] transition"
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200",
              !open && "-rotate-90",
            )}
          />
          <div className={cn("flex h-6 w-6 items-center justify-center rounded-md border", config.color)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="truncate uppercase tracking-wide font-mono text-[11px] text-[#5c5348]">
            {step.name.replace(/_/g, " ")}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {/* Status badge */}
          {step.status === "running" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-200">
              <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
              <span>En cours</span>
            </span>
          ) : hasError ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 border border-red-200">
              <XCircle className="h-3 w-3 text-red-500" />
              <span>Erreur</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span>Succès</span>
            </span>
          )}

          {showOutput && (
            <button
              onClick={() => void copyOutput()}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e0d8] bg-white text-[#5c5348] hover:bg-[#faf8f5] hover:text-[#3d3830] transition"
              title="Copier la sortie"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Body content */}
      {open && (
        <div className="p-3.5 space-y-2.5 bg-white">
          <div className="text-xs font-medium text-[#3d3830] bg-[#faf8f5] rounded-lg px-3 py-2 border border-[#eee9e1]">
            {config.label(step.input)}
          </div>

          {showOutput && (
            <div className="overflow-hidden rounded-lg border border-[#e5e0d8]">
              <div className="bg-[#f5f1ea] px-3 py-1 font-mono text-[10px] font-bold text-[#5c5348] uppercase tracking-wider border-b border-[#e5e0d8]">
                Résultat / Sortie
              </div>
              <pre
                className={`max-h-48 overflow-auto p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words ${
                  hasError
                    ? "bg-red-50/60 text-red-900"
                    : "bg-[#282c34] text-[#abb2bf]"
                }`}
              >
                {step.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
