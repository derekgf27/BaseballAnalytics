"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "coach-sidebar-collapsed";

const LINKS = [
  { href: "/coach", label: "Today", icon: "📋", exact: true },
  { href: "/coach/lineup", label: "Lineup", icon: "📝", exact: false },
  { href: "/coach/players", label: "Players", icon: "👤", exact: false },
  { href: "/coach/green-light", label: "Green light", icon: "🟢", exact: false },
  { href: "/coach/situation", label: "Situation", icon: "⚾", exact: false },
] as const;

export function CoachNav() {
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
      aria-label="Coach navigation"
      data-collapsed={collapsed ? "true" : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="border-b border-[var(--border)] p-2">
        <Link
          href="/coach"
          className="font-display flex items-center gap-2 py-2 pl-2 text-sm font-semibold tracking-tight text-[var(--text)]"
        >
          <span className="sidebar-icon shrink-0 opacity-90">👟</span>
          <span className="sidebar-label truncate text-[var(--accent-coach)]">Coach</span>
        </Link>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto py-3">
        {LINKS.map((link) => {
          const { href, label, icon } = link;
          const exact = "exact" in link && link.exact;
          const active = exact
            ? pathname === href
            : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`sidebar-link sidebar-link-coach ${active ? "[data-active=true]" : ""}`}
              data-active={active ? "true" : undefined}
            >
              <span className="sidebar-icon" aria-hidden>{icon}</span>
              <span className="sidebar-label">{label}</span>
            </Link>
          );
        })}
        <div className="mt-2 shrink-0 border-t border-[var(--border)] pt-2">
          <Link
            href="/"
            className="sidebar-link sidebar-link-coach opacity-70"
            title="Exit to home"
          >
            <span className="sidebar-icon" aria-hidden>←</span>
            <span className="sidebar-label">Exit</span>
          </Link>
        </div>
      </nav>
    </aside>
  );
}
