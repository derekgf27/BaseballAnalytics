"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ANALYST_NAV_LINKS } from "@/lib/analystNavLinks";
import { guardNavUntilSidebarExpanded } from "@/lib/sidebarCollapsedNav";

const STORAGE_KEY = "analyst-sidebar-collapsed";

export function AnalystNav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setCollapsed(stored === "true");
    } catch {
      // ignore
    }
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

  return (
    <aside
      className="sidebar"
      aria-label="Analyst navigation"
      data-collapsed={collapsed ? "true" : undefined}
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
            {collapsed ? "\u203A" : "\u2039"}
          </span>
        </button>
        <Link
          href="/analyst"
          title={collapsed ? "Open menu — tap again to go to Analyst home" : undefined}
          onClick={(e) => guardNavUntilSidebarExpanded(e, collapsed, expandOnly)}
          className="font-orbitron flex min-w-0 flex-1 items-center gap-2 py-2 pl-0.5 text-sm font-semibold tracking-tight text-[var(--text)]"
        >
          <span className="sidebar-label truncate text-[var(--accent)]">Analyst</span>
        </Link>
      </div>
      <nav
        id="analyst-sidebar-nav"
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto py-3"
      >
        {ANALYST_NAV_LINKS.map(({ href, label, icon }) => {
          const active =
            href === "/analyst"
              ? pathname === "/analyst"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? `Open menu — tap again for ${label}` : undefined}
              onClick={(e) => guardNavUntilSidebarExpanded(e, collapsed, expandOnly)}
              className={`sidebar-link sidebar-link-analyst ${active ? "[data-active=true]" : ""}`}
              data-active={active ? "true" : undefined}
            >
              <span className="sidebar-icon" aria-hidden>
                {icon}
              </span>
              <span className="sidebar-label">{label}</span>
            </Link>
          );
        })}
        <div className="mt-2 shrink-0 border-t border-[var(--border)] pt-2">
          <Link
            href="/"
            className="sidebar-link sidebar-link-analyst opacity-70"
            title={
              collapsed ? "Open menu — tap again to exit to home" : "Exit to home"
            }
            onClick={(e) => guardNavUntilSidebarExpanded(e, collapsed, expandOnly)}
          >
            <span className="sidebar-icon" aria-hidden>
              &larr;
            </span>
            <span className="sidebar-label">Exit</span>
          </Link>
        </div>
      </nav>
    </aside>
  );
}
