"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { listSessions } from "@/lib/api";

export function AppSidebar() {
  const [sessions, setSessions] = useState<
    Array<{ id: string; title: string; created_at: string }>
  >([]);

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

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-[#e8e2d8] bg-[#f5f1ea]">
      <nav className="px-3 pt-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#5c5348] transition-colors hover:bg-[#ebe5da]"
        >
          <Plus className="h-4 w-4 shrink-0" />
          New session
        </Link>
      </nav>

      <div className="mt-6 px-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#c6623f]/80">
          Sessions
        </p>
      </div>

      <ScrollArea className="mt-2 min-h-0 flex-1 px-3 pb-4">
        {sessions.length ? (
          <div className="space-y-1 pr-2">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/chat/${s.id}`}
                className="block min-w-0 px-3 py-2.5 text-sm text-[#5c5348] transition-colors hover:bg-[#ebe5da]"
                title={s.title}
              >
                <span className="block truncate">{s.title}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="px-3 text-xs text-[#8a8278]">No sessions yet</p>
        )}
      </ScrollArea>

      <div className="border-t border-[#e8e2d8] px-4 py-3">
        <div className="flex items-center justify-between text-xs text-[#8a8278]">
          <div className="flex items-center gap-2 truncate">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#c6623f]" />
            <span className="truncate font-medium text-[#5c5348]">OpenCode Zen & AI</span>
          </div>
          <span className="shrink-0 rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
            Free Tier
          </span>
        </div>
      </div>
    </aside>
  );
}
