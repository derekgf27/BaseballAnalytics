"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { analystNavSectionForPath } from "@/lib/analystNavLinks";

export type BreadcrumbItem = { label: string; href: string | null };

const STATIC_LABELS: Record<string, string> = {
  games: "Games",
  reports: "Reports",
  roster: "Roster",
  "compare-players": "Compare players",
  stats: "Stats",
  opponents: "Opponents",
  lineup: "Lineup Construction",
  charts: "Charts",
  "run-expectancy": "Run Expectancy",
  record: "Record",
  log: "Log",
  review: "Review",
};

/** UUIDs and demo-* ids used in routes. */
function looksLikeUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function isGameIdSegment(parent: string | undefined, segment: string): boolean {
  return parent === "games" && (looksLikeUuid(segment) || segment.startsWith("demo-"));
}

function isPlayerIdSegment(parent: string | undefined, segment: string): boolean {
  return parent === "roster" && (looksLikeUuid(segment) || segment.startsWith("demo-"));
}

function isGameIdParam(id: string): boolean {
  return looksLikeUuid(id) || id.startsWith("demo-");
}

function segmentLabel(segment: string, parent: string | undefined): string {
  if (STATIC_LABELS[segment]) return STATIC_LABELS[segment];
  if (isGameIdSegment(parent, segment)) return "Game";
  if (isPlayerIdSegment(parent, segment)) return "Profile";
  if (parent === "opponents") {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  }
  return segment;
}

function buildCrumbs(pathname: string, searchParams: URLSearchParams): BreadcrumbItem[] {
  const opponentRaw = searchParams.get("opponentTeam");
  let opponentTeam: string | null = null;
  if (opponentRaw?.trim()) {
    try {
      opponentTeam = decodeURIComponent(opponentRaw.trim());
    } catch {
      opponentTeam = opponentRaw.trim();
    }
  }

  // Opponent roster: sidebar Opponents › Team › Roster
  if (pathname === "/analyst/roster" && opponentTeam) {
    const slug = encodeURIComponent(opponentTeam);
    return [
      { label: "Opponents", href: "/analyst/opponents" },
      { label: opponentTeam, href: `/analyst/opponents/${slug}` },
      { label: "Roster", href: null },
    ];
  }

  const gameId = searchParams.get("gameId");
  // Record with game: Games › Game (log hub) › Record
  if (pathname === "/analyst/record" && gameId && isGameIdParam(gameId)) {
    return [
      { label: "Games", href: "/analyst/games" },
      { label: "Game", href: `/analyst/games/${gameId}/log` },
      { label: "Record", href: null },
    ];
  }

  if (pathname === "/analyst") {
    return [{ label: "Dashboard", href: null }];
  }

  const section = analystNavSectionForPath(pathname);
  if (!section) {
    return [{ label: "Dashboard", href: "/analyst" }];
  }

  if (pathname === section.href) {
    return [{ label: section.label, href: null }];
  }

  const pathParts = pathname.split("/").filter(Boolean);
  const sectionParts = section.href.split("/").filter(Boolean);
  const rest = pathParts.slice(sectionParts.length);
  if (rest.length === 0) {
    return [{ label: section.label, href: null }];
  }

  const items: BreadcrumbItem[] = [{ label: section.label, href: section.href }];

  for (let i = 0; i < rest.length; i++) {
    const seg = rest[i];
    const parent = i === 0 ? sectionParts[sectionParts.length - 1] : rest[i - 1];
    const isLast = i === rest.length - 1;
    const label = segmentLabel(seg, parent);

    let hrefForSegment: string | null;
    if (isLast) {
      hrefForSegment = null;
    } else if (isGameIdSegment(parent, seg)) {
      hrefForSegment = `/analyst/games/${seg}/log`;
    } else {
      hrefForSegment = "/" + pathParts.slice(0, sectionParts.length + i + 1).join("/");
    }

    items.push({ label, href: hrefForSegment });
  }

  return items;
}

function BreadcrumbsInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const items = useMemo(
    () => buildCrumbs(pathname, searchParams),
    [pathname, searchParams]
  );

  if (pathname === "/analyst") return null;
  if (items.length === 0) return null;

  const singleSectionHome =
    items.length === 1 && items[0].href === null && analystNavSectionForPath(pathname)?.href === pathname;
  if (singleSectionHome) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[var(--text-muted)]">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && (
                <span className="text-[var(--text-faint)] select-none" aria-hidden>
                  /
                </span>
              )}
              {!isLast && item.href != null ? (
                <Link
                  href={item.href}
                  className="truncate font-medium text-[var(--accent)] transition hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={`truncate ${isLast ? "font-medium text-[var(--text)]" : ""}`}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function AnalystBreadcrumbs() {
  return (
    <Suspense fallback={<div className="mb-4 h-5" aria-hidden />}>
      <BreadcrumbsInner />
    </Suspense>
  );
}
