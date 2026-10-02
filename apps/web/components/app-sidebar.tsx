"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Sparkles, FolderDown, X, Layers } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { listSessions } from "@/lib/api";
import { ImportRepoModal } from "@/components/import-repo-modal";
import { PWAInstallButton } from "@/components/pwa-install-button";

interface AppSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AppSidebar({ mobileOpen = false, onMobileClose }: AppSidebarProps) {
  const [sessions, setSessions] = useState<
    Array<{ id: string; title: string; created_at: string }>
  >([]);
  const [isImportOpen, setIsImportOpen] = useState(false);

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
    <div className="flex h-full w-full flex-col bg-[#f5f1ea]">
      {/* Mobile Header with Close button */}
      <div className="flex items-center justify-between border-b border-[#e8e2d8] px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[#c6623f]" />
          <span className="font-semibold text-sm text-[#3d3830]">Menu & Projets</span>
        </div>
        <button
          onClick={onMobileClose}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-[#ebe5da] transition"
          aria-label="Fermer le menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="space-y-1 px-3 pt-4">
        <Link
          href="/"
          onClick={onMobileClose}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[#5c5348] transition-colors hover:bg-[#ebe5da] active:bg-[#e2dcce]"
        >
          <Plus className="h-4 w-4 shrink-0 text-[#c6623f]" />
          Nouvelle session
        </Link>
        <button
          onClick={() => {
            setIsImportOpen(true);
            onMobileClose?.();
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[#5c5348] transition-colors hover:bg-[#ebe5da] active:bg-[#e2dcce] text-left"
        >
          <FolderDown className="h-4 w-4 shrink-0 text-[#c6623f]" />
          Importer un projet
        </button>
      </nav>

      <div className="mt-5 px-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#c6623f]">
          Sessions récentes
        </p>
      </div>

      <ScrollArea className="mt-2 min-h-0 flex-1 px-3 pb-4">
        {sessions.length ? (
          <div className="space-y-1 pr-2">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/chat/${s.id}`}
                onClick={onMobileClose}
                className="block min-w-0 rounded-lg px-3 py-2.5 text-sm text-[#5c5348] transition-colors hover:bg-[#ebe5da] active:bg-[#e2dcce]"
                title={s.title}
              >
                <span className="block truncate font-medium">{s.title}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="px-3 py-2 text-xs text-[#8a8278]">Aucune session enregistrée</p>
        )}
      </ScrollArea>

      {/* PWA & Footer info */}
      <div className="border-t border-[#e8e2d8] p-3 space-y-2.5">
        <PWAInstallButton className="w-full justify-center" />

        <div className="flex items-center justify-between text-xs text-[#8a8278] pt-1">
          <div className="flex items-center gap-2 truncate">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#c6623f]" />
            <span className="truncate font-medium text-[#5c5348]">OpenCode Multiplatform</span>
          </div>
          <span className="shrink-0 rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
            PWA
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex h-full w-[240px] shrink-0 flex-col border-r border-[#e8e2d8]">
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
    </>
  );
}
