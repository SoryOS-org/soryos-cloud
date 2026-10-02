"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PROVIDERS, getModelById, ModelInfo } from "@/lib/providers";
import { ChevronDown, Check, Sparkles, Cpu } from "lucide-react";

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
        className="w-80 max-h-[440px] overflow-y-auto p-1.5 bg-white border-[#e5e0d8] shadow-lg rounded-none text-xs"
      >
        <div className="px-2 py-1.5 border-b border-[#eee9e1] mb-1">
          <p className="font-semibold text-xs text-[#2d2a26]">AI Provider & Model</p>
          <p className="text-[11px] text-[#8a8278]">
            Choose from OpenCode Zen, Gemini, OpenRouter free models, Mistral, Grok & more
          </p>
        </div>

        {PROVIDERS.map((provider, pIndex) => (
          <div key={provider.id}>
            {pIndex > 0 && <DropdownMenuSeparator className="bg-[#eee9e1] my-1" />}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center justify-between text-[11px] font-bold text-[#8a8278] uppercase tracking-wider px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <Cpu className="h-3 w-3 text-[#c6623f]" />
                  <span>{provider.name}</span>
                </div>
                {provider.hasFreeTier && (
                  <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                    Free Tier
                  </span>
                )}
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
