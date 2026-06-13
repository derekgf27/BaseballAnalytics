export type InsightKind = "observation" | "alert" | "recommendation";

export type InsightCategory =
  | "team_offense"
  | "team_pitching"
  | "hitter"
  | "pitcher"
  | "pitch_type"
  | "situational"
  | "trend"
  | "alert";

export type InsightPriority = "high" | "medium" | "low";
export type TrendDirection = "up" | "down" | "stable";
export type InsightConfidence = "low" | "medium" | "high";

export type InsightEvidence = { label: string; value: string };

export type Insight = {
  id: string;
  kind: InsightKind;
  category: InsightCategory;
  priority: InsightPriority;
  title: string;
  detail?: string;
  trend?: TrendDirection;
  evidence: InsightEvidence[];
  entityIds?: { playerId?: string; gameId?: string };
  confidence: InsightConfidence;
};

export type TrendSummary = {
  metric: string;
  direction: TrendDirection;
  window: string;
  detail: string;
};

export type InsightsProfile = "pregame" | "postgame" | "player" | "team";

export type InsightsBundle = {
  insights: Insight[];
  alerts: Insight[];
  recommendations: Insight[];
  trends: TrendSummary[];
};

export type InsightsLimits = {
  maxInsights?: number;
  maxAlerts?: number;
  maxRecommendations?: number;
};

export const DEFAULT_INSIGHTS_LIMITS: Record<InsightsProfile, InsightsLimits> = {
  pregame: { maxInsights: 5, maxAlerts: 3, maxRecommendations: 3 },
  postgame: { maxInsights: 5, maxAlerts: 3, maxRecommendations: 4 },
  player: { maxInsights: 8, maxAlerts: 2, maxRecommendations: 2 },
  team: { maxInsights: 12, maxAlerts: 5, maxRecommendations: 4 },
};
