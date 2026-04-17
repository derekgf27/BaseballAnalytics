import type { HitDirection } from "@/lib/types";

/** Results treated as hits on spray charts. */
export const SPRAY_CHART_HIT_RESULTS = new Set([
  "single",
  "double",
  "triple",
  "hr",
]);

/** Results treated as outs for spray charts (balls in play with direction recorded). */
export const SPRAY_CHART_OUT_RESULTS = new Set([
  "out",
  "so",
  "so_looking",
  "gidp",
  "sac",
  "sac_fly",
  "sac_bunt",
  "fielders_choice",
]);

export type SprayResultFilterKey = "hits" | "outs" | "both";

/** Parse URL/query param for spray filters (Charts, Compare, etc.). */
export function parseSprayResultFilterKey(raw: string | null | undefined): SprayResultFilterKey {
  if (raw === "hits" || raw === "outs" || raw === "both") return raw;
  return "hits";
}

export function isValidSprayHitDirection(d: string | null | undefined): d is HitDirection {
  return d === "pulled" || d === "up_the_middle" || d === "opposite_field";
}

/** Row is eligible for spray (hit or tracked out) before Hits/Outs/Both filter. */
export function isSprayChartBipResult(result: string): boolean {
  return SPRAY_CHART_HIT_RESULTS.has(result) || SPRAY_CHART_OUT_RESULTS.has(result);
}

export function sprayResultMatchesFilter(result: string, filter: SprayResultFilterKey): boolean {
  const isHit = SPRAY_CHART_HIT_RESULTS.has(result);
  const isOut = SPRAY_CHART_OUT_RESULTS.has(result);
  if (filter === "hits") return isHit;
  if (filter === "outs") return isOut;
  return isHit || isOut;
}
