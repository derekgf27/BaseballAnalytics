/**
 * Analyst sidebar nav — single source of truth for href + label (order matches UI).
 * Used by AnalystNav and AnalystBreadcrumbs so the first breadcrumb matches the sidebar section.
 */
export const ANALYST_NAV_LINKS: readonly { href: string; label: string }[] = [
  { href: "/analyst", label: "Dashboard" },
  { href: "/analyst/players", label: "Players" },
  { href: "/analyst/stats", label: "Stats" },
  { href: "/analyst/games", label: "Games" },
  { href: "/analyst/opponents", label: "Opponents" },
  { href: "/analyst/lineup", label: "Lineup Construction" },
  { href: "/analyst/charts", label: "Charts" },
  { href: "/analyst/run-expectancy", label: "Run Expectancy" },
] as const;

/**
 * The sidebar section for this path: longest matching nav href (same idea as AnalystNav active state).
 */
export function analystNavSectionForPath(pathname: string): { href: string; label: string } | null {
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
