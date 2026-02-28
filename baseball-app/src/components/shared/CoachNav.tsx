"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/coach", label: "Today", icon: "📋", exact: true },
  { href: "/coach/lineup", label: "Lineup", icon: "📝" },
  { href: "/coach/players", label: "Players", icon: "👤" },
  { href: "/coach/green-light", label: "Green light", icon: "🟢" },
  { href: "/coach/situation", label: "Situation", icon: "⚾" },
  { href: "/coach/alerts", label: "Alerts", icon: "⚠️" },
] as const;

export function CoachNav() {
  const pathname = usePathname();
  return (
    <aside className="sidebar" aria-label="Coach navigation">
      <div className="p-4 border-b border-[var(--border)]">
        <Link
          href="/coach"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[var(--text)]"
        >
          <span className="sidebar-icon opacity-90">👟</span>
          <span className="sidebar-label text-[var(--accent-coach)]">Coach</span>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 py-3">
        {LINKS.map(({ href, label, icon, exact }) => {
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
      </nav>
      <div className="border-t border-[var(--border)] p-2">
        <Link
          href="/"
          className="sidebar-link sidebar-link-coach opacity-70"
          title="Exit to home"
        >
          <span className="sidebar-icon" aria-hidden>←</span>
          <span className="sidebar-label">Exit</span>
        </Link>
      </div>
    </aside>
  );
}
