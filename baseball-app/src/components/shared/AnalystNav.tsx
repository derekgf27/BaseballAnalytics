"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "analyst-sidebar-collapsed";

const LINKS = [
  { href: "/analyst", label: "Dashboard", icon: "📊" },
  { href: "/analyst/games", label: "Games", icon: "📅" },
  { href: "/analyst/record", label: "Record PAs", icon: "✏️" },
  { href: "/analyst/players", label: "Players", icon: "👤" },
  { href: "/analyst/stats", label: "Stats", icon: "📋" },
  { href: "/analyst/lineup", label: "Lineup construction", icon: "📝" },
  { href: "/analyst/charts", label: "Charts", icon: "📈" },
] as const;

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

  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    if (collapsed) setCollapsed(false);
  };

  const handleMouseLeave = () => {
    if (collapsed) return;
    leaveTimeoutRef.current = setTimeout(() => {
      leaveTimeoutRef.current = null;
      setCollapsed(true);
      try {
        localStorage.setItem(STORAGE_KEY, "true");
      } catch {
        // ignore
      }
    }, 200);
  };

  return (
    <aside
      className="sidebar"
      aria-label="Analyst navigation"
      data-collapsed={collapsed ? "true" : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="border-b border-[var(--border)] p-2">
        <Link
          href="/analyst"
          className="flex items-center gap-2 py-2 pl-2 text-sm font-semibold tracking-tight text-[var(--text)]"
        >
          <span className="sidebar-icon shrink-0 opacity-90">📊</span>
          <span className="sidebar-label truncate text-[var(--accent)]">Analyst</span>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 py-3">
        {LINKS.map(({ href, label, icon }) => {
          const active =
            href === "/analyst"
              ? pathname === "/analyst"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`sidebar-link sidebar-link-analyst ${active ? "[data-active=true]" : ""}`}
              data-active={active ? "true" : undefined}
            >
              <span className="sidebar-icon" aria-hidden>{icon}</span>
              <span className="sidebar-label">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[var(--border)] p-2">
        <Link
          href="/"
          className="sidebar-link sidebar-link-analyst opacity-70"
          title="Exit to home"
        >
          <span className="sidebar-icon" aria-hidden>←</span>
          <span className="sidebar-label">Exit</span>
        </Link>
      </div>
    </aside>
  );
}
