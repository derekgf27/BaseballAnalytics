import { sortAndCap } from "./priority";
import type { InsightsBundle, InsightsProfile, InsightsLimits, Insight } from "./types";
import { DEFAULT_INSIGHTS_LIMITS as LIMITS } from "./types";
import type { InsightsContext } from "./context";
import { runTeamOffenseRules, runPostgameOffenseRules } from "./rules/teamOffense";
import { runTeamPitchingRules } from "./rules/teamPitching";
import { runPlayerRules } from "./rules/players";
import { runAlertRules } from "./rules/alerts";
import { runRecommendationRules } from "./rules/recommendations";

export function runInsightsEngine(
  ctx: InsightsContext,
  profile: InsightsProfile,
  limitsOverride?: Partial<InsightsLimits>
): InsightsBundle {
  const limits = { ...LIMITS[profile], ...limitsOverride };

  const all: Insight[] = [];
  const trends: InsightsBundle["trends"] = [];

  if (profile === "postgame") {
    all.push(...runPostgameOffenseRules(ctx));
  }

  const offense = runTeamOffenseRules(ctx);
  all.push(...offense.insights);
  trends.push(...offense.trends);

  if (profile !== "player") {
    all.push(...runTeamPitchingRules(ctx));
  }

  if (profile === "player" || profile === "pregame" || profile === "team") {
    all.push(...runPlayerRules(ctx));
  } else if (profile === "postgame") {
    all.push(...runPlayerRules(ctx));
  }

  const alertsFromRules = runAlertRules(ctx);
  const alertIds = new Set(alertsFromRules.map((a) => a.id));
  const playerAlerts = all.filter((i) => i.kind === "alert" && !alertIds.has(i.id));

  const alerts = sortAndCap([...alertsFromRules, ...playerAlerts], limits.maxAlerts);
  const alertIdSet = new Set(alerts.map((a) => a.id));

  const observations = all.filter((i) => i.kind === "observation" || (i.kind === "alert" && !alertIdSet.has(i.id)));
  const insights = sortAndCap(observations, limits.maxInsights);

  const recommendations = sortAndCap(runRecommendationRules([...all, ...alerts]), limits.maxRecommendations);

  return { insights, alerts, recommendations, trends };
}

export function insightTitles(items: { title: string }[]): string[] {
  return items.map((i) => i.title);
}

export { LIMITS };
