/**
 * Analyst sidebar nav — single source of truth for href, label, icon (order matches UI).
 * Used by AnalystNav and AnalystBreadcrumbs so the first breadcrumb matches the sidebar section.
 */
export type AnalystNavLink = { readonly href: string; readonly label: string; readonly icon: string };

export const ANALYST_NAV_LINKS: readonly AnalystNavLink[] = [
  { href: "/analyst", label: "Dashboard", icon: "\u{1F4CA}" },
  { href: "/analyst/games", label: "Games", icon: "\u{1F19A}" },
  { href: "/analyst/lineup", label: "Lineup Construction", icon: "\u{1F4CB}" },
  { href: "/analyst/roster", label: "Roster", icon: "\u{1F464}" },
  { href: "/analyst/opponents", label: "Opponents", icon: "\u{1F3AF}" },
  { href: "/reports", label: "Reports", icon: "\u{1F4C4}" },
  { href: "/analyst/stats", label: "Stats", icon: "\u{1F4C8}" },
  { href: "/analyst/compare-players", label: "Compare players", icon: "\u{2696}\u{FE0F}" },
  { href: "/analyst/charts", label: "Charts", icon: "\u{1F4C9}" },
  { href: "/analyst/run-expectancy", label: "Run Expectancy", icon: "\u{1F9EE}" },
] as const;

/**
 * The sidebar section for this path: longest matching nav href (same idea as AnalystNav active state).
 */
export function analystNavSectionForPath(pathname: string): AnalystNavLink | null {
  const sorted = [...ANALYST_NAV_LINKS].sort((a, b) => b.href.length - a.href.length);
  for (const link of sorted) {
    if (link.href === "/analyst") {
      if (pathname === "/analyst") return link;
      continue;
    }
    if (pathname === link.href || pathname.startsWith(`${link.href}/`)) return link;
  }
  return null;
}
