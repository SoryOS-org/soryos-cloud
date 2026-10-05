"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Sparkles, FolderDown, X, Layers, Settings, Cloud, Palette, MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { listSessions } from "@/lib/api";
import { ImportRepoModal } from "@/components/import-repo-modal";
import { SettingsPanel } from "@/components/settings-panel";
import { PWAInstallButton } from "@/components/pwa-install-button";

interface AppSidebarProps {
  currentSessionId?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AppSidebar({ currentSessionId, mobileOpen = false, onMobileClose }: AppSidebarProps) {
  const [sessions, setSessions] = useState<
    Array<{ id: string; title: string; created_at: string }>
  >([]);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    void listSessions()
      .then((data) => {
        if (mounted) setSessions(data || []);
      })
      .catch(() => {
        if (mounted) setSessions([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const sidebarContent = (
    <div className="flex h-full w-full flex-col bg-[var(--sidebar-background)] text-[var(--sidebar-foreground)] border-r border-[var(--border)]">
      {/* Mobile Header with Close button */}
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[var(--primary)]" />
          <span className="font-semibold text-sm text-[var(--foreground)]">Menu & Projets</span>
        </div>
        <button
          onClick={onMobileClose}
          className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition cursor-pointer"
          aria-label="Fermer le menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="space-y-1 px-3 pt-4">
        <Link
          href="/"
          onClick={onMobileClose}
          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[var(--sidebar-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] active:opacity-80"
        >
          <Plus className="h-4 w-4 text-[var(--primary)]" />
          <span>Nouveau projet IA</span>
        </Link>
        <button
          onClick={() => {
            setIsImportOpen(true);
            onMobileClose?.();
          }}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[var(--sidebar-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] active:opacity-80 cursor-pointer"
        >
          <FolderDown className="h-4 w-4 text-emerald-600" />
          <span>Importer un dépôt</span>
        </button>
        <button
          onClick={() => {
            setIsSettingsOpen(true);
            onMobileClose?.();
          }}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[var(--sidebar-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] active:opacity-80 cursor-pointer"
        >
          <Settings className="h-4 w-4 text-purple-500" />
          <span>Settings & Appearance</span>
        </button>
      </nav>

      <div className="px-3 pt-5 pb-2">
        <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
          Projets récents ({sessions.length})
        </p>
      </div>

      <ScrollArea className="mt-1 min-h-0 flex-1 px-3 pb-4">
        {sessions.length ? (
          <div className="space-y-1">
            {sessions.map((s) => {
              const isActive = s.id === currentSessionId;
              return (
                <Link
                  key={s.id}
                  href={`/chat/${s.id}`}
                  onClick={onMobileClose}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs transition border ${
                    isActive
                      ? "border-[var(--primary)]/40 bg-[var(--primary)]/10 text-[var(--primary)] font-bold shadow-2xs"
                      : "border-transparent text-[var(--sidebar-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] font-medium"
                  }`}
                  title={s.title}
                >
                  <MessageSquare
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"
                    }`}
                  />
                  <span className="block truncate flex-1">{s.title || "Session sans titre"}</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="px-3 py-2 text-xs text-[var(--muted-foreground)]">Aucune session enregistrée</p>
        )}
      </ScrollArea>

      {/* PWA & Footer info */}
      <div className="border-t border-[var(--border)] p-3 space-y-2.5 bg-[var(--surface-elevated)]">
        <PWAInstallButton className="w-full justify-center" />

        <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] pt-1">
          <div className="flex items-center gap-2 truncate">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
            <span className="truncate font-bold text-[var(--foreground)]">SoryOS-Code</span>
          </div>
          <span className="shrink-0 rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
            v3.0
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex h-full w-[240px] shrink-0 flex-col border-r border-[var(--border)]">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Overlay + Slide-over Panel) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={onMobileClose}
          />
          {/* Drawer Panel */}
          <div className="relative flex w-4/5 max-w-xs flex-1 flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}

      <ImportRepoModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
