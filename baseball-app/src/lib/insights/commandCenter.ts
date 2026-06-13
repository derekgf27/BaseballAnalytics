/**
 * Command-center dashboard composition — executive summary, actions, story, alerts.
 */

import { ourTeamOutcomeFromFinalScore } from "@/lib/gameRecord";
import type { Game } from "@/lib/types";
import type { InsightPriority, TrendDirection } from "./types";
import type {
  DashboardRecommendation,
  KpiCard,
  PitchIntelligence,
  PitchTypeRow,
  PitcherTrendRow,
  PlayerTrendRow,
} from "./dashboard";

export type ExecutiveSummary = {
  healthScore: number;
  trend: TrendDirection;
  trendLabel: string;
  biggestPositive: { headline: string; detail: string } | null;
  biggestConcern: { headline: string; detail: string } | null;
  immediateRecommendation: string | null;
};

export type ActionItem = {
  id: string;
  action: string;
  reason: string;
  priority: InsightPriority;
};

export type ActionCenter = {
  offensive: ActionItem[];
  pitching: ActionItem[];
  defensive: ActionItem[];
};

export type HitterTrendTableRow = {
  playerId: string;
  name: string;
  ops: string;
  trendLabel: string;
  trendImproved: boolean;
  sampleLabel: string;
};

export type PitcherTrendTableRow = {
  playerId: string;
  name: string;
  era: string;
  whip: string;
  strikePct: string | null;
  trendLabel: string;
  trendImproved: boolean;
  sampleLabel: string;
};

export type PlayerTrendsSection = {
  hottestHitters: HitterTrendTableRow[];
  coldestHitters: HitterTrendTableRow[];
  hottestPitchers: PitcherTrendTableRow[];
  strugglingPitchers: PitcherTrendTableRow[];
};

export type PitchArsenalCard = {
  pitchType: string;
  pitchLabel: string;
  usagePct: number | null;
  avgAgainst: number | null;
  whiffPct: number | null;
  strikePct: number | null;
  swingPct: number | null;
};

export type PitchIntelligenceCenter = {
  arsenal: PitchArsenalCard[];
  bestPitch: PitchIntelligence["bestPitch"];
  mostDangerous: PitchIntelligence["worstPitch"];
  recommendedAdjustment: string | null;
};

export type TeamStoryItem = {
  id: string;
  text: string;
};

export type AlertFeedItem = {
  id: string;
  tone: "positive" | "warning" | "critical";
  message: string;
  sortScore: number;
};

export type DrillDownData = {
  kpis: KpiCard[];
  pitchRows: PitchTypeRow[];
  pitchKpis: KpiCard[];
  hotHitters: PlayerTrendRow[];
  coldHitters: PlayerTrendRow[];
  hotPitchers: PitcherTrendRow[];
  coldPitchers: PitcherTrendRow[];
};

export const EMPTY_EXECUTIVE: ExecutiveSummary = {
  healthScore: 50,
  trend: "stable",
  trendLabel: "Stable",
  biggestPositive: null,
  biggestConcern: null,
  immediateRecommendation: null,
};

export const EMPTY_ACTION_CENTER: ActionCenter = {
  offensive: [],
  pitching: [],
  defensive: [],
};

export const EMPTY_PLAYER_TRENDS: PlayerTrendsSection = {
  hottestHitters: [],
  coldestHitters: [],
  hottestPitchers: [],
  strugglingPitchers: [],
};

export const EMPTY_PITCH_CENTER: PitchIntelligenceCenter = {
  arsenal: [],
  bestPitch: null,
  mostDangerous: null,
  recommendedAdjustment: null,
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function winRate(games: Game[]): number | null {
  let w = 0;
  let d = 0;
  for (const g of games) {
    const o = ourTeamOutcomeFromFinalScore(g);
    if (o == null) continue;
    d++;
    if (o === "W") w++;
  }
  return d > 0 ? w / d : null;
}

function kpiScoreDelta(kpi: KpiCard, weight: number): number {
  if (kpi.positive == null || kpi.direction === "stable") return 0;
  return kpi.positive ? weight : -weight;
}

export function buildExecutiveSummary(
  kpis: KpiCard[],
  recommendations: DashboardRecommendation[],
  last3Games: Game[],
  prevGames: Game[]
): ExecutiveSummary {
  let score = 50;
  const ops = kpis.find((k) => k.metric === "OPS");
  const k = kpis.find((k) => k.metric === "K%");
  const risp = kpis.find((k) => k.metric === "RISP AVG");
  const strike = kpis.find((k) => k.metric === "Strike%");
  const bb = kpis.find((k) => k.metric === "BB%");

  if (ops) score += kpiScoreDelta(ops, 18);
  if (k) score += kpiScoreDelta(k, 12);
  if (risp) score += kpiScoreDelta(risp, 14);
  if (strike) score += kpiScoreDelta(strike, 12);
  if (bb) score += kpiScoreDelta(bb, 6);

  const lastWr = winRate(last3Games);
  const prevWr = winRate(prevGames);
  if (lastWr != null && prevWr != null) {
    const diff = lastWr - prevWr;
    if (diff >= 0.34) score += 10;
    else if (diff > 0) score += 5;
    else if (diff <= -0.34) score -= 10;
    else if (diff < 0) score -= 5;
  }

  score = clamp(Math.round(score), 0, 100);

  const candidates: Array<{ kind: "pos" | "neg"; headline: string; detail: string; weight: number }> = [];

  for (const kpi of kpis) {
    if (kpi.positive == null || kpi.direction === "stable") continue;
    const detail = `${kpi.current} vs ${kpi.previous} prior sample (${kpi.diffLabel})`;
    if (kpi.positive) {
      candidates.push({
        kind: "pos",
        headline: `Team ${kpi.metric} up ${kpi.diffLabel.replace("+", "")}`,
        detail,
        weight: kpi.metric === "OPS" ? 100 : kpi.metric === "RISP AVG" ? 90 : 70,
      });
    } else {
      candidates.push({
        kind: "neg",
        headline: `Team ${kpi.metric} down to ${kpi.current}`,
        detail: `${kpi.diffLabel} from prior sample (${kpi.previous})`,
        weight: kpi.metric === "RISP AVG" ? 95 : kpi.metric === "K%" ? 85 : 75,
      });
    }
  }

  const pos = candidates.filter((c) => c.kind === "pos").sort((a, b) => b.weight - a.weight)[0];
  const neg = candidates.filter((c) => c.kind === "neg").sort((a, b) => b.weight - a.weight)[0];

  const highRec = recommendations.find((r) => r.priority === "high") ?? recommendations[0];

  let trend: TrendDirection = "stable";
  let trendLabel = "Stable";
  if (score >= 62) {
    trend = "up";
    trendLabel = "Trending up";
  } else if (score <= 42) {
    trend = "down";
    trendLabel = "Trending down";
  }

  return {
    healthScore: score,
    trend,
    trendLabel,
    biggestPositive: pos ? { headline: pos.headline, detail: pos.detail } : null,
    biggestConcern: neg ? { headline: neg.headline, detail: neg.detail } : null,
    immediateRecommendation: highRec?.action ?? null,
  };
}

function categorizeRecommendation(rec: DashboardRecommendation): keyof ActionCenter {
  const text = `${rec.action} ${rec.reason} ${rec.id}`.toLowerCase();
  if (
    text.includes("pitch") ||
    text.includes("slider") ||
    text.includes("curve") ||
    text.includes("fastball") ||
    text.includes("whiff") ||
    text.includes("strike")
  ) {
    return "pitching";
  }
  if (
    text.includes("shift") ||
    text.includes("defense") ||
    text.includes("outfield") ||
    text.includes("infield")
  ) {
    return "defensive";
  }
  return "offensive";
}

export function buildActionCenter(
  recommendations: DashboardRecommendation[],
  pitchIntel: PitchIntelligence,
  coldHitters: PlayerTrendRow[],
  hotHitters: PlayerTrendRow[],
  kpis: KpiCard[]
): ActionCenter {
  const center: ActionCenter = { offensive: [], pitching: [], defensive: [] };
  const seen = new Set<string>();

  const push = (bucket: keyof ActionCenter, item: ActionItem) => {
    const key = item.action.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    center[bucket].push(item);
  };

  for (const rec of recommendations) {
    push(categorizeRecommendation(rec), {
      id: rec.id,
      action: rec.action,
      reason: rec.reason,
      priority: rec.priority,
    });
  }

  if (pitchIntel.worstPitch) {
    push("pitching", {
      id: "action.reduce_worst_pitch",
      action: `Reduce ${pitchIntel.worstPitch.pitchLabel} usage in hitter counts`,
      reason: `Allowing ${pitchIntel.worstPitch.value} AVG against in the sample`,
      priority: "high",
    });
  }

  if (pitchIntel.highestWhiff && pitchIntel.mostUsed) {
    if (pitchIntel.highestWhiff.pitchType !== pitchIntel.mostUsed.pitchType) {
      push("pitching", {
        id: "action.more_whiff_pitch",
        action: `Increase ${pitchIntel.highestWhiff.pitchLabel} usage in two-strike counts`,
        reason: `${pitchIntel.highestWhiff.value} whiff rate — best miss pitch in the sample`,
        priority: "medium",
      });
    }
  }

  const strikeKpi = kpis.find((k) => k.metric === "Strike%");
  if (strikeKpi?.positive === false) {
    push("pitching", {
      id: "action.first_pitch_strikes",
      action: "Emphasize first-pitch strikes in bullpen and game prep",
      reason: `Strike rate ${strikeKpi.current} (${strikeKpi.diffLabel} vs prior)`,
      priority: "high",
    });
  }

  const rispKpi = kpis.find((k) => k.metric === "RISP AVG");
  if (rispKpi?.positive === false) {
    push("offensive", {
      id: "action.risp_contact",
      action: "Emphasize contact approach with runners in scoring position",
      reason: `RISP AVG ${rispKpi.current} (${rispKpi.diffLabel} vs prior sample)`,
      priority: "high",
    });
  }

  for (const p of hotHitters.slice(0, 2)) {
    push("offensive", {
      id: `action.hot.${p.playerId}`,
      action: `Keep ${p.name} in a run-production spot`,
      reason: `${p.primaryLine.label} ${p.primaryLine.formatted} (${p.sampleLabel.toLowerCase()})`,
      priority: "medium",
    });
  }

  for (const p of coldHitters.slice(0, 2)) {
    push("offensive", {
      id: `action.rest.${p.playerId}`,
      action: `Consider rest or platoon for ${p.name}`,
      reason: `${p.primaryLine.label} ${p.primaryLine.formatted} (${p.sampleLabel.toLowerCase()})`,
      priority: "medium",
    });
  }

  const kKpi = kpis.find((k) => k.metric === "K%");
  if (kKpi?.positive === false) {
    push("offensive", {
      id: "action.two_strike",
      action: "Shorten two-strike swings and hunt early-count pitches",
      reason: `Team K% ${kKpi.current} (${kKpi.diffLabel} vs prior)`,
      priority: "medium",
    });
  }

  push("defensive", {
    id: "action.shift_review",
    action: "Review middle-infield shift vs next opponent contact profile",
    reason: "Align defensive positioning with recent batted-ball trends",
    priority: "low",
  });

  push("defensive", {
    id: "action.pincherunner",
    action: "Identify pinch-runner spots late in close games",
    reason: "Speed on base can pressure bullpens in tight contests",
    priority: "low",
  });

  const cap = (items: ActionItem[]) => items.slice(0, 4);
  return {
    offensive: cap(center.offensive),
    pitching: cap(center.pitching),
    defensive: cap(center.defensive),
  };
}

export function buildPitchCenter(pitchIntel: PitchIntelligence): PitchIntelligenceCenter {
  const arsenal: PitchArsenalCard[] = pitchIntel.rows.slice(0, 6).map((r) => ({
    pitchType: r.pitchType,
    pitchLabel: r.pitchLabel,
    usagePct: r.usagePct,
    avgAgainst: r.avgAgainst,
    whiffPct: r.whiffPct,
    strikePct: r.strikePct,
    swingPct: r.chasePct,
  }));

  const recommendedAdjustment =
    pitchIntel.callouts[0]?.text ??
    (pitchIntel.highestWhiff && pitchIntel.mostUsed
      ? pitchIntel.highestWhiff.pitchType !== pitchIntel.mostUsed.pitchType
        ? `Increase ${pitchIntel.highestWhiff.pitchLabel} usage in two-strike counts.`
        : null
      : null);

  return {
    arsenal,
    bestPitch: pitchIntel.highestWhiff ?? pitchIntel.bestPitch,
    mostDangerous: pitchIntel.worstPitch,
    recommendedAdjustment,
  };
}

export function buildTeamStory(
  kpis: KpiCard[],
  pitchIntel: PitchIntelligence,
  hotHitters: PlayerTrendRow[],
  coldHitters: PlayerTrendRow[],
  hotPitchers: PitcherTrendRow[],
  coldPitchers: PitcherTrendRow[],
  last3Games: Game[],
  prevGames: Game[]
): TeamStoryItem[] {
  const lines: TeamStoryItem[] = [];
  const ops = kpis.find((k) => k.metric === "OPS");
  const obp = kpis.find((k) => k.metric === "OBP");
  const k = kpis.find((k) => k.metric === "K%");
  const risp = kpis.find((k) => k.metric === "RISP AVG");
  const strike = kpis.find((k) => k.metric === "Strike%");
  const whiffKpi = pitchIntel.kpis.find((k) => k.metric === "Whiff%");

  if (ops?.positive && (obp?.positive || k?.positive === false)) {
    lines.push({
      id: "story.offense_improved",
      text: "Team offense has improved over the last three games, driven by better on-base production and more competitive at-bats.",
    });
  } else if (ops?.positive === false) {
    lines.push({
      id: "story.offense_down",
      text: "Offensive production has dipped in the recent sample — the staff should prioritize quality of contact and count leverage.",
    });
  }

  if (strike?.positive === false && whiffKpi?.positive) {
    lines.push({
      id: "story.command_whiff_split",
      text: "Pitching command has declined despite improved swing-and-miss, suggesting misses are coming in non-competitive counts.",
    });
  } else if (strike?.positive) {
    lines.push({
      id: "story.command_up",
      text: "Staff strike rate is trending up — pitchers are attacking the zone more effectively in the recent window.",
    });
  }

  if (pitchIntel.highestWhiff) {
    lines.push({
      id: "story.best_whiff",
      text: `${pitchIntel.highestWhiff.pitchLabel} continues to be the staff's best swing-and-miss offering (${pitchIntel.highestWhiff.value} whiff rate).`,
    });
  }

  if (risp?.positive === false) {
    lines.push({
      id: "story.risp",
      text: "RISP production remains the primary offensive weakness — situational approach should be a focus in pre-game prep.",
    });
  }

  if (hotHitters.length >= 2) {
    const names = hotHitters
      .slice(0, 2)
      .map((p) => p.name)
      .join(" and ");
    lines.push({
      id: "story.hot_hitters",
      text: `${names} are carrying the recent offensive profile with strong slash-line trends.`,
    });
  }

  if (coldHitters.length >= 1) {
    lines.push({
      id: "story.cold_hitters",
      text: `${coldHitters
        .slice(0, 2)
        .map((p) => p.name)
        .join(" and ")} ${coldHitters.length === 1 ? "is" : "are"} in a cold stretch — monitor lineup leverage.`,
    });
  }

  if (hotPitchers.length >= 1) {
    lines.push({
      id: "story.hot_pitchers",
      text: `${hotPitchers
        .slice(0, 2)
        .map((p) => p.name)
        .join(" and ")} ${hotPitchers.length === 1 ? "has" : "have"} been effective in recent outings.`,
    });
  }

  if (coldPitchers.length >= 1) {
    lines.push({
      id: "story.cold_pitchers",
      text: `${coldPitchers
        .slice(0, 2)
        .map((p) => p.name)
        .join(" and ")} may need usage or role adjustments based on recent results.`,
    });
  }

  const lastWr = winRate(last3Games);
  const prevWr = winRate(prevGames);
  if (lastWr != null && prevWr != null && lastWr !== prevWr) {
    lines.push({
      id: "story.record",
      text:
        lastWr > prevWr
          ? "Recent win rate is up versus the prior sample — results are aligning with underlying trends."
          : "Recent win rate has slipped versus the prior sample despite some positive underlying metrics.",
    });
  }

  return lines.slice(0, 8);
}

function alertFromItem(
  id: string,
  tone: AlertFeedItem["tone"],
  message: string,
  sortScore: number
): AlertFeedItem {
  return { id, tone, message, sortScore };
}

export function buildAlertsFeed(
  kpis: KpiCard[],
  pitchIntel: PitchIntelligence,
  hotHitters: PlayerTrendRow[],
  coldHitters: PlayerTrendRow[],
  hotPitchers: PitcherTrendRow[],
  coldPitchers: PitcherTrendRow[],
  executive: ExecutiveSummary
): AlertFeedItem[] {
  const items: AlertFeedItem[] = [];
  const seen = new Set<string>();

  const add = (item: AlertFeedItem) => {
    const key = item.message.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) return;
    if (executive.biggestPositive?.headline.toLowerCase().includes(key.slice(0, 20))) return;
    seen.add(key);
    items.push(item);
  };

  for (const p of hotHitters.slice(0, 4)) {
    add(
      alertFromItem(
        `alert.hot.${p.playerId}`,
        "positive",
        `🔥 ${p.name} ${p.primaryLine.label} ${p.primaryLine.formatted} (${p.sampleLabel.toLowerCase()})`,
        80
      )
    );
  }

  for (const p of coldHitters.slice(0, 3)) {
    add(
      alertFromItem(
        `alert.cold.${p.playerId}`,
        "warning",
        `⚠️ ${p.name} ${p.primaryLine.label} ${p.primaryLine.formatted} (${p.sampleLabel.toLowerCase()})`,
        70
      )
    );
  }

  for (const p of hotPitchers.slice(0, 3)) {
    add(
      alertFromItem(
        `alert.pitcher.hot.${p.playerId}`,
        "positive",
        `🔥 ${p.name} ${p.primaryLine.label} ${p.primaryLine.formatted} (${p.sampleLabel.toLowerCase()})`,
        75
      )
    );
  }

  for (const p of coldPitchers.slice(0, 3)) {
    add(
      alertFromItem(
        `alert.pitcher.cold.${p.playerId}`,
        "warning",
        `⚠️ ${p.name} ${p.primaryLine.label} ${p.primaryLine.formatted} (${p.sampleLabel.toLowerCase()})`,
        65
      )
    );
  }

  if (pitchIntel.highestWhiff) {
    add(
      alertFromItem(
        "alert.whiff",
        "positive",
        `🔥 ${pitchIntel.highestWhiff.pitchLabel} generating ${pitchIntel.highestWhiff.value} whiff`,
        85
      )
    );
  }

  if (pitchIntel.worstPitch) {
    add(
      alertFromItem(
        "alert.worst_pitch",
        "warning",
        `⚠️ ${pitchIntel.worstPitch.pitchLabel} allowing ${pitchIntel.worstPitch.value} AVG`,
        88
      )
    );
  }

  for (const kpi of kpis) {
    if (kpi.positive == null || kpi.direction === "stable") continue;
    const tone: AlertFeedItem["tone"] = kpi.positive ? "positive" : "warning";
    const icon = kpi.positive ? "🔥" : "⚠️";
    add(
      alertFromItem(
        `alert.kpi.${kpi.metric}`,
        tone,
        `${icon} Team ${kpi.metric} ${kpi.current} (${kpi.diffLabel} vs prior)`,
        kpi.positive ? 60 : 82
      )
    );
  }

  items.sort((a, b) => b.sortScore - a.sortScore);
  return items.slice(0, 12);
}

/** Map internal trend rows to table display rows. */
export function buildPlayerTrendsSection(
  hotHitters: PlayerTrendRow[],
  coldHitters: PlayerTrendRow[],
  hotPitchers: PitcherTrendRow[],
  coldPitchers: PitcherTrendRow[],
  hitterOps: Map<string, string>,
  pitcherStats: Map<string, { era: string; whip: string; strikePct: string | null }>
): PlayerTrendsSection {
  const toHitter = (p: PlayerTrendRow, hot: boolean): HitterTrendTableRow => ({
    playerId: p.playerId,
    name: p.name,
    ops: hitterOps.get(p.playerId) ?? p.primaryLine.recent,
    trendLabel: hot ? "↑ Hot" : "↓ Cold",
    trendImproved: hot,
    sampleLabel: p.sampleLabel,
  });

  const toPitcher = (p: PitcherTrendRow, hot: boolean): PitcherTrendTableRow => {
    const stats = pitcherStats.get(p.playerId);
    return {
      playerId: p.playerId,
      name: p.name,
      era: stats?.era ?? "—",
      whip: stats?.whip ?? "—",
      strikePct: stats?.strikePct ?? null,
      trendLabel: hot ? "↑ On a roll" : "↓ Struggling",
      trendImproved: hot,
      sampleLabel: p.sampleLabel,
    };
  };

  return {
    hottestHitters: hotHitters.slice(0, 5).map((p) => toHitter(p, true)),
    coldestHitters: coldHitters.slice(0, 5).map((p) => toHitter(p, false)),
    hottestPitchers: hotPitchers.slice(0, 5).map((p) => toPitcher(p, true)),
    strugglingPitchers: coldPitchers.slice(0, 5).map((p) => toPitcher(p, false)),
  };
}

export function teamAlertsToFeedItems(_team: unknown): AlertFeedItem[] {
  return [];
}
