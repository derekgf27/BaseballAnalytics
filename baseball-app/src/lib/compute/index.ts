/**
 * Computation layer — pure functions. No DB, no UI.
 * Used by both Analyst (charts, displayed ratings) and Coach (lineup, green light, situation, alerts).
 */

export { ratingsFromEvents } from "./ratings";
export type { Ratings } from "@/lib/types";
export {
  lineupRoleFromRatings,
  getRoleLabel,
} from "./lineupRoles";
export {
  greenLightForRatings,
  swing30,
  hitAndRun,
  steal,
  bunt,
} from "./greenLight";
export { situationPrompt, type SituationContext } from "./situation";
export {
  defensiveAlertsFromEvents,
  substitutionAlerts,
  type CoachAlert,
} from "./alerts";
export { trendFromRecentPAs, type Trend } from "./trends";
export { platoonFromSplits, type PlatoonPreference } from "./platoon";
