"use client";

import { useEffect, useState, useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getAllProviders,
  getModelById,
  ProviderInfo,
  ModelInfo,
} from "@/lib/providers";
import { ChevronDown, Check, Sparkles, Cpu, RefreshCw } from "lucide-react";

interface ModelSelectorProps {
  currentModelId: string;
  onModelChange: (modelId: string) => void;
  className?: string;
}

export function ModelSelector({
  currentModelId,
  onModelChange,
  className = "",
}: ModelSelectorProps) {
  const [providers, setProviders] = useState<ProviderInfo[]>(() => getAllProviders());
  const [isSyncing, startSync] = useTransition();
  const [lastSyncNotice, setLastSyncNotice] = useState<string | null>(null);

  // Dynamically fetch providers on mount and sync with OpenCode Zen
  useEffect(() => {
    let mounted = true;
    async function fetchLiveProviders() {
      try {
        const res = await fetch("/api/providers");
        if (!res.ok) return;
        const data = (await res.json()) as { providers?: ProviderInfo[] };
        if (mounted && data.providers && Array.isArray(data.providers)) {
          setProviders(data.providers);
        }
      } catch (err) {
        console.warn("Could not fetch dynamic providers:", err);
      }
    }
    void fetchLiveProviders();
    return () => {
      mounted = false;
    };
  }, []);

  const handleManualSync = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startSync(async () => {
      try {
        const res = await fetch("/api/providers", { method: "POST" });
        if (!res.ok) return;
        const data = (await res.json()) as { providers?: ProviderInfo[] };
        if (data.providers) {
          setProviders(data.providers);
          const zen = data.providers.find((p) => p.id === "opencode-zen");
          const count = zen?.models.length || 0;
          setLastSyncNotice(`Synced ${count} Zen models`);
          setTimeout(() => setLastSyncNotice(null), 3000);
        }
      } catch (err) {
        console.error("Manual sync error:", err);
      }
    });
  };

  const activeModel = getModelById(currentModelId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 rounded px-2.5 py-1 text-xs font-medium text-[#5c5348] transition-colors hover:bg-[#faf8f5] hover:text-[#2d2a26] border border-[#e5e0d8] bg-white shadow-2xs cursor-pointer ${className}`}
        >
          <Sparkles className="h-3.5 w-3.5 text-[#c6623f]" />
          <span className="font-semibold text-[#2d2a26]">{activeModel.providerName}</span>
          <span className="text-[#8a8278]">·</span>
          <span className="truncate max-w-[130px]">{activeModel.name}</span>
          {activeModel.isFree && (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
              Free
            </span>
          )}
          <ChevronDown className="h-3 w-3 text-[#a39e94]" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-84 max-h-[460px] overflow-y-auto p-1.5 bg-white border-[#e5e0d8] shadow-lg rounded-none text-xs"
      >
        {/* Dynamic Sync Header */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#eee9e1] mb-1">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-xs text-[#2d2a26]">AI Provider & Models</p>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-[10px] text-[#8a8278]">
              {lastSyncNotice || "Auto-syncs live with OpenCode Zen free models"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            title="Check OpenCode Zen for newly added models"
            className="flex items-center gap-1 px-1.5 py-1 text-[10px] font-medium text-[#c6623f] hover:bg-[#f5f1ea] border border-[#eee9e1] rounded cursor-pointer transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync Zen"}</span>
          </button>
        </div>

        {/* Dynamically rendered providers list */}
        {providers.map((provider, pIndex) => (
          <div key={provider.id}>
            {pIndex > 0 && <DropdownMenuSeparator className="bg-[#eee9e1] my-1" />}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center justify-between text-[11px] font-bold text-[#8a8278] uppercase tracking-wider px-2 py-1.5">
                <div className="flex items-center gap-1.5 truncate">
                  <Cpu className="h-3 w-3 text-[#c6623f] shrink-0" />
                  <span className="truncate">{provider.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {provider.id === "opencode-zen" && (
                    <span className="text-[9px] font-semibold text-[#c6623f] bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                      Bearer public
                    </span>
                  )}
                  {provider.hasFreeTier && (
                    <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      Free Tier
                    </span>
                  )}
                </div>
              </DropdownMenuLabel>

              {provider.models.map((model: ModelInfo) => {
                const isSelected = model.id === currentModelId;
                return (
                  <DropdownMenuItem
                    key={model.id}
                    onClick={() => onModelChange(model.id)}
                    className={`flex items-start justify-between gap-2 px-2.5 py-2 cursor-pointer rounded-none text-xs transition-colors ${
                      isSelected
                        ? "bg-[#f5f1ea] text-[#2d2a26] font-medium"
                        : "hover:bg-[#faf8f5] text-[#3d3830]"
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-[12px] truncate">{model.name}</span>
                        {model.isFree && (
                          <span className="rounded bg-emerald-100/70 text-emerald-800 px-1 py-0.2 text-[9px] font-bold">
                            FREE
                          </span>
                        )}
                        {model.badge && !model.isFree && (
                          <span className="rounded bg-zinc-100 text-zinc-600 px-1 py-0.2 text-[9px]">
                            {model.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#8a8278] line-clamp-1">
                        {model.description}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-[#c6623f] shrink-0 mt-0.5" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
