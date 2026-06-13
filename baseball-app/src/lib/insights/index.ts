export type {
  Insight,
  InsightKind,
  InsightCategory,
  InsightPriority,
  TrendDirection,
  InsightConfidence,
  InsightEvidence,
  TrendSummary,
  InsightsProfile,
  InsightsBundle,
  InsightsLimits,
} from "./types";
export { DEFAULT_INSIGHTS_LIMITS } from "./types";
export { buildInsightsContext, type InsightsContext } from "./context";
export { runInsightsEngine, insightTitles } from "./engine";
export { loadInsightsContext, fetchInsightsBundle, fetchInsightsDashboard } from "./loadContext";
export {
  buildInsightsDashboard,
  runInsightsDashboard,
  normalizeInsightsDashboard,
  EMPTY_ALERT_SECTION,
  EMPTY_DRILL_DOWN,
  EMPTY_PITCH_INTEL,
  INSIGHTS_DASHBOARD_CONFIG,
  type InsightsDashboard,
  type BriefingItem,
  type BriefingTone,
  type AlertCenterItem,
  type AlertCenterSection,
  type AlertCenterSplit,
  type PlayerTrendRow,
  type PlayerTrendLine,
  type PitcherTrendRow,
  type PitcherTrendLine,
  type PitcherTrendStatKey,
  type KpiCard,
  type PitchIntelligence,
  type PitchHighlight,
  type PitchTypeRow,
  type DashboardRecommendation,
} from "./dashboard";
export {
  type ExecutiveSummary,
  type ActionCenter,
  type ActionItem,
  type PlayerTrendsSection,
  type HitterTrendTableRow,
  type PitcherTrendTableRow,
  type PitchIntelligenceCenter,
  type PitchArsenalCard,
  type TeamStoryItem,
  type AlertFeedItem,
  type DrillDownData,
} from "./commandCenter";
export { playerInsightsForReport } from "./rules/players";
export { pregameInsightLines, postgameInsightSections, teamTrendInsightLines } from "./integrate";
