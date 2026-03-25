/**
 * Hot/cold trend from recent plate appearances (last N PAs), based on OPS.
 */

import { battingStatsFromPAs } from "./battingStats";
import type { PlateAppearance } from "@/lib/types";

export type Trend = "hot" | "cold" | "neutral";

/** Default window size for trend + displayed recent stats (coach lineup). */
export const TREND_RECENT_PA_COUNT = 15;

/** OPS >= this over the recent window = hot */
const HOT_OPS = 0.9;
/** OPS <= this over the recent window = cold */
const COLD_OPS = 0.6;
/** Need at least this many PAs in the window to classify hot/cold */
const MIN_PA_FOR_TREND = 8;

/**
 * Return hot/cold/neutral based on OPS over the most recent PAs.
 * PAs should already be sorted by created_at desc (most recent first).
 */
export function trendFromRecentPAs(
  pas: PlateAppearance[],
  limit = TREND_RECENT_PA_COUNT
): Trend {
  const recent = pas.slice(0, limit);
  if (recent.length < MIN_PA_FOR_TREND) return "neutral";
  const stats = battingStatsFromPAs(recent);
  if (!stats || stats.ops == null) return "neutral";
  if (stats.ops >= HOT_OPS) return "hot";
  if (stats.ops <= COLD_OPS) return "cold";
  return "neutral";
}
