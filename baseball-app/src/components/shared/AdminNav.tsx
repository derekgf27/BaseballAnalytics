"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { guardNavUntilSidebarExpanded } from "@/lib/sidebarCollapsedNav";

const STORAGE_KEY = "admin-sidebar-collapsed";

const LINKS = [{ href: "/admin/users", label: "Users", icon: "\u{1F465}", exact: false }] as const;

export function AdminNav({ footer }: { footer?: ReactNode }) {
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
      aria-label="Admin navigation"
      data-collapsed={showCollapsed ? "true" : undefined}
      suppressHydrationWarning
    >
      <div className="flex items-center gap-0.5 border-b border-[var(--border)] p-2">
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--text)] hover:bg-white/[0.06]"
          onClick={() => persistCollapsed(!collapsed)}
          aria-expanded={collapsed ? "false" : "true"}
          aria-controls="admin-sidebar-nav"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          <span className="text-base leading-none" aria-hidden>
            {showCollapsed ? "\u203A" : "\u2039"}
          </span>
        </button>
        <Link
          href="/admin/users"
          title={showCollapsed ? "Open menu — tap again to go to Admin home" : undefined}
          onClick={(e) => guardNavUntilSidebarExpanded(e, showCollapsed, expandOnly)}
          className="font-orbitron flex min-w-0 flex-1 items-center py-2 pl-0.5 text-sm font-semibold tracking-tight text-[var(--text)]"
        >
          <span className="sidebar-label truncate text-violet-300">Admin</span>
        </Link>
      </div>
      <nav
        id="admin-sidebar-nav"
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
              className={`sidebar-link sidebar-link-admin ${active ? "[data-active=true]" : ""}`}
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
