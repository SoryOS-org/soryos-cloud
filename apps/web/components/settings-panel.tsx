"use client";

import { useState } from "react";
import {
  X,
  Palette,
  Code2,
  Terminal as TerminalIcon,
  Cloud,
  GitBranch,
  Cpu,
  Boxes,
  Info,
  Check,
  RotateCcw,
  Sun,
  Moon,
  Laptop,
  Sliders,
} from "lucide-react";
import { useTheme } from "@/lib/theme/theme-context";
import { COLOR_THEMES, ACCENT_PALETTES } from "@/lib/theme/palettes";
import { ColorTheme, AccentColor, ThemeMode, UiDensity } from "@/lib/theme/types";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: string;
}

type SettingsCategory =
  | "appearance"
  | "editor"
  | "terminal"
  | "environment"
  | "git"
  | "ai"
  | "providers"
  | "about";

export function SettingsPanel({ isOpen, onClose, defaultCategory = "appearance" }: SettingsPanelProps) {
  const { preferences, updatePreferences, resetPreferences, resolvedIsDark } = useTheme();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(
    (defaultCategory as SettingsCategory) || "appearance"
  );
  const [resetModalOpen, setResetModalOpen] = useState(false);

  if (!isOpen) return null;

  const categories: Array<{ id: SettingsCategory; label: string; icon: React.ReactNode }> = [
    { id: "appearance", label: "Appearance", icon: <Palette className="h-4 w-4" /> },
    { id: "editor", label: "Editor", icon: <Code2 className="h-4 w-4" /> },
    { id: "terminal", label: "Terminal", icon: <TerminalIcon className="h-4 w-4" /> },
    { id: "environment", label: "Environment", icon: <Cloud className="h-4 w-4" /> },
    { id: "git", label: "Git & Version Control", icon: <GitBranch className="h-4 w-4" /> },
    { id: "ai", label: "AI & Agents", icon: <Cpu className="h-4 w-4" /> },
    { id: "providers", label: "Cloud & Sandboxes", icon: <Boxes className="h-4 w-4" /> },
    { id: "about", label: "About SoryOS-Code", icon: <Info className="h-4 w-4" /> },
  ];

  const handleResetConfirm = () => {
    resetPreferences();
    setResetModalOpen(false);
  };

  const colorThemesList: ColorTheme[] = [
    "soryos",
    "midnight",
    "ocean",
    "forest",
    "violet",
    "rose",
    "amber",
    "custom",
  ];

  const accentColorsList: AccentColor[] = [
    "blue",
    "purple",
    "cyan",
    "green",
    "orange",
    "red",
    "pink",
  ];

  const customColorsMap = (preferences.customColors as unknown as Record<string, string>) || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-[var(--surface)] text-[var(--foreground)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-elevated)]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] shadow-md">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Settings & Configuration</h2>
              <p className="text-xs text-[var(--muted-foreground)]">
                Centre de contrôle global de SoryOS-Code Workbench
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] rounded-lg transition cursor-pointer"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Split */}
        <div className="flex flex-1 min-h-0 flex-col sm:flex-row overflow-hidden">
          {/* Sidebar Navigation */}
          <div className="w-full sm:w-60 shrink-0 border-b sm:border-b-0 sm:border-r border-[var(--border)] bg-[var(--surface-elevated)] p-3 space-y-1 overflow-x-auto sm:overflow-y-auto">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Préférences
            </div>
            {categories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {cat.icon}
                  <span className="truncate">{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Main Content Pane */}
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
            {/* 1. APPEARANCE */}
            {activeCategory === "appearance" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                  <div>
                    <h3 className="text-base font-bold">Appearance & Themes</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Personnalisez l&apos;interface visuelle, les palettes de couleurs et l&apos;accentuation.
                    </p>
                  </div>
                  <button
                    onClick={() => setResetModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-xs font-semibold transition cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                    <span>Reset Appearance</span>
                  </button>
                </div>

                {/* Theme Mode */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Mode d&apos;affichage (Theme Mode)
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "light" as ThemeMode, label: "Light", icon: <Sun className="h-4 w-4" /> },
                      { id: "dark" as ThemeMode, label: "Dark", icon: <Moon className="h-4 w-4" /> },
                      { id: "system" as ThemeMode, label: "System", icon: <Laptop className="h-4 w-4" /> },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => updatePreferences({ theme: m.id })}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                          preferences.theme === m.id
                            ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] shadow-sm"
                            : "border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)]"
                        }`}
                      >
                        {m.icon}
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Themes Cards */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Palette de couleurs (Color Theme)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {colorThemesList.map((ct) => {
                      const family = COLOR_THEMES[ct];
                      const isSelected = preferences.colorTheme === ct;
                      const previewTokens = resolvedIsDark ? family.dark : family.light;

                      return (
                        <div
                          key={ct}
                          onClick={() => updatePreferences({ colorTheme: ct })}
                          className={`group relative flex flex-col rounded-xl border p-3.5 transition cursor-pointer ${
                            isSelected
                              ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/30 bg-[var(--surface-elevated)]"
                              : "border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--muted-foreground)] hover:bg-[var(--surface-hover)]"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold capitalize">{family.name}</span>
                            {isSelected && (
                              <div className="h-5 w-5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center shadow-xs">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                          </div>

                          {/* Mini Swatches Preview */}
                          <div className="flex items-center gap-1.5 mt-1">
                            <div
                              className="h-4 w-4 rounded-full border border-black/10 shadow-xs"
                              style={{ backgroundColor: previewTokens.background }}
                              title="Background"
                            />
                            <div
                              className="h-4 w-4 rounded-full border border-black/10 shadow-xs"
                              style={{ backgroundColor: previewTokens.surface }}
                              title="Surface"
                            />
                            <div
                              className="h-4 w-4 rounded-full border border-black/10 shadow-xs"
                              style={{ backgroundColor: previewTokens.primary }}
                              title="Primary"
                            />
                            <div
                              className="h-4 w-4 rounded-full border border-black/10 shadow-xs"
                              style={{ backgroundColor: previewTokens.accent }}
                              title="Accent"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Accent Color */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Couleur d&apos;accentuation (Accent Color)
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    {accentColorsList.map((ac) => {
                      const palette = ACCENT_PALETTES[ac];
                      const isSelected = preferences.accentColor === ac;
                      return (
                        <button
                          key={ac}
                          onClick={() => updatePreferences({ accentColor: ac })}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold capitalize transition cursor-pointer ${
                            isSelected
                              ? "border-[var(--foreground)] bg-[var(--surface-elevated)] shadow-sm"
                              : "border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)]"
                          }`}
                        >
                          <span
                            className="h-4 w-4 rounded-full shadow-xs"
                            style={{ backgroundColor: palette.primary }}
                          />
                          <span>{ac}</span>
                          {isSelected && <Check className="h-3 w-3 ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Colors Section (if Custom active) */}
                {preferences.colorTheme === "custom" && (
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                      Configuration du Thème Customisé
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                      {[
                        { key: "background", label: "Background" },
                        { key: "surface", label: "Surface" },
                        { key: "foreground", label: "Foreground" },
                        { key: "primary", label: "Primary" },
                        { key: "accent", label: "Accent" },
                        { key: "border", label: "Border" },
                      ].map((c) => (
                        <div key={c.key} className="space-y-1">
                          <label className="font-semibold block text-[var(--muted-foreground)]">
                            {c.label}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={
                                customColorsMap[c.key] || (resolvedIsDark ? "#0d1117" : "#ffffff")
                              }
                              onChange={(e) =>
                                updatePreferences({
                                  customColors: {
                                    background: "#0d1117",
                                    surface: "#161b22",
                                    foreground: "#f0f6fc",
                                    primary: "#c6623f",
                                    accent: "#df7450",
                                    border: "#30363d",
                                    ...(preferences.customColors || {}),
                                    [c.key]: e.target.value,
                                  },
                                })
                              }
                              className="h-7 w-10 rounded border border-[var(--border)] cursor-pointer bg-transparent p-0"
                            />
                            <span className="font-mono text-[11px]">
                              {customColorsMap[c.key] || "—"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* UI Density & Font Size */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Densité de l&apos;interface (UI Density)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["compact", "normal", "comfortable"] as UiDensity[]).map((d) => (
                        <button
                          key={d}
                          onClick={() => updatePreferences({ uiDensity: d })}
                          className={`py-2 rounded-xl border text-xs font-semibold capitalize transition cursor-pointer ${
                            preferences.uiDensity === d
                              ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                              : "border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)]"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Taille de police (Font Size: {preferences.fontSize}px)
                    </label>
                    <div className="flex items-center gap-3 pt-2">
                      <span className="text-xs text-[var(--muted-foreground)]">12px</span>
                      <input
                        type="range"
                        min="11"
                        max="18"
                        step="1"
                        value={preferences.fontSize}
                        onChange={(e) => updatePreferences({ fontSize: parseInt(e.target.value, 10) })}
                        className="flex-1 accent-[var(--primary)] cursor-pointer"
                      />
                      <span className="text-xs text-[var(--muted-foreground)]">18px</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. EDITOR */}
            {activeCategory === "editor" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-base font-bold">Monaco Editor Configuration</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Paramètres de l&apos;éditeur de code intégré et de la coloration syntaxique.
                  </p>
                </div>
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]">
                    <div>
                      <div className="font-bold">Mini-map de l&apos;éditeur</div>
                      <div className="text-[var(--muted-foreground)] text-[11px]">Afficher la mini-carte à droite de l&apos;éditeur</div>
                    </div>
                    <input type="checkbox" defaultChecked className="h-4 w-4 accent-[var(--primary)] cursor-pointer" />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]">
                    <div>
                      <div className="font-bold">Formatage automatique à la sauvegarde</div>
                      <div className="text-[var(--muted-foreground)] text-[11px]">Utiliser Prettier lors de l&apos;enregistrement</div>
                    </div>
                    <input type="checkbox" defaultChecked className="h-4 w-4 accent-[var(--primary)] cursor-pointer" />
                  </div>
                </div>
              </div>
            )}

            {/* 3. TERMINAL */}
            {activeCategory === "terminal" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-base font-bold">Integrated Terminal Settings</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Configuration des PTY, polices de terminal et comportement des commandes.
                  </p>
                </div>
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]">
                    <div>
                      <div className="font-bold">Police Monospace du Terminal</div>
                      <div className="text-[var(--muted-foreground)] text-[11px]">JetBrains Mono / Fira Code</div>
                    </div>
                    <select className="bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs">
                      <option>JetBrains Mono</option>
                      <option>Fira Code</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 4. ENVIRONMENT */}
            {activeCategory === "environment" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-base font-bold">Runtime Environment</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    État des conteneurs, sandboxes et backends d&apos;exécution actifs.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted-foreground)]">Environnement actif</span>
                    <span className="font-bold text-emerald-500">☁ GitHub Codespaces / Local PTY</span>
                  </div>
                </div>
              </div>
            )}

            {/* 5. GIT */}
            {activeCategory === "git" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-base font-bold">Git & Version Control</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Gestion des branches, intégration GitHub et synchronisation distante.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted-foreground)]">Utilisateur Git configuré</span>
                    <span className="font-mono">SoryOS User &lt;user@soryos.internal&gt;</span>
                  </div>
                </div>
              </div>
            )}

            {/* 6. AI / AGENT */}
            {activeCategory === "ai" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-base font-bold">AI & OpenCode Agents</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Configuration des agents autonomes et des modèles de raisonnement.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted-foreground)]">Modèle par défaut</span>
                    <span className="font-mono">Gemini 2.5 Flash / OpenCode Zen</span>
                  </div>
                </div>
              </div>
            )}

            {/* 7. PROVIDERS */}
            {activeCategory === "providers" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-base font-bold">Cloud Providers & Keys</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Gestion des clés d&apos;API pour Google Gemini, OpenRouter, DeepSeek, E2B et Vercel.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span>Google Gemini / AI Studio</span>
                    <span className="text-emerald-500 font-bold">Connecté (Key active)</span>
                  </div>
                </div>
              </div>
            )}

            {/* 8. ABOUT */}
            {activeCategory === "about" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-base font-bold">About SoryOS-Code</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Informations sur la version et l&apos;architecture de l&apos;application.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted-foreground)]">Version</span>
                    <span className="font-bold font-mono">v2.5.0 Production</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] p-6 space-y-4 shadow-2xl">
            <h4 className="text-base font-bold">Confirmer la réinitialisation ?</h4>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Ceci va restaurer les paramètres d&apos;apparence par défaut (Thème Système, SoryOS, Accent Bleu).
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setResetModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold hover:bg-[var(--surface-hover)] transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleResetConfirm}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition cursor-pointer shadow-md"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
