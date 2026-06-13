/**
 * Shared stats page query parsing (no "use client") — safe to call from Server Components.
 */

import { opponentNameKey } from "@/lib/opponentUtils";

export { STATS_RUNNERS_FILTER_ORDER, STATS_RUNNERS_LABEL } from "@/lib/statsRunnersFilter";

export type StatsPageUrlState = {
  tab: string | null;
  bo: string;
  bp: string;
  po: string;
  pb: string;
  bfc: string | null;
  bdc: string | null;
  bptc: string | null;
  pfc: string | null;
  pdc: string | null;
  ppc: string | null;
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

/** Match dropdown `option` values ({@link opponentNameKey}) even when the URL uses display casing. */
function normalizeOpponentFilterParam(raw: string | null): string {
  const s = raw?.trim();
  if (!s) return "";
  return opponentNameKey(s);
}

export function buildStatsUrlState(get: (key: string) => string | null): StatsPageUrlState {
  return {
    tab: get("tab"),
    bo: normalizeOpponentFilterParam(get("bo")),
    bp: get("bp") ?? "",
    po: normalizeOpponentFilterParam(get("po")),
    pb: get("pb") ?? "",
    bfc: get("bfc"),
    bdc: get("bdc"),
    bptc: get("bptc"),
    pfc: get("pfc"),
    pdc: get("pdc"),
    ppc: get("ppc"),
    bbs: get("bbs"),
    pbs: get("pbs"),
  };
}

export function buildStatsUrlStateFromNextSearchParams(
  sp: Record<string, string | string[] | undefined>
): StatsPageUrlState {
  return buildStatsUrlState((k) => firstStringParam(sp, k));
}
