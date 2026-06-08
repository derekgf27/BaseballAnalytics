"use client";

import { Suspense, useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { guardNavUntilSidebarExpanded } from "@/lib/sidebarCollapsedNav";
import { AnalystNavLinks, AnalystNavLinksFallback } from "./AnalystNavLinks";

const STORAGE_KEY = "analyst-sidebar-collapsed";

export function AnalystNav({ footer }: { footer?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setCollapsed(stored === "true");
    } catch {
      // ignore
    }
    setPrefsReady(true);
  }, []);

  const persistCollapsed = (next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
  };

  const expandOnly = () => persistCollapsed(false);
  const showCollapsed = prefsReady && collapsed;

  return (
    <aside
      className="sidebar"
      aria-label="Analyst navigation"
      data-collapsed={showCollapsed ? "true" : undefined}
      suppressHydrationWarning
    >
      <div className="flex items-center gap-0.5 border-b border-[var(--border)] p-2">
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--text)] hover:bg-white/[0.06]"
          onClick={() => persistCollapsed(!collapsed)}
          aria-expanded={collapsed ? "false" : "true"}
          aria-controls="analyst-sidebar-nav"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          <span className="text-base leading-none" aria-hidden>
            {showCollapsed ? "\u203A" : "\u2039"}
          </span>
        </button>
        <Link
          href="/analyst"
          title={showCollapsed ? "Open menu — tap again to go to Analyst home" : undefined}
          onClick={(e) => guardNavUntilSidebarExpanded(e, showCollapsed, expandOnly)}
          className="font-orbitron flex min-w-0 flex-1 items-center gap-2 py-2 pl-0.5 text-sm font-semibold tracking-tight text-[var(--text)]"
        >
          <span className="sidebar-label truncate text-[var(--accent)]">Analyst</span>
        </Link>
      </div>
      <nav
        id="analyst-sidebar-nav"
        className="flex min-h-0 flex-col gap-0.5 overflow-y-auto py-3"
      >
        <Suspense
          fallback={
            <AnalystNavLinksFallback collapsed={showCollapsed} expandOnly={expandOnly} />
          }
        >
          <AnalystNavLinks collapsed={showCollapsed} expandOnly={expandOnly} />
        </Suspense>
        {footer}
      </nav>
    </aside>
  );
}
