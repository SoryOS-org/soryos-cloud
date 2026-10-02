"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  Info,
  Layers,
  Wrench,
  Sparkles,
  X,
} from "lucide-react";
import {
  OPENCODE_AGENTS,
  OpenCodeAgent,
  getAgentById,
} from "@/lib/opencode-agents";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface AgentSelectorProps {
  currentAgentId: string;
  onAgentChange: (agentId: string) => void;
  className?: string;
}

export function AgentSelector({
  currentAgentId,
  onAgentChange,
  className = "",
}: AgentSelectorProps) {
  const [inspectorAgent, setInspectorAgent] = useState<OpenCodeAgent | null>(
    null,
  );
  const activeAgent = getAgentById(currentAgentId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-full border border-[#e5e0d8] bg-white px-2.5 py-1 text-xs font-semibold text-[#3d3830] shadow-xs transition-colors hover:border-[#c6623f] hover:bg-[#faf8f5] focus:outline-none ${className}`}
            title={`Agent actif : ${activeAgent.name}`}
          >
            <span className="text-sm">{activeAgent.icon}</span>
            <span className="max-w-[110px] truncate">{activeAgent.name.replace(/ \(.*\)/, "")}</span>
            <span className="rounded bg-[#f5f1ea] px-1 py-0.2 text-[9px] font-bold text-[#c6623f]">
              Agent
            </span>
            <ChevronDown className="h-3 w-3 text-gray-400" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-80 rounded-xl border border-[#e5e0d8] bg-white p-1.5 shadow-xl"
        >
          <div className="flex items-center justify-between px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#3d3830]">
              <Layers className="h-3.5 w-3.5 text-[#c6623f]" />
              <span>Agents OpenCode</span>
            </div>
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
              6 Spécialistes
            </span>
          </div>
          <DropdownMenuSeparator className="bg-[#eee9e1]" />

          <div className="space-y-1 py-1 max-h-[320px] overflow-y-auto">
            {OPENCODE_AGENTS.map((agent) => {
              const isSelected = agent.id === activeAgent.id;
              return (
                <div
                  key={agent.id}
                  className={`group relative flex items-start gap-2.5 rounded-lg p-2 transition cursor-pointer ${
                    isSelected
                      ? "bg-[#faf8f5] border border-[#c6623f]/30"
                      : "hover:bg-[#f5f1ea]"
                  }`}
                  onClick={() => onAgentChange(agent.id)}
                >
                  <span className="text-lg shrink-0 mt-0.5">{agent.icon}</span>
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#3d3830] truncate">
                        {agent.name}
                      </span>
                      <span
                        className="text-[9px] px-1 py-0.2 rounded font-semibold"
                        style={{
                          backgroundColor: `${agent.color}15`,
                          color: agent.color,
                        }}
                      >
                        {agent.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8a8278] line-clamp-1 mt-0.5">
                      {agent.role}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {agent.tools.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded bg-[#eee9e1]/70 px-1 py-0.2 font-mono text-[9px] text-[#5c5348]"
                        >
                          {t}
                        </span>
                      ))}
                      {agent.tools.length > 3 && (
                        <span className="font-mono text-[9px] text-gray-400">
                          +{agent.tools.length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInspectorAgent(agent);
                    }}
                    className="absolute right-2 top-2 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition"
                    title="Voir les détails de l'agent"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>

                  {isSelected && (
                    <div className="absolute right-2 bottom-2 text-[#c6623f]">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Agent Inspector Modal */}
      {inspectorAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl border border-[#e5e0d8] bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setInspectorAgent(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-[#eee9e1]">
              <span className="text-3xl">{inspectorAgent.icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#3d3830]">
                    {inspectorAgent.name}
                  </h3>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                    style={{
                      backgroundColor: `${inspectorAgent.color}20`,
                      color: inspectorAgent.color,
                    }}
                  >
                    {inspectorAgent.badge}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{inspectorAgent.role}</p>
              </div>
            </div>

            <div className="mt-4 space-y-4 text-xs text-[#5c5348]">
              <div>
                <p className="font-semibold text-[#3d3830] mb-1">Description :</p>
                <p className="leading-relaxed bg-[#faf8f5] p-3 rounded-lg border border-[#eee9e1]">
                  {inspectorAgent.description}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 font-semibold text-[#3d3830] mb-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#c6623f]" />
                  <span>Capacités & Fonctionnalités :</span>
                </div>
                <ul className="space-y-1 pl-4 list-disc marker:text-[#c6623f]">
                  {inspectorAgent.capabilities.map((cap, i) => (
                    <li key={i}>{cap}</li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-1.5 font-semibold text-[#3d3830] mb-1.5">
                  <Wrench className="h-3.5 w-3.5 text-[#c6623f]" />
                  <span>Outils OpenCode assignés :</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {inspectorAgent.tools.map((tool) => (
                    <span
                      key={tool}
                      className="rounded-md bg-[#f5f1ea] border border-[#e5e0d8] px-2 py-1 font-mono text-[11px] font-medium text-[#3d3830]"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-semibold text-[#3d3830] mb-1">Quand l&apos;utiliser :</p>
                <p className="text-[#3d3830] italic bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                  {inspectorAgent.whenToUse}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInspectorAgent(null)}
              >
                Fermer
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onAgentChange(inspectorAgent.id);
                  setInspectorAgent(null);
                }}
                className="bg-[#3d3830] text-white hover:bg-[#2d2a26]"
              >
                Sélectionner cet agent
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
