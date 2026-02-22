/**
 * Hot/cold trend from recent plate appearances (e.g. last 20 PAs).
 */

import { battingStatsFromPAs } from "./battingStats";
import type { PlateAppearance } from "@/lib/types";

export type Trend = "hot" | "cold" | "neutral";

const HOT_WOBA = 0.36;
const COLD_WOBA = 0.28;
const MIN_PA_FOR_TREND = 10;

/**
 * Return hot/cold/neutral based on wOBA over the most recent PAs.
 * PAs should already be sorted by created_at desc (most recent first).
 */
export function trendFromRecentPAs(
  pas: PlateAppearance[],
  limit = 20
): Trend {
  const recent = pas.slice(0, limit);
  if (recent.length < MIN_PA_FOR_TREND) return "neutral";
  const stats = battingStatsFromPAs(recent);
  if (!stats || stats.woba == null) return "neutral";
  if (stats.woba >= HOT_WOBA) return "hot";
  if (stats.woba <= COLD_WOBA) return "cold";
  return "neutral";
}
