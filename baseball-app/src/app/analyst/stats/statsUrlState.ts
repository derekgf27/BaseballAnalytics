/**
 * Shared stats page query parsing (no "use client") — safe to call from Server Components.
 */

import type { StatsRunnersFilterKey } from "@/lib/types";

/** Display labels for Runners toolbar + active-filter summary */
export const STATS_RUNNERS_LABEL: Record<StatsRunnersFilterKey, string> = {
  all: "All situations",
  basesEmpty: "Bases empty",
  runnersOn: "Runners on",
  risp: "RISP",
  basesLoaded: "Bases loaded",
};

export type StatsPageUrlState = {
  tab: string | null;
  bo: string;
  bp: string;
  po: string;
  pb: string;
  bfc: string | null;
  pfc: string | null;
  bbs: string | null;
  pbs: string | null;
};

export function firstStringParam(
  sp: Record<string, string | string[] | undefined>,
  key: string
): string | null {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v.length > 0) return v[0] ?? null;
  return null;
}

export function buildStatsUrlState(get: (key: string) => string | null): StatsPageUrlState {
  return {
    tab: get("tab"),
    bo: get("bo") ?? "",
    bp: get("bp") ?? "",
    po: get("po") ?? "",
    pb: get("pb") ?? "",
    bfc: get("bfc"),
    pfc: get("pfc"),
    bbs: get("bbs"),
    pbs: get("pbs"),
  };
}

export function buildStatsUrlStateFromNextSearchParams(
  sp: Record<string, string | string[] | undefined>
): StatsPageUrlState {
  return buildStatsUrlState((k) => firstStringParam(sp, k));
}
