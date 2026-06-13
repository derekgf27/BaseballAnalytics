import type { InsightsBundle } from "./types";
import { insightTitles } from "./engine";

/** Pre-game report: top 5 insights + top 3 alerts per spec. */
export function pregameInsightLines(bundle: InsightsBundle): string[] {
  const lines = [...insightTitles(bundle.insights.slice(0, 5)), ...insightTitles(bundle.alerts.slice(0, 3))];
  return [...new Set(lines)];
}

/** Post-game report sections from insights bundle. */
export function postgameInsightSections(bundle: InsightsBundle): {
  insights: string[];
  alerts: string[];
  recommendations: string[];
  trendChanges: string[];
  analystNotes: string[];
} {
  const insights = insightTitles(bundle.insights.slice(0, 5));
  const alerts = insightTitles(bundle.alerts.slice(0, 3));
  const recommendations = insightTitles(bundle.recommendations);
  const trendChanges = bundle.trends.map((t) => t.detail);
  const analystNotes =
    insights.length > 0
      ? insights
      : alerts.length > 0
        ? alerts
        : ["No auto-flags from the box — add film-based bullets below."];
  return { insights, alerts, recommendations, trendChanges, analystNotes };
}

/** Team trends tab / assistant context. */
export function teamTrendInsightLines(bundle: InsightsBundle): string[] {
  const lines = [...insightTitles(bundle.insights.slice(0, 6)), ...insightTitles(bundle.alerts.slice(0, 2))];
  if (lines.length === 0) {
    return ["Trend lines below — add more games for stronger narrative cues."];
  }
  return [...new Set(lines)];
}
