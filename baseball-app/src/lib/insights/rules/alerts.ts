import type { Insight } from "../types";
import type { InsightsContext } from "../context";
import { metricsForWindow } from "../windows";
import { assignPriority } from "../priority";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function insight(partial: Omit<Insight, "priority"> & { isAlert?: boolean }): Insight {
  const { isAlert, ...rest } = partial;
  return {
    ...rest,
    priority: assignPriority({ kind: rest.kind, confidence: rest.confidence, isAlert }),
  };
}

export function runAlertRules(ctx: InsightsContext): Insight[] {
  const alerts: Insight[] = [];
  const games = ctx.gamesNewestFirst;
  if (games.length === 0) return alerts;

  const last3 = metricsForWindow(games, ctx.allPas, "last_3");
  const last5 = metricsForWindow(games, ctx.allPas, "last_5");

  if (last3 && last3.pa >= 12 && last3.kPct > 0.3) {
    alerts.push(
      insight({
        id: "alert.team_k_rate",
        kind: "alert",
        category: "alert",
        title: `High strikeout alert: team K% is ${pct(last3.kPct)} over the last three games.`,
        evidence: [{ label: "K%", value: pct(last3.kPct) }],
        confidence: last3.pa >= 24 ? "high" : "medium",
        isAlert: true,
      })
    );
  }

  if (last5 && last5.rispPa >= 10 && last5.rispAvg != null && last5.rispAvg < 0.2) {
    alerts.push(
      insight({
        id: "alert.risp_cold",
        kind: "alert",
        category: "alert",
        title: `RISP alert: team AVG with runners in scoring position is below .200 over the last five games (${last5.rispPa} PA).`,
        evidence: [{ label: "RISP PA", value: String(last5.rispPa) }],
        confidence: "medium",
        isAlert: true,
      })
    );
  }

  return alerts;
}
