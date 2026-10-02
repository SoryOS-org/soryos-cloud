"use client";

import { useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  Copy,
  Loader2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ToolStep } from "@/lib/types";

const TOOL_LABELS: Record<string, (input: unknown) => string> = {
  write_file: (i) => `Created ${(i as { path?: string }).path ?? "file"}`,
  edit_file: (i) => `Edited ${(i as { path?: string }).path ?? "file"}`,
  read_file: (i) => `Read ${(i as { path?: string }).path ?? "file"}`,
  list_files: () => "Listed project files",
  run_command: (i) => `Ran ${(i as { command?: string }).command ?? "command"}`,
  start_dev_server: () => "Started dev server",
  get_dev_server_logs: () => "Read dev server logs",
  check_project: () => "Checked project (tsc + eslint)",
};

function toolLabel(name: string, input: unknown): string {
  return TOOL_LABELS[name]?.(input) ?? name;
}

function StepIcon({ step }: { step: ToolStep }) {
  if (step.status === "running")
    return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-500" />;
  if (step.status === "error" || step.isError)
    return <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />;
  return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />;
}

export function ToolStepCard({ step }: { step: ToolStep }) {
  const [copied, setCopied] = useState(false);
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const open = userToggled !== null ? userToggled : step.status === "running";
  const hasError = step.isError || step.status === "error";
  const showOutput = step.output && step.status !== "running";

  const copyOutput = async () => {
    if (!step.output) return;
    await navigator.clipboard.writeText(step.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 min-w-0 overflow-hidden border border-[#e5e0d8] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#eee9e1] bg-[#faf8f5] px-3 py-2">
        <button
          type="button"
          onClick={() => setUserToggled(!open)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-medium text-[#8a8278] hover:text-[#3d3830]"
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform",
              !open && "-rotate-90",
            )}
          />
          <Code2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Tool · {step.name}</span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <StepIcon step={step} />
          {showOutput && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-[#8a8278] hover:text-[#3d3830]"
              onClick={() => void copyOutput()}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </div>

      {open && (
        <>
          <div className="px-4 py-2.5 text-sm text-[#3d3830]">
            {toolLabel(step.name, step.input)}
          </div>

          {showOutput && (
            <pre
              className={`mx-4 mb-3 max-h-44 overflow-auto border p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words ${
                hasError
                  ? "border-red-200/80 bg-red-50/50 text-red-800"
                  : "border-[#eee9e1] bg-[#fafafa] text-[#4a4540]"
              }`}
            >
              {step.output}
            </pre>
          )}
        </>
      )}
    </div>
  );
}
