"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { guardNavUntilSidebarExpanded } from "@/lib/sidebarCollapsedNav";

const STORAGE_KEY = "coach-sidebar-collapsed";

const LINKS = [
  { href: "/coach", label: "Today", icon: "\u{1F4CB}", exact: true },
  { href: "/coach/matchup", label: "Matchup", icon: "\u{1F3AF}", exact: false },
  { href: "/coach/pitch-tracker", label: "Pitch tracker", icon: "\u{26BE}", exact: false },
  { href: "/coach/players", label: "Players", icon: "\u{1F464}", exact: false },
  { href: "/coach/lineup", label: "Lineup", icon: "\u{1F4DD}", exact: false },
  { href: "/coach/stats", label: "Stats", icon: "\u{1F4C8}", exact: false },
  { href: "/coach/compare-players", label: "Compare players", icon: "\u{2696}\u{FE0F}", exact: false },
  { href: "/coach/charts", label: "Charts", icon: "\u{1F4C9}", exact: false },
] as const;

export function CoachNav({ footer }: { footer?: ReactNode }) {
  const pathname = usePathname();
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
      aria-label="Coach navigation"
      data-collapsed={showCollapsed ? "true" : undefined}
      suppressHydrationWarning
    >
      <div className="flex items-center gap-0.5 border-b border-[var(--border)] p-2">
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--text)] hover:bg-white/[0.06]"
          onClick={() => persistCollapsed(!collapsed)}
          aria-expanded={collapsed ? "false" : "true"}
          aria-controls="coach-sidebar-nav"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          <span className="text-base leading-none" aria-hidden>
            {showCollapsed ? "\u203A" : "\u2039"}
          </span>
        </button>
        <Link
          href="/coach"
          title={showCollapsed ? "Open menu — tap again to go to Coach home" : undefined}
          onClick={(e) => guardNavUntilSidebarExpanded(e, showCollapsed, expandOnly)}
          className="font-orbitron flex min-w-0 flex-1 items-center py-2 pl-0.5 text-sm font-semibold tracking-tight"
        >
          <span className="sidebar-label truncate">Coach</span>
        </Link>
      </div>
      <nav
        id="coach-sidebar-nav"
        className="flex min-h-0 flex-col gap-0.5 overflow-y-auto py-3"
      >
        {LINKS.map((link) => {
          const { href, label, icon } = link;
          const exact = "exact" in link && link.exact;
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={showCollapsed ? `Open menu — tap again for ${label}` : undefined}
              onClick={(e) => guardNavUntilSidebarExpanded(e, showCollapsed, expandOnly)}
              className={`sidebar-link sidebar-link-coach ${active ? "[data-active=true]" : ""}`}
              data-active={active ? "true" : undefined}
            >
              <span className="sidebar-icon" aria-hidden>
                {icon}
              </span>
              <span className="sidebar-label">{label}</span>
            </Link>
          );
        })}
        {footer}
      </nav>
    </aside>
  );
}
