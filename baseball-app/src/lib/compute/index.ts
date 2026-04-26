/**
 * Computation layer — pure functions. No DB, no UI.
 * Used by both Analyst (charts, displayed ratings) and Coach (lineup, green light).
 */

export { ratingsFromEvents } from "./ratings";
export type { Ratings } from "@/lib/types";
export {
  lineupRoleFromRatings,
  getRoleLabel,
} from "./lineupRoles";
export {
  greenLightForRatings,
  greenLightForRecentPAs,
  swing30,
  hitAndRun,
  steal,
  bunt,
} from "./greenLight";
export {
  defensiveAlertsFromEvents,
  substitutionAlerts,
  type CoachAlert,
} from "./alerts";
export { trendFromRecentPAs, TREND_RECENT_PA_COUNT, type Trend } from "./trends";
export { platoonFromSplits, type PlatoonPreference } from "./platoon";
export {
  buildRETable,
  getExpectedRunsRemaining,
  getRunValueOfEvent,
  getRunImpact,
  buildRECounts,
  getBaseStateAfterResult,
  BASE_STATES,
  OUTS,
} from "./runExpectancy";
export type {
  RETable,
  REState,
  PAForRE,
  BaseStateAfterResultOpts,
} from "./runExpectancy";
