import { fmtDecimalNoLeadingZero } from "@/lib/format";
import { assignPriority } from "../priority";
import type { Insight, TrendSummary } from "../types";
import type { InsightsContext } from "../context";
import { flatOurBattingPas, metricsForWindow, compareMetricDelta, type OffenseWindowMetrics } from "../windows";

const MIN_PA_LAST3 = 12;
const MIN_PA_BASELINE = 20;
const OPS_TREND_THRESHOLD = 0.08;
const K_TREND_THRESHOLD = 0.05;
const BB_TREND_THRESHOLD = 0.04;
const AVG_TREND_THRESHOLD = 0.04;

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function insight(
  partial: Omit<Insight, "priority"> & { magnitude?: number; isAlert?: boolean }
): Insight {
  const { magnitude, isAlert, ...rest } = partial;
  return {
    ...rest,
    priority: assignPriority({
      kind: rest.kind,
      confidence: rest.confidence,
      magnitude,
      isAlert,
    }),
  };
}

export function runTeamOffenseRules(ctx: InsightsContext): { insights: Insight[]; trends: TrendSummary[] } {
  const insights: Insight[] = [];
  const trends: TrendSummary[] = [];
  const games = ctx.focusGame ? [ctx.focusGame, ...ctx.gamesNewestFirst.filter((g) => g.id !== ctx.focusGame!.id)] : ctx.gamesNewestFirst;
  const gamesNewest = ctx.focusGame && games[0]?.id === ctx.focusGame.id ? games : ctx.gamesNewestFirst;

  const last3 = metricsForWindow(gamesNewest, ctx.allPas, "last_3");
  const prev3Games = gamesNewest.slice(3, 6);
  const prev3 =
    prev3Games.length >= 2
      ? metricsForWindow(prev3Games, ctx.allPas, "last_3")
      : metricsForWindow(gamesNewest.slice(3), ctx.allPas, "season");
  const season = metricsForWindow(gamesNewest, ctx.allPas, "season");
  const last1 = metricsForWindow(gamesNewest, ctx.allPas, "last_game");
  const last5 = metricsForWindow(gamesNewest, ctx.allPas, "last_5");

  if (!last3 || !season) return { insights, trends };

  const compare = (
    label: string,
    current: OffenseWindowMetrics,
    baseline: OffenseWindowMetrics,
    getVal: (m: OffenseWindowMetrics) => number,
    fmt: (n: number) => string,
    threshold: number,
    higherIsBetter: boolean
  ) => {
    const cur = getVal(current);
    const base = getVal(baseline);
    const dir = compareMetricDelta(cur, base, threshold);
    if (dir === "stable" || current.pa < MIN_PA_LAST3) return;
    const improved = dir === "up" ? higherIsBetter : !higherIsBetter;
    trends.push({
      metric: label,
      direction: dir,
      window: "last_3_games",
      detail: `${label} ${dir === "up" ? "up" : "down"} (${fmt(cur)} vs ${fmt(base)} prior sample).`,
    });
    insights.push(
      insight({
        id: `team_offense.${label.replace(/\s+/g, "_").toLowerCase()}_trend`,
        kind: "observation",
        category: dir === "up" && higherIsBetter || dir === "down" && !higherIsBetter ? "trend" : "team_offense",
        title:
          dir === "up"
            ? `${label} increased compared to the previous sample (${fmt(cur)} vs ${fmt(base)}).`
            : `${label} declined compared to the previous sample (${fmt(cur)} vs ${fmt(base)}).`,
        trend: dir,
        evidence: [
          { label: "Last 3 games", value: fmt(cur) },
          { label: "Prior sample", value: fmt(base) },
          { label: "PA (last 3)", value: String(current.pa) },
        ],
        confidence: current.pa >= 24 ? "high" : current.pa >= MIN_PA_LAST3 ? "medium" : "low",
        magnitude: Math.abs(cur - base),
      })
    );
    void improved;
  };

  if (prev3 && last3.pa >= MIN_PA_LAST3 && prev3.pa >= MIN_PA_BASELINE) {
    compare("Team OPS", last3, prev3, (m) => m.ops, (n) => fmtDecimalNoLeadingZero(n, 3), OPS_TREND_THRESHOLD, true);
    compare("Team AVG", last3, prev3, (m) => m.avg, (n) => fmtDecimalNoLeadingZero(n, 3), AVG_TREND_THRESHOLD, true);
    compare("Strikeout rate", last3, prev3, (m) => m.kPct, pct, K_TREND_THRESHOLD, false);
    compare("Walk rate", last3, prev3, (m) => m.bbPct, pct, BB_TREND_THRESHOLD, true);
  }

  if (last3.rispPa >= 6 && prev3 && prev3.rispPa >= 6 && last3.rispAvg != null && prev3.rispAvg != null) {
    const dir = compareMetricDelta(last3.rispAvg, prev3.rispAvg, AVG_TREND_THRESHOLD);
    if (dir !== "stable") {
      insights.push(
        insight({
          id: "team_offense.risp_trend",
          kind: "observation",
          category: "situational",
          title:
            dir === "up"
              ? `Team hit ${fmtDecimalNoLeadingZero(last3.rispAvg, 3)} with runners in scoring position, up from ${fmtDecimalNoLeadingZero(prev3.rispAvg!, 3)} over the previous sample.`
              : `Team hit ${fmtDecimalNoLeadingZero(last3.rispAvg, 3)} with RISP, down from ${fmtDecimalNoLeadingZero(prev3.rispAvg!, 3)} over the previous sample.`,
          trend: dir,
          evidence: [
            { label: "RISP AVG (last 3)", value: fmtDecimalNoLeadingZero(last3.rispAvg, 3) },
            { label: "RISP PA", value: String(last3.rispPa) },
          ],
          confidence: last3.rispPa >= 12 ? "medium" : "low",
          magnitude: Math.abs(last3.rispAvg - prev3.rispAvg),
        })
      );
    }
  }

  if (last1 && last1.pa >= 4 && last1.kPct >= 0.34) {
    insights.push(
      insight({
        id: "team_offense.last_game_k",
        kind: "observation",
        category: "team_offense",
        title: `Strikeout rate was ${pct(last1.kPct)} in the most recent game (${last1.pa} PA).`,
        evidence: [{ label: "K%", value: pct(last1.kPct) }],
        confidence: "medium",
        magnitude: last1.kPct - 0.21,
      })
    );
  }

  if (last5 && last5.pa >= 20 && last5.bbPct < 0.06) {
    insights.push(
      insight({
        id: "team_offense.low_bb",
        kind: "observation",
        category: "team_offense",
        title: `Walk rate is ${pct(last5.bbPct)} over the last ${last5.games} games — plate discipline may be worth a conversation.`,
        evidence: [{ label: "BB%", value: pct(last5.bbPct) }],
        confidence: "medium",
      })
    );
  }

  return { insights, trends };
}

/** Single-game offensive notes (postgame). */
export function runPostgameOffenseRules(ctx: InsightsContext): Insight[] {
  if (!ctx.focusGame) return [];
  const pas = flatOurBattingPas([ctx.focusGame], ctx.allPas);
  const stats = metricsForWindow([ctx.focusGame], ctx.allPas, "last_game");
  if (!stats || stats.pa < 3) return [];

  const out: Insight[] = [];
  if (stats.rispPa >= 3 && stats.rispAvg != null && stats.rispAvg < 0.2) {
    out.push(
      insight({
        id: "postgame.risp_struggle",
        kind: "observation",
        category: "situational",
        title: "Struggled with runners in scoring position in this game.",
        detail: `${stats.rispPa} RISP PA, ${fmtDecimalNoLeadingZero(stats.rispAvg, 3)} AVG.`,
        evidence: [{ label: "RISP AVG", value: fmtDecimalNoLeadingZero(stats.rispAvg, 3) }],
        confidence: "medium",
        entityIds: { gameId: ctx.focusGame.id },
      })
    );
  }
  if (stats.kPct > 0.33) {
    out.push(
      insight({
        id: "postgame.high_k",
        kind: "observation",
        category: "team_offense",
        title: "Strikeouts were a big part of this offensive line.",
        evidence: [{ label: "K%", value: pct(stats.kPct) }],
        confidence: "medium",
        entityIds: { gameId: ctx.focusGame.id },
      })
    );
  }
  if (stats.bbPct < 0.06 && stats.pa >= 8) {
    out.push(
      insight({
        id: "postgame.low_bb",
        kind: "observation",
        category: "team_offense",
        title: "Low walk rate — worth reviewing early-count approaches.",
        evidence: [{ label: "BB%", value: pct(stats.bbPct) }],
        confidence: "medium",
        entityIds: { gameId: ctx.focusGame.id },
      })
    );
  }
  void pas;
  return out;
}
