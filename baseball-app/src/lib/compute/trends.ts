/**
 * Hot/cold trend from recent plate appearances (last 20 PAs), based on OPS.
 */

import { battingStatsFromPAs } from "./battingStats";
import type { PlateAppearance } from "@/lib/types";

export type Trend = "hot" | "cold" | "neutral";

/** OPS >= this over last 20 PAs = hot */
const HOT_OPS = 0.9;
/** OPS <= this over last 20 PAs = cold */
const COLD_OPS = 0.6;
const MIN_PA_FOR_TREND = 10;

/**
 * Return hot/cold/neutral based on OPS over the most recent PAs.
 * PAs should already be sorted by created_at desc (most recent first).
 */
export function trendFromRecentPAs(
  pas: PlateAppearance[],
  limit = 20
): Trend {
  const recent = pas.slice(0, limit);
  if (recent.length < MIN_PA_FOR_TREND) return "neutral";
  const stats = battingStatsFromPAs(recent);
  if (!stats || stats.ops == null) return "neutral";
  if (stats.ops >= HOT_OPS) return "hot";
  if (stats.ops <= COLD_OPS) return "cold";
  return "neutral";
}
