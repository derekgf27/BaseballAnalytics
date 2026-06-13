/**
 * Computation layer — pure functions. No DB, no UI.
 * Used by both Analyst (charts, displayed ratings) and Coach (lineup, trends).
 */

export { ratingsFromEvents } from "./ratings";
export type { Ratings } from "@/lib/types";
export { trendFromRecentPAs, TREND_RECENT_PA_COUNT, type Trend } from "./trends";
export { platoonFromSplits, type PlatoonPreference } from "./platoon";
