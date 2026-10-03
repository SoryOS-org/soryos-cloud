"use client";

import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Terminal, 
  CheckCircle2, 
  Layers, 
  Play, 
  FolderGit2, 
  Cpu, 
  Settings, 
  ArrowRight,
  Code2,
  Plus
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"overview" | "features" | "settings">("overview");
  const [items, setItems] = useState<Array<{ id: string; text: string; done: boolean; category: string }>>([
    { id: "1", text: "Architecture multi-sandbox & cloud providers prête", done: true, category: "Infra" },
    { id: "2", text: "Synchronisation remote filesystem GitHub & Codespaces", done: true, category: "Sync" },
    { id: "3", text: "Compilation interactive React 19 & Tailwind CSS", done: false, category: "UI" },
  ]);
  const [newItem, setNewItem] = useState("");

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, done: !it.done } : it))
    );
  };

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    setItems((prev) => [
      ...prev,
      { id: Date.now().toString(), text: newItem.trim(), done: false, category: "Feature" },
    ]);
    setNewItem("");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-8 flex flex-col items-center">
      {/* Top Banner */}
      <div className="w-full max-w-4xl bg-gradient-to-r from-[#c6623f]/20 via-orange-950/40 to-slate-900 border border-[#c6623f]/30 rounded-2xl p-6 mb-8 backdrop-blur-md shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-[#c6623f] flex items-center justify-center text-white shadow-lg shadow-[#c6623f]/20">
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Application Interactive SoryOS
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Généré sur mesure pour votre prompt : <span className="text-[#c6623f] font-semibold">« Salut... »</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-full flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              Opérationnel
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 border-t border-slate-800/80 pt-4">
          {(["overview", "features", "settings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === tab
                  ? "bg-[#c6623f] text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              {tab === "overview" ? "Vue d'ensemble" : tab === "features" ? "Fonctionnalités" : "Configuration"}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Interactive Manager */}
        <div className="md:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#c6623f]" />
              Feuille de Route & Actions
            </h2>
            <span className="text-xs text-slate-500">
              {items.filter((i) => i.done).length} / {items.length} complétés
            </span>
          </div>

          {/* Quick Add Form */}
          <form onSubmit={addItem} className="flex gap-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Ajouter une tâche ou un module..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#c6623f]"
            />
            <button
              type="submit"
              className="bg-[#c6623f] hover:bg-[#b05534] text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Ajouter</span>
            </button>
          </form>

          {/* Items List */}
          <div className="space-y-2">
            {items.map((it) => (
              <div
                key={it.id}
                onClick={() => toggleItem(it.id)}
                className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                  it.done
                    ? "bg-slate-950/40 border-slate-800/40 opacity-70"
                    : "bg-slate-950 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-5 w-5 rounded-md border flex items-center justify-center transition ${
                      it.done
                        ? "bg-emerald-600 border-emerald-500 text-white"
                        : "border-slate-700 bg-slate-900"
                    }`}
                  >
                    {it.done && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      it.done ? "line-through text-slate-500" : "text-slate-200"
                    }`}
                  >
                    {it.text}
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  {it.category}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Engine Stats */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Terminal className="h-4 w-4 text-[#c6623f]" />
            Statistiques Système
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="text-slate-500">Moteur Frontend</div>
              <div className="font-mono text-white font-semibold">React 19 + Vite 6 + Tailwind</div>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="text-slate-500">Environnement</div>
              <div className="font-mono text-emerald-400 font-semibold">SoryOS Sandbox Engine</div>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="text-slate-500">Persistance Git</div>
              <div className="font-mono text-cyan-400 font-semibold">GitHub Remote Filesystem</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
