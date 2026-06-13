/**
 * Executive coaching dashboard — structured payload for the Insights page.
 */

import { battingStatsFromPAs } from "@/lib/compute/battingStats";
import { pitchingStatsFromPAs } from "@/lib/compute/pitchingStats";
import {
  aggregatePitchTypeBucketCounts,
  pitchTypeProfilesFromCounts,
  normalizePitchTypeBucket,
} from "@/lib/compute/pitchTypeProfileFromPas";
import { groupPitchEventsByPaId } from "@/lib/compute/contactProfileFromPas";
import { pitchOutcomeIsSwing } from "@/lib/compute/pitchSequence";
import { fmtDecimalNoLeadingZero } from "@/lib/format";
import { pitchTrackerTypeLabel } from "@/lib/pitchTrackerUi";
import { pasOurTeamBatting } from "@/lib/reports/postGameSnapshot";
import type { Bats, Game, PitchEvent, PitchingStats, PlateAppearance } from "@/lib/types";
import {
  buildActionCenter,
  buildAlertsFeed,
  buildExecutiveSummary,
  buildPitchCenter,
  buildPlayerTrendsSection,
  buildTeamStory,
  EMPTY_ACTION_CENTER,
  EMPTY_EXECUTIVE,
  EMPTY_PITCH_CENTER,
  EMPTY_PLAYER_TRENDS,
  type ActionCenter,
  type DrillDownData,
  type ExecutiveSummary,
  type PitchIntelligenceCenter,
  type PlayerTrendsSection,
  type TeamStoryItem,
  type AlertFeedItem,
} from "./commandCenter";
import type { InsightsContext } from "./context";
import { clubBatterIds, clubPitcherIds } from "./context";
import { runInsightsEngine } from "./engine";
import type { Insight, InsightPriority, InsightsBundle, TrendDirection } from "./types";
import {
  compareMetricDelta,
  flatOurBattingPas,
  metricsForWindow,
  offenseMetricsFromPas,
  type OffenseWindowMetrics,
} from "./windows";

// ---------------------------------------------------------------------------
// Configurable thresholds (player hot/cold classification)
// ---------------------------------------------------------------------------

export const INSIGHTS_DASHBOARD_CONFIG = {
  /** Recent sample: last N plate appearances per player */
  playerRecentPa: 10,
  /** Minimum recent PAs to classify a player */
  playerMinRecentPa: 6,
  /** Slash-line move (AVG/OBP/SLG/OPS) vs season to flag a trend line */
  playerRateDeltaThreshold: 0.08,
  /** K% / BB% point change vs season to flag a trend line */
  playerPctPointThreshold: 8,
  /** OPS delta vs season baseline to flag hot/cold */
  playerOpsDeltaThreshold: 0.1,
  /** Max briefing bullets */
  briefingMax: 6,
  /** Max players per hot/cold card */
  playerTrendMax: 8,
  /** Recent sample: last N batters faced per pitcher */
  pitcherRecentBf: 12,
  /** Minimum recent BF to classify a pitcher */
  pitcherMinRecentBf: 8,
  /** ERA move vs season to flag a trend line */
  pitcherEraDeltaThreshold: 1.0,
  /** WHIP move vs season to flag a trend line */
  pitcherWhipDeltaThreshold: 0.15,
  /** AVG against move vs season to flag a trend line */
  pitcherAvgDeltaThreshold: 0.05,
  /** K% / BB% / strike% / whiff% point change vs season */
  pitcherPctPointThreshold: 8,
  /** Max pitchers per hot/cold card */
  pitcherTrendMax: 8,
} as const;

export type BriefingTone = "positive" | "warning" | "critical";

export type BriefingItem = {
  id: string;
  tone: BriefingTone;
  headline: string;
};

export type AlertCenterItem = {
  id: string;
  title: string;
  /** Short metric name shown beside the value (e.g. "OPS", "AVG", "Whiff %"). */
  statLabel: string;
  stat: string;
  context: string;
  playerId?: string;
  /** When set, stat is a season → recent trend and may be colored */
  statImproved?: boolean;
};

export type AlertCenterSection = {
  concerns: AlertCenterItem[];
  strengths: AlertCenterItem[];
};

export type AlertCenterSplit = {
  team: AlertCenterSection;
  player: AlertCenterSection;
  pitcher: AlertCenterSection;
};

export type PlayerTrendStatKey = "OPS" | "AVG" | "OBP" | "SLG" | "K%" | "BB%";

export type PitcherTrendStatKey =
  | "ERA"
  | "WHIP"
  | "K%"
  | "BB%"
  | "Strike%"
  | "Whiff%"
  | "AVG vs";

export type PitcherTrendLine = {
  label: PitcherTrendStatKey;
  recent: string;
  season: string;
  formatted: string;
  magnitude: number;
  improved: boolean;
};

export type PitcherTrendRow = {
  playerId: string;
  name: string;
  sampleLabel: string;
  primaryLine: PitcherTrendLine;
  trendLines: PitcherTrendLine[];
  tone: "hot" | "cold";
};

const PLAYER_SLASH_STATS: PlayerTrendStatKey[] = ["OPS", "AVG", "OBP", "SLG"];

function slashTrendLines(lines: PlayerTrendLine[]): PlayerTrendLine[] {
  return lines.filter((l) => PLAYER_SLASH_STATS.includes(l.label));
}

export type PlayerTrendLine = {
  label: PlayerTrendStatKey;
  recent: string;
  season: string;
  /** Season → recent (e.g. `.701 → .851` or `22% → 35%`) */
  formatted: string;
  /** Absolute move used for ranking (rate units or percentage points) */
  magnitude: number;
  /** True when the move helps the hitter */
  improved: boolean;
};

export type PlayerTrendRow = {
  playerId: string;
  name: string;
  sampleLabel: string;
  /** Largest meaningful move vs season — shown in the UI */
  primaryLine: PlayerTrendLine;
  /** All qualifying moves (includes K% / BB% for reference; hot/cold uses slash only) */
  trendLines: PlayerTrendLine[];
  tone: "hot" | "cold";
};

export type KpiCard = {
  metric: string;
  current: string;
  previous: string;
  diffLabel: string;
  direction: TrendDirection;
  positive: boolean | null;
};

export type PitchHighlight = {
  label: string;
  pitchType: string;
  pitchLabel: string;
  value: string;
  subtext?: string;
};

export type PitchTypeRow = {
  pitchType: string;
  pitchLabel: string;
  usagePct: number | null;
  avgAgainst: number | null;
  slgAgainst: number | null;
  whiffPct: number | null;
  strikePct: number | null;
  chasePct: number | null;
  /** Share of the staff's first pitches thrown with this type */
  firstPitchMixPct: number | null;
  twoStrikeWhiffPct: number | null;
  gbPct: number | null;
  pitches: number;
};

export type PitchCallout = {
  id: string;
  text: string;
};

export type PitchIntelligence = {
  /** Last 3 games vs prior sample */
  kpis: KpiCard[];
  /** Short coaching notes derived from pitch logs */
  callouts: PitchCallout[];
  bestPitch: PitchHighlight | null;
  worstPitch: PitchHighlight | null;
  mostUsed: PitchHighlight | null;
  highestWhiff: PitchHighlight | null;
  bestPutaway: PitchHighlight | null;
  bestCommand: PitchHighlight | null;
  rows: PitchTypeRow[];
  sampleLabel: string;
};

export type DashboardRecommendation = {
  id: string;
  action: string;
  reason: string;
  priority: InsightPriority;
};

export type InsightsDashboard = {
  executive: ExecutiveSummary;
  actionCenter: ActionCenter;
  kpis: KpiCard[];
  playerTrends: PlayerTrendsSection;
  pitchCenter: PitchIntelligenceCenter;
  teamStory: TeamStoryItem[];
  alertsFeed: AlertFeedItem[];
  drillDown: DrillDownData;
  meta: { gameCount: number; paCount: number };
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function fmtRate(n: number): string {
  return fmtDecimalNoLeadingZero(n, 3);
}

function relativePctChange(cur: number, prev: number): string {
  if (!Number.isFinite(prev) || prev === 0) return "—";
  const rel = ((cur - prev) / Math.abs(prev)) * 100;
  const sign = rel >= 0 ? "+" : "";
  return `${sign}${Math.round(rel)}%`;
}

function pointPctChange(cur: number, prev: number): string {
  const pp = (cur - prev) * 100;
  const sign = pp >= 0 ? "+" : "";
  return `${sign}${Math.round(pp)}%`;
}

function trendPositive(metric: string, direction: TrendDirection): boolean | null {
  if (direction === "stable") return null;
  const m = metric.toLowerCase();
  const lowerIsBetter =
    m.includes("k%") ||
    m.includes("strikeout") ||
    m.includes("avg against") ||
    m.includes("era") ||
    m.includes("whip");
  return lowerIsBetter ? direction === "down" : direction === "up";
}

function ourPitchingPas(ctx: InsightsContext, games: Game[]): PlateAppearance[] {
  const pitcherIds = clubPitcherIds(ctx);
  const gameIds = new Set(games.map((g) => g.id));
  return ctx.allPas.filter(
    (p) => gameIds.has(p.game_id) && p.pitcher_id && pitcherIds.has(p.pitcher_id)
  );
}

function pitchLogMetrics(pas: PlateAppearance[], events: PitchEvent[]) {
  const byPa = groupPitchEventsByPaId(events);
  let pitches = 0;
  let strikes = 0;
  let swings = 0;
  let whiffs = 0;
  let firstPitches = 0;
  let firstPitchStrikes = 0;
  for (const pa of pas) {
    for (const e of byPa.get(pa.id) ?? []) {
      pitches += 1;
      const isStrike =
        e.outcome === "called_strike" || e.outcome === "swinging_strike" || e.outcome === "foul";
      if (isStrike) strikes += 1;
      if (e.pitch_index === 1) {
        firstPitches += 1;
        if (isStrike) firstPitchStrikes += 1;
      }
      if (pitchOutcomeIsSwing(e.outcome)) {
        swings += 1;
        if (e.outcome === "swinging_strike") whiffs += 1;
      }
    }
  }
  return {
    pitches,
    strikePct: pitches > 0 ? strikes / pitches : null,
    whiffPct: swings > 0 ? whiffs / swings : null,
    firstPitchStrikePct: firstPitches > 0 ? firstPitchStrikes / firstPitches : null,
  };
}

function baselineGames(gamesNewestFirst: Game[]): Game[] {
  const prev = gamesNewestFirst.slice(3, 6);
  return prev.length >= 2 ? prev : gamesNewestFirst.slice(3);
}

function lastNPasForBatter(
  ctx: InsightsContext,
  playerId: string,
  n: number
): PlateAppearance[] {
  const chronological = [...ctx.gamesNewestFirst].reverse();
  const out: PlateAppearance[] = [];
  for (const g of chronological) {
    const chunk = ctx.allPas.filter((p) => p.game_id === g.id && p.batter_id === playerId);
    out.push(...pasOurTeamBatting(g, chunk));
  }
  return out.slice(-n);
}

function seasonPasForBatter(ctx: InsightsContext, playerId: string): PlateAppearance[] {
  const chronological = [...ctx.gamesNewestFirst].reverse();
  return flatOurBattingPas(chronological, ctx.allPas).filter((p) => p.batter_id === playerId);
}

function buildKpiCard(
  metric: string,
  cur: number | null | undefined,
  prev: number | null | undefined,
  fmt: (n: number) => string,
  useRelativeDiff: boolean,
  threshold: number
): KpiCard | null {
  if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  const direction = compareMetricDelta(cur, prev, threshold);
  const positive = trendPositive(metric, direction);
  const diffLabel = useRelativeDiff ? relativePctChange(cur, prev) : pointPctChange(cur, prev);
  return {
    metric,
    current: fmt(cur),
    previous: fmt(prev),
    diffLabel,
    direction,
    positive,
  };
}

function fmtPctPair(n: number): string {
  return `${Math.round(n)}%`;
}

function fmtRateTrend(before: number, after: number): string {
  return `${fmtRate(before)} → ${fmtRate(after)}`;
}

function fmtPctTrend(before: number, after: number): string {
  return `${fmtPctPair(before)} → ${fmtPctPair(after)}`;
}

type SlashStats = { avg: number; obp: number; slg: number; ops: number; kPct: number; bbPct: number };

function slashFromBatting(s: NonNullable<ReturnType<typeof battingStatsFromPAs>>): SlashStats {
  return {
    avg: s.avg,
    obp: s.obp,
    slg: s.slg,
    ops: s.ops,
    kPct: (s.kPct ?? 0) * 100,
    bbPct: (s.bbPct ?? 0) * 100,
  };
}

function buildPlayerTrendLines(recent: SlashStats, season: SlashStats): PlayerTrendLine[] {
  const cfg = INSIGHTS_DASHBOARD_CONFIG;
  const lines: PlayerTrendLine[] = [];

  const pushRate = (label: "OPS" | "AVG" | "OBP" | "SLG", before: number, after: number) => {
    const magnitude = Math.abs(after - before);
    if (magnitude < cfg.playerRateDeltaThreshold) return;
    lines.push({
      label,
      recent: fmtRate(after),
      season: fmtRate(before),
      formatted: fmtRateTrend(before, after),
      magnitude,
      improved: after > before,
    });
  };

  pushRate("OPS", season.ops, recent.ops);
  pushRate("AVG", season.avg, recent.avg);
  pushRate("OBP", season.obp, recent.obp);
  pushRate("SLG", season.slg, recent.slg);

  const pushPct = (label: "K%" | "BB%", before: number, after: number, lowerIsBetter: boolean) => {
    const magnitude = Math.abs(after - before);
    if (magnitude < cfg.playerPctPointThreshold) return;
    lines.push({
      label,
      recent: fmtPctPair(after),
      season: fmtPctPair(before),
      formatted: fmtPctTrend(before, after),
      magnitude: magnitude / 100,
      improved: lowerIsBetter ? after < before : after > before,
    });
  };

  pushPct("K%", season.kPct, recent.kPct, true);
  pushPct("BB%", season.bbPct, recent.bbPct, false);

  const order: PlayerTrendStatKey[] = ["OPS", "AVG", "OBP", "SLG", "K%", "BB%"];
  lines.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  return lines;
}

function primaryLineForTone(
  tone: "hot" | "cold",
  trendLines: PlayerTrendLine[]
): PlayerTrendLine | null {
  const aligned = slashTrendLines(trendLines).filter((l) =>
    tone === "hot" ? l.improved : !l.improved
  );
  if (aligned.length === 0) return null;
  return [...aligned].sort((a, b) => b.magnitude - a.magnitude)[0]!;
}

function playerTrendTone(recentOps: number, seasonOps: number, lines: PlayerTrendLine[]): "hot" | "cold" | null {
  const cfg = INSIGHTS_DASHBOARD_CONFIG;
  const slash = slashTrendLines(lines);
  const improving = slash.filter((l) => l.improved);
  const worsening = slash.filter((l) => !l.improved);

  if (improving.length > 0 && worsening.length === 0) return "hot";
  if (worsening.length > 0 && improving.length === 0) return "cold";

  if (improving.length > worsening.length) return "hot";
  if (worsening.length > improving.length) return "cold";

  const opsDelta = recentOps - seasonOps;
  if (opsDelta >= cfg.playerOpsDeltaThreshold) return "hot";
  if (opsDelta <= -cfg.playerOpsDeltaThreshold) return "cold";

  return null;
}

function playerTrendContext(row: PlayerTrendRow): string {
  return row.sampleLabel;
}

function playerQualifies(recentOps: number, seasonOps: number, lines: PlayerTrendLine[]): boolean {
  const cfg = INSIGHTS_DASHBOARD_CONFIG;
  if (slashTrendLines(lines).length > 0) return true;
  return Math.abs(recentOps - seasonOps) >= cfg.playerOpsDeltaThreshold;
}

function buildPlayerTrends(ctx: InsightsContext): { hot: PlayerTrendRow[]; cold: PlayerTrendRow[] } {
  const cfg = INSIGHTS_DASHBOARD_CONFIG;
  const hot: PlayerTrendRow[] = [];
  const cold: PlayerTrendRow[] = [];

  for (const pid of clubBatterIds(ctx)) {
    const recentPas = lastNPasForBatter(ctx, pid, cfg.playerRecentPa);
    if (recentPas.length < cfg.playerMinRecentPa) continue;

    const seasonPas = seasonPasForBatter(ctx, pid);
    const recentBat = battingStatsFromPAs(recentPas);
    const seasonBat = battingStatsFromPAs(seasonPas);
    if (!recentBat || (recentBat.pa ?? 0) < cfg.playerMinRecentPa) continue;

    const recent = slashFromBatting(recentBat);
    const season = slashFromBatting(seasonBat ?? recentBat);
    const trendLines = buildPlayerTrendLines(recent, season);
    if (!playerQualifies(recent.ops, season.ops, trendLines)) continue;

    const tone = playerTrendTone(recent.ops, season.ops, trendLines);
    if (!tone) continue;

    const primary = primaryLineForTone(tone, trendLines);
    if (!primary) continue;

    const row: PlayerTrendRow = {
      playerId: pid,
      name: ctx.playersById.get(pid)?.name ?? "Unknown",
      sampleLabel: `Last ${recentPas.length} PA`,
      primaryLine: primary,
      trendLines: trendLines.length > 0 ? trendLines : [primary],
      tone,
    };

    if (tone === "hot") hot.push(row);
    else cold.push(row);
  }

  const byMagnitude = (a: PlayerTrendRow, b: PlayerTrendRow) =>
    b.primaryLine.magnitude - a.primaryLine.magnitude;

  hot.sort(byMagnitude);
  cold.sort(byMagnitude);

  return {
    hot: hot.slice(0, cfg.playerTrendMax),
    cold: cold.slice(0, cfg.playerTrendMax),
  };
}

const PITCHER_DISPLAY_STATS: PitcherTrendStatKey[] = [
  "ERA",
  "WHIP",
  "K%",
  "Strike%",
  "Whiff%",
  "AVG vs",
];

function pitcherDisplayTrendLines(lines: PitcherTrendLine[]): PitcherTrendLine[] {
  return lines.filter((l) => PITCHER_DISPLAY_STATS.includes(l.label));
}

type PitcherRateStats = {
  era: number;
  whip: number;
  kPct: number;
  bbPct: number;
  strikePct: number | null;
  whiffPct: number | null;
  avgAgainst: number | null;
};

function batterBatsById(ctx: InsightsContext): Map<string, Bats> {
  const map = new Map<string, Bats>();
  for (const p of ctx.playersById.values()) {
    map.set(p.id, p.bats ?? "R");
  }
  return map;
}

function starterGameIdsForPitcher(ctx: InsightsContext, pitcherId: string, pas: PlateAppearance[]): Set<string> {
  const gameIds = new Set(pas.map((p) => p.game_id));
  const starters = new Set<string>();
  for (const g of ctx.gamesNewestFirst) {
    if (!gameIds.has(g.id)) continue;
    if (g.starting_pitcher_home_id === pitcherId || g.starting_pitcher_away_id === pitcherId) {
      starters.add(g.id);
    }
  }
  return starters;
}

function pitchingLineForPas(
  ctx: InsightsContext,
  pitcherId: string,
  pas: PlateAppearance[]
): PitchingStats | null {
  if (pas.length === 0) return null;
  const eventsByPa = groupPitchEventsByPaId(ctx.pitchEvents);
  const withSplits = pitchingStatsFromPAs(
    pas,
    starterGameIdsForPitcher(ctx, pitcherId, pas),
    batterBatsById(ctx),
    eventsByPa
  );
  return withSplits?.overall ?? null;
}

function lastNBfForPitcher(ctx: InsightsContext, pitcherId: string, n: number): PlateAppearance[] {
  const chronological = [...ctx.gamesNewestFirst].reverse();
  const out: PlateAppearance[] = [];
  for (const g of chronological) {
    const chunk = ctx.allPas.filter((p) => p.game_id === g.id && p.pitcher_id === pitcherId);
    out.push(...chunk);
  }
  return out.slice(-n);
}

function seasonBfForPitcher(ctx: InsightsContext, pitcherId: string): PlateAppearance[] {
  const gameIds = new Set(ctx.gamesNewestFirst.map((g) => g.id));
  return ctx.allPas.filter((p) => p.pitcher_id === pitcherId && gameIds.has(p.game_id));
}

function slashFromPitching(stats: PitchingStats): PitcherRateStats {
  const rates = stats.rates;
  return {
    era: stats.era,
    whip: stats.whip,
    kPct: (rates.kPct ?? 0) * 100,
    bbPct: (rates.bbPct ?? 0) * 100,
    strikePct: rates.strikePct != null ? rates.strikePct * 100 : null,
    whiffPct: rates.whiffPct != null ? rates.whiffPct * 100 : null,
    avgAgainst: stats.abAgainst > 0 ? stats.h / stats.abAgainst : null,
  };
}

function fmtEra(n: number): string {
  return n.toFixed(2);
}

function fmtEraTrend(before: number, after: number): string {
  return `${fmtEra(before)} → ${fmtEra(after)}`;
}

function fmtWhipTrend(before: number, after: number): string {
  return `${before.toFixed(2)} → ${after.toFixed(2)}`;
}

function buildPitcherTrendLines(recent: PitcherRateStats, season: PitcherRateStats): PitcherTrendLine[] {
  const cfg = INSIGHTS_DASHBOARD_CONFIG;
  const lines: PitcherTrendLine[] = [];

  const pushLowerBetter = (
    label: "ERA" | "WHIP" | "AVG vs",
    before: number,
    after: number,
    threshold: number
  ) => {
    const magnitude = Math.abs(after - before);
    if (magnitude < threshold) return;
    lines.push({
      label,
      recent: label === "ERA" ? fmtEra(after) : label === "WHIP" ? after.toFixed(2) : fmtRate(after),
      season: label === "ERA" ? fmtEra(before) : label === "WHIP" ? before.toFixed(2) : fmtRate(before),
      formatted:
        label === "ERA"
          ? fmtEraTrend(before, after)
          : label === "WHIP"
            ? fmtWhipTrend(before, after)
            : fmtRateTrend(before, after),
      magnitude,
      improved: after < before,
    });
  };

  pushLowerBetter("ERA", season.era, recent.era, cfg.pitcherEraDeltaThreshold);
  pushLowerBetter("WHIP", season.whip, recent.whip, cfg.pitcherWhipDeltaThreshold);
  if (season.avgAgainst != null && recent.avgAgainst != null) {
    pushLowerBetter("AVG vs", season.avgAgainst, recent.avgAgainst, cfg.pitcherAvgDeltaThreshold);
  }

  const pushPct = (label: "K%" | "BB%" | "Strike%" | "Whiff%", before: number | null, after: number | null, lowerIsBetter: boolean) => {
    if (before == null || after == null) return;
    const magnitude = Math.abs(after - before);
    if (magnitude < cfg.pitcherPctPointThreshold) return;
    lines.push({
      label,
      recent: fmtPctPair(after),
      season: fmtPctPair(before),
      formatted: fmtPctTrend(before, after),
      magnitude: magnitude / 100,
      improved: lowerIsBetter ? after < before : after > before,
    });
  };

  pushPct("K%", season.kPct, recent.kPct, false);
  pushPct("BB%", season.bbPct, recent.bbPct, true);
  pushPct("Strike%", season.strikePct, recent.strikePct, false);
  pushPct("Whiff%", season.whiffPct, recent.whiffPct, false);

  const order: PitcherTrendStatKey[] = ["ERA", "WHIP", "AVG vs", "K%", "BB%", "Strike%", "Whiff%"];
  lines.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  return lines;
}

function primaryPitcherLineForTone(
  tone: "hot" | "cold",
  trendLines: PitcherTrendLine[]
): PitcherTrendLine | null {
  const aligned = pitcherDisplayTrendLines(trendLines).filter((l) =>
    tone === "hot" ? l.improved : !l.improved
  );
  if (aligned.length === 0) return null;
  return [...aligned].sort((a, b) => b.magnitude - a.magnitude)[0]!;
}

function pitcherTrendTone(lines: PitcherTrendLine[]): "hot" | "cold" | null {
  const display = pitcherDisplayTrendLines(lines);
  const improving = display.filter((l) => l.improved);
  const worsening = display.filter((l) => !l.improved);

  if (improving.length > 0 && worsening.length === 0) return "hot";
  if (worsening.length > 0 && improving.length === 0) return "cold";

  if (improving.length > worsening.length) return "hot";
  if (worsening.length > improving.length) return "cold";

  return null;
}

function pitcherQualifies(lines: PitcherTrendLine[]): boolean {
  return pitcherDisplayTrendLines(lines).length > 0;
}

function buildPitcherTrends(ctx: InsightsContext): { hot: PitcherTrendRow[]; cold: PitcherTrendRow[] } {
  const cfg = INSIGHTS_DASHBOARD_CONFIG;
  const hot: PitcherTrendRow[] = [];
  const cold: PitcherTrendRow[] = [];

  for (const pid of clubPitcherIds(ctx)) {
    const recentPas = lastNBfForPitcher(ctx, pid, cfg.pitcherRecentBf);
    if (recentPas.length < cfg.pitcherMinRecentBf) continue;

    const seasonPas = seasonBfForPitcher(ctx, pid);
    const recentLine = pitchingLineForPas(ctx, pid, recentPas);
    const seasonLine = pitchingLineForPas(ctx, pid, seasonPas);
    if (!recentLine || recentPas.length < cfg.pitcherMinRecentBf) continue;

    const recent = slashFromPitching(recentLine);
    const season = slashFromPitching(seasonLine ?? recentLine);
    const trendLines = buildPitcherTrendLines(recent, season);
    if (!pitcherQualifies(trendLines)) continue;

    const tone = pitcherTrendTone(trendLines);
    if (!tone) continue;

    const primary = primaryPitcherLineForTone(tone, trendLines);
    if (!primary) continue;

    const row: PitcherTrendRow = {
      playerId: pid,
      name: ctx.playersById.get(pid)?.name ?? "Unknown",
      sampleLabel: `Last ${recentPas.length} BF`,
      primaryLine: primary,
      trendLines,
      tone,
    };

    if (tone === "hot") hot.push(row);
    else cold.push(row);
  }

  const byMagnitude = (a: PitcherTrendRow, b: PitcherTrendRow) =>
    b.primaryLine.magnitude - a.primaryLine.magnitude;

  hot.sort(byMagnitude);
  cold.sort(byMagnitude);

  return {
    hot: hot.slice(0, cfg.pitcherTrendMax),
    cold: cold.slice(0, cfg.pitcherTrendMax),
  };
}

function pitchProfilesForPas(pas: PlateAppearance[], events: PitchEvent[]) {
  const byPa = groupPitchEventsByPaId(events);
  const agg = aggregatePitchTypeBucketCounts(pas, byPa);
  const profiles = pitchTypeProfilesFromCounts(agg.typedTotal, agg.buckets, {
    totalFirstPitch: agg.totalFirstPitch,
    totalAhead: agg.totalAhead,
    totalBehind: agg.totalBehind,
    totalEven: agg.totalEven,
    totalPaEnds: agg.totalPaEnds,
  });
  return { agg, profiles };
}

function buildPitchCallouts(
  seasonRows: PitchTypeRow[],
  last3Rows: PitchTypeRow[],
  lastLog: ReturnType<typeof pitchLogMetrics>
): PitchCallout[] {
  const callouts: PitchCallout[] = [];
  const seasonByType = new Map(seasonRows.map((r) => [r.pitchType, r]));

  for (const last of last3Rows) {
    const season = seasonByType.get(last.pitchType);
    if (!season || last.usagePct == null || season.usagePct == null || last.pitches < 8) continue;
    const shift = last.usagePct - season.usagePct;
    if (shift >= 0.12) {
      callouts.push({
        id: `usage.up.${last.pitchType}`,
        text: `${last.pitchLabel} usage up to ${pct(last.usagePct)} in last 3 games (season ${pct(season.usagePct)}).`,
      });
    } else if (shift <= -0.12) {
      callouts.push({
        id: `usage.down.${last.pitchType}`,
        text: `${last.pitchLabel} usage down to ${pct(last.usagePct)} in last 3 games (season ${pct(season.usagePct)}).`,
      });
    }
  }

  for (const last of last3Rows) {
    const season = seasonByType.get(last.pitchType);
    if (!season || last.whiffPct == null || season.whiffPct == null || last.pitches < 10) continue;
    const shift = last.whiffPct - season.whiffPct;
    if (shift >= 0.15) {
      callouts.push({
        id: `whiff.up.${last.pitchType}`,
        text: `${last.pitchLabel} whiff rate spiking at ${pct(last.whiffPct)} in last 3 games (season ${pct(season.whiffPct)}).`,
      });
    }
  }

  for (const last of last3Rows) {
    const season = seasonByType.get(last.pitchType);
    if (!season || last.avgAgainst == null || season.avgAgainst == null) continue;
    if (last.pitches < 12) continue;
    if (last.avgAgainst - season.avgAgainst >= 0.15) {
      callouts.push({
        id: `avg.up.${last.pitchType}`,
        text: `${last.pitchLabel} being hit at ${fmtRate(last.avgAgainst)} recently (season ${fmtRate(season.avgAgainst)}).`,
      });
    }
  }

  if (
    lastLog.firstPitchStrikePct != null &&
    lastLog.pitches >= 30 &&
    lastLog.firstPitchStrikePct < 0.58
  ) {
    callouts.push({
      id: "first_pitch.strike",
      text: `First-pitch strike rate is ${pct(lastLog.firstPitchStrikePct)} in last 3 games — prioritize early strikes.`,
    });
  }

  const bestWhiff = [...last3Rows]
    .filter((r) => r.whiffPct != null && r.pitches >= 8)
    .sort((a, b) => (b.whiffPct ?? 0) - (a.whiffPct ?? 0))[0];
  const mostUsed = [...seasonRows].sort((a, b) => (b.usagePct ?? 0) - (a.usagePct ?? 0))[0];
  if (
    bestWhiff &&
    mostUsed &&
    bestWhiff.pitchType !== mostUsed.pitchType &&
    (bestWhiff.whiffPct ?? 0) >= 0.35 &&
    (mostUsed.whiffPct ?? 0) < (bestWhiff.whiffPct ?? 0) - 0.12
  ) {
    callouts.push({
      id: "mix.whiff_gap",
      text: `${bestWhiff.pitchLabel} is your best miss pitch (${pct(bestWhiff.whiffPct!)} whiff) but ${mostUsed.pitchLabel} leads usage.`,
    });
  }

  return callouts.slice(0, 5);
}

function profileRowsFromAgg(
  agg: ReturnType<typeof aggregatePitchTypeBucketCounts>,
  profiles: ReturnType<typeof pitchTypeProfilesFromCounts>
): PitchTypeRow[] {
  const rows: PitchTypeRow[] = [];

  for (const [key, prof] of Object.entries(profiles)) {
    const bucket = normalizePitchTypeBucket(key);
    if (!bucket || !prof || (prof.pitches ?? 0) < 1) continue;

    rows.push({
      pitchType: bucket,
      pitchLabel: pitchTrackerTypeLabel(bucket as never),
      usagePct: prof.mix ?? null,
      avgAgainst: prof.baa ?? null,
      slgAgainst: prof.slg ?? null,
      whiffPct: prof.whiffPct ?? null,
      strikePct: prof.strikePct ?? null,
      chasePct: prof.swingPct ?? null,
      firstPitchMixPct: prof.firstPitchMix ?? null,
      twoStrikeWhiffPct: prof.twoStrikeWhiffPct ?? null,
      gbPct: prof.gbPct ?? null,
      pitches: prof.pitches ?? 0,
    });
  }

  rows.sort((a, b) => (b.usagePct ?? 0) - (a.usagePct ?? 0));
  return rows;
}

function buildPitchIntel(ctx: InsightsContext): PitchIntelligence {
  const games = ctx.gamesNewestFirst;
  const last3Games = games.slice(0, 3);
  const prevGames = baselineGames(games);
  const seasonPas = ourPitchingPas(ctx, games);
  const last3Pas = ourPitchingPas(ctx, last3Games);
  const empty: PitchIntelligence = {
    kpis: [],
    callouts: [],
    bestPitch: null,
    worstPitch: null,
    mostUsed: null,
    highestWhiff: null,
    bestPutaway: null,
    bestCommand: null,
    rows: [],
    sampleLabel: "Season sample",
  };

  if (seasonPas.length < 10 || ctx.pitchEvents.length < 30) return empty;

  const seasonPack = pitchProfilesForPas(seasonPas, ctx.pitchEvents);
  const last3Pack = pitchProfilesForPas(last3Pas, ctx.pitchEvents);
  const { agg, profiles } = seasonPack;
  const rows = profileRowsFromAgg(agg, profiles);
  const last3Rows = profileRowsFromAgg(last3Pack.agg, last3Pack.profiles);

  const last3Log = pitchLogMetrics(last3Pas, ctx.pitchEvents);
  const prevLog = pitchLogMetrics(ourPitchingPas(ctx, prevGames), ctx.pitchEvents);
  const kpis = buildPitchKpisOnly(last3Log, prevLog);
  const callouts = buildPitchCallouts(rows, last3Rows, last3Log);

  let bestWhiff: { key: string; whiff: number; n: number } | null = null;
  let bestAvg: { key: string; avg: number; ab: number } | null = null;
  let worstAvg: { key: string; avg: number; ab: number } | null = null;
  let mostUsed: { key: string; mix: number; n: number } | null = null;
  let bestPutaway: { key: string; whiff: number; swings: number } | null = null;
  let bestCommand: { key: string; strike: number; n: number } | null = null;

  for (const [key, prof] of Object.entries(profiles)) {
    const bucket = normalizePitchTypeBucket(key);
    if (!bucket || !prof || (prof.pitches ?? 0) < 1) continue;

    const n = prof.pitches ?? 0;
    const whiff = prof.whiffPct ?? null;
    const avg = prof.baa ?? null;
    const mix = prof.mix ?? null;
    const strike = prof.strikePct ?? null;
    const counts = agg.buckets[bucket as keyof typeof agg.buckets];
    const twoStrikeSwings = counts?.twoStrikeSwings ?? 0;
    const twoStrikeWhiff = prof.twoStrikeWhiffPct ?? null;

    if (n >= 8 && whiff != null && whiff > 0 && (!bestWhiff || whiff > bestWhiff.whiff)) {
      bestWhiff = { key: bucket, whiff, n };
    }
    const ab = prof.ab ?? 0;
    if (ab >= 6 && avg != null) {
      if (!bestAvg || avg < bestAvg.avg) bestAvg = { key: bucket, avg, ab };
      if (!worstAvg || avg > worstAvg.avg) worstAvg = { key: bucket, avg, ab };
    }
    if (mix != null && n >= 5 && (!mostUsed || mix > mostUsed.mix)) {
      mostUsed = { key: bucket, mix, n };
    }
    if (
      twoStrikeWhiff != null &&
      twoStrikeSwings >= 8 &&
      (!bestPutaway || twoStrikeWhiff > bestPutaway.whiff)
    ) {
      bestPutaway = { key: bucket, whiff: twoStrikeWhiff, swings: twoStrikeSwings };
    }
    if (strike != null && n >= 20 && (!bestCommand || strike > bestCommand.strike)) {
      bestCommand = { key: bucket, strike, n };
    }
  }

  const labelFor = (key: string) => pitchTrackerTypeLabel(key as never);

  const highestWhiff =
    bestWhiff != null
      ? {
          label: "Highest whiff",
          pitchType: bestWhiff.key,
          pitchLabel: labelFor(bestWhiff.key),
          value: pct(bestWhiff.whiff),
          subtext: "Whiff rate",
        }
      : null;

  return {
    kpis,
    callouts,
    bestPitch:
      bestAvg != null
        ? {
            label: "Best pitch",
            pitchType: bestAvg.key,
            pitchLabel: labelFor(bestAvg.key),
            value: fmtRate(bestAvg.avg),
            subtext: "AVG against",
          }
        : null,
    highestWhiff,
    worstPitch:
      worstAvg != null
        ? {
            label: "Concern",
            pitchType: worstAvg.key,
            pitchLabel: labelFor(worstAvg.key),
            value: fmtRate(worstAvg.avg),
            subtext: "AVG against",
          }
        : null,
    mostUsed:
      mostUsed != null
        ? {
            label: "Most used",
            pitchType: mostUsed.key,
            pitchLabel: labelFor(mostUsed.key),
            value: pct(mostUsed.mix),
            subtext: "Usage share",
          }
        : null,
    bestPutaway:
      bestPutaway != null
        ? {
            label: "Best putaway",
            pitchType: bestPutaway.key,
            pitchLabel: labelFor(bestPutaway.key),
            value: pct(bestPutaway.whiff),
            subtext: "2-strike whiff",
          }
        : null,
    bestCommand:
      bestCommand != null
        ? {
            label: "Best command",
            pitchType: bestCommand.key,
            pitchLabel: labelFor(bestCommand.key),
            value: pct(bestCommand.strike),
            subtext: "Strike rate",
          }
        : null,
    rows,
    sampleLabel: `${agg.typedTotal} typed pitches · ${seasonPas.length} PAs logged`,
  };
}

function runsPerGame(games: Game[]): number | null {
  if (games.length === 0) return null;
  let total = 0;
  let count = 0;
  for (const g of games) {
    const h = g.final_score_home;
    const a = g.final_score_away;
    if (h == null || a == null) continue;
    total += g.our_side === "home" ? h : a;
    count++;
  }
  return count > 0 ? total / count : null;
}

function buildKpis(
  last3Games: Game[],
  prevGames: Game[],
  last3: OffenseWindowMetrics | null,
  prev: OffenseWindowMetrics | null
): KpiCard[] {
  if (!last3 || !prev) return [];

  const lastRpg = runsPerGame(last3Games);
  const prevRpg = runsPerGame(prevGames);

  const cards: (KpiCard | null)[] = [
    buildKpiCard("AVG", last3.avg, prev.avg, fmtRate, true, 0.04),
    buildKpiCard("OBP", last3.obp, prev.obp, fmtRate, true, 0.04),
    buildKpiCard("SLG", last3.slg, prev.slg, fmtRate, true, 0.04),
    buildKpiCard("OPS", last3.ops, prev.ops, fmtRate, true, 0.08),
    buildKpiCard("K%", last3.kPct, prev.kPct, pct, false, 0.05),
    buildKpiCard("BB%", last3.bbPct, prev.bbPct, pct, false, 0.04),
    lastRpg != null && prevRpg != null
      ? buildKpiCard("Runs/G", lastRpg, prevRpg, (n) => n.toFixed(1), true, 0.5)
      : null,
    last3.rispAvg != null && prev.rispAvg != null
      ? buildKpiCard("RISP AVG", last3.rispAvg, prev.rispAvg, fmtRate, true, 0.04)
      : null,
  ];

  return cards.filter((c): c is KpiCard => c != null);
}

function buildPitchKpisOnly(
  last3Log: ReturnType<typeof pitchLogMetrics>,
  prevLog: ReturnType<typeof pitchLogMetrics>
): KpiCard[] {
  const minPitches = 40;
  if (last3Log.pitches < minPitches || prevLog.pitches < minPitches) return [];

  const cards: (KpiCard | null)[] = [
    last3Log.strikePct != null && prevLog.strikePct != null
      ? buildKpiCard("Strike%", last3Log.strikePct, prevLog.strikePct, pct, false, 0.04)
      : null,
    last3Log.whiffPct != null && prevLog.whiffPct != null
      ? buildKpiCard("Whiff%", last3Log.whiffPct, prevLog.whiffPct, pct, false, 0.05)
      : null,
    last3Log.firstPitchStrikePct != null && prevLog.firstPitchStrikePct != null
      ? buildKpiCard(
          "1st-pitch strike%",
          last3Log.firstPitchStrikePct,
          prevLog.firstPitchStrikePct,
          pct,
          false,
          0.04
        )
      : null,
  ];

  return cards.filter((c): c is KpiCard => c != null);
}

function isPlayerInsight(ins: Insight): boolean {
  return (
    Boolean(ins.entityIds?.playerId) ||
    ins.category === "hitter" ||
    ins.id.startsWith("player.")
  );
}

function statLabelForInsight(ins: Insight): string {
  const id = ins.id.toLowerCase();
  const title = ins.title;
  if (id.includes("risp")) return "RISP AVG";
  if (id.includes("k_rate") || title.includes("K%")) return "K%";
  if (id.includes("whiff") || id.includes("best_whiff")) return "Whiff %";
  if (id.includes("strike_pct")) return "Strike %";
  if (id.includes("worst_avg")) return "AVG vs";
  if (id.includes("ops") || title.includes("OPS")) return "OPS";
  if (id.includes("avg") || title.includes("AVG")) return "AVG";
  if (id.includes("bb") || title.includes("Walk")) return "BB%";
  const ev = ins.evidence[0]?.label?.trim();
  if (ev && !/prior|last \d/i.test(ev)) return ev;
  return "Stat";
}

function insightToConcern(ins: Insight): AlertCenterItem | null {
  const stat = ins.evidence[0]?.value ?? "—";
  const statLabel = statLabelForInsight(ins);
  const context =
    ins.evidence.length > 1
      ? ins.evidence
          .slice(1)
          .map((e) => `${e.label}: ${e.value}`)
          .join(" · ")
      : (ins.detail ?? ins.title);

  if (ins.kind === "alert" && !ins.id.includes("hot") && !isPlayerInsight(ins)) {
    return { id: ins.id, title: ins.title.replace(/^Team /, ""), statLabel, stat, context: ins.title };
  }
  if (ins.trend === "down" && (ins.category === "situational" || ins.id.includes("risp"))) {
    return { id: ins.id, title: "RISP production declining", statLabel: "RISP AVG", stat, context: ins.title };
  }
  if (ins.id.includes("strike_pct") && ins.trend === "down") {
    return { id: ins.id, title: "Strike percentage declining", statLabel: "Strike %", stat, context: ins.title };
  }
  if (ins.id.includes("worst_avg")) {
    return { id: ins.id, title: "Pitch type being hit hard", statLabel: "AVG vs", stat, context: ins.title };
  }
  if (ins.trend === "down" && ins.category === "team_offense") {
    const label = ins.title.includes("OPS")
      ? "Team OPS declining"
      : ins.title.includes("AVG")
        ? "Team AVG declining"
        : ins.title.includes("Walk")
          ? "Walk rate declining"
          : "Team offense declining";
    return { id: ins.id, title: label, statLabel, stat, context: ins.title };
  }
  if (ins.trend === "down" && ins.category === "team_pitching") {
    return { id: ins.id, title: "Pitching trend declining", statLabel, stat, context: ins.title };
  }
  return null;
}

function insightToStrength(ins: Insight): AlertCenterItem | null {
  const stat = ins.evidence[0]?.value ?? "—";
  const statLabel = statLabelForInsight(ins);
  const context = ins.detail ?? ins.title;

  if (ins.id.includes("best_whiff") || (ins.id.includes("whiff_trend") && ins.trend === "up")) {
    return { id: ins.id, title: "Pitch type generating whiffs", statLabel: "Whiff %", stat, context: ins.title };
  }
  if (ins.trend === "up" && (ins.category === "team_offense" || ins.category === "trend")) {
    const label = ins.title.includes("OPS")
      ? "Team OPS improving"
      : ins.title.includes("AVG")
        ? "Team AVG improving"
        : "Team offensive improvement";
    return { id: ins.id, title: label, statLabel, stat, context: ins.title };
  }
  if (ins.trend === "up" && ins.category === "team_pitching") {
    return { id: ins.id, title: "Positive pitching trend", statLabel, stat, context: ins.title };
  }
  return null;
}

function buildBriefing(
  kpis: KpiCard[],
  pitchIntel: PitchIntelligence,
  hotPlayers: PlayerTrendRow[],
  coldPlayers: PlayerTrendRow[],
  hotPitchers: PitcherTrendRow[],
  coldPitchers: PitcherTrendRow[],
  bundle: InsightsBundle,
  last3: OffenseWindowMetrics | null,
  prev: OffenseWindowMetrics | null
): BriefingItem[] {
  const items: Array<BriefingItem & { score: number }> = [];

  const opsKpi = kpis.find((k) => k.metric === "OPS");
  if (opsKpi && opsKpi.direction !== "stable" && opsKpi.positive === true) {
    items.push({
      id: "brief.ops",
      tone: "positive",
      headline: `Team OPS up ${opsKpi.diffLabel.replace("+", "")} over previous sample`,
      score: 90,
    });
  } else if (opsKpi && opsKpi.positive === false) {
    items.push({
      id: "brief.ops_down",
      tone: "warning",
      headline: `Team OPS down ${opsKpi.diffLabel.replace("-", "")} over previous sample`,
      score: 85,
    });
  }

  if (pitchIntel.worstPitch) {
    items.push({
      id: "brief.worst_pitch",
      tone: "critical",
      headline: `${pitchIntel.worstPitch.pitchLabel} allowing ${pitchIntel.worstPitch.value} AVG against`,
      score: 95,
    });
  }

  if (pitchIntel.highestWhiff) {
    items.push({
      id: "brief.best_whiff",
      tone: "positive",
      headline: `${pitchIntel.highestWhiff.pitchLabel} generating ${pitchIntel.highestWhiff.value} whiff rate`,
      score: 80,
    });
  }

  for (const p of hotPlayers.slice(0, 2)) {
    items.push({
      id: `brief.hot.${p.playerId}`,
      tone: "positive",
      headline: `${p.name} ${p.primaryLine.label} ${p.primaryLine.formatted} (${p.sampleLabel.toLowerCase()})`,
      score: 75,
    });
  }

  for (const p of hotPitchers.slice(0, 1)) {
    items.push({
      id: `brief.pitcher.hot.${p.playerId}`,
      tone: "positive",
      headline: `${p.name} ${p.primaryLine.label} ${p.primaryLine.formatted} (${p.sampleLabel.toLowerCase()})`,
      score: 72,
    });
  }

  for (const alert of bundle.alerts.slice(0, 2)) {
    const tone: BriefingTone = alert.id.includes("risp") || alert.id.includes("k_rate") ? "critical" : "warning";
    items.push({
      id: `brief.alert.${alert.id}`,
      tone,
      headline: alert.title.replace(/^Team /, "Team ").slice(0, 72),
      score: tone === "critical" ? 88 : 70,
    });
  }

  if (last3?.rispAvg != null && prev?.rispAvg != null && last3.rispAvg < prev.rispAvg - 0.04) {
    items.push({
      id: "brief.risp",
      tone: "warning",
      headline: `Team AVG with RISP down to ${fmtRate(last3.rispAvg)}`,
      score: 82,
    });
  }

  for (const p of coldPlayers.slice(0, 1)) {
    items.push({
      id: `brief.cold.${p.playerId}`,
      tone: "warning",
      headline: `${p.name} ${p.primaryLine.label} ${p.primaryLine.formatted} (${p.sampleLabel.toLowerCase()})`,
      score: 65,
    });
  }

  for (const p of coldPitchers.slice(0, 1)) {
    items.push({
      id: `brief.pitcher.cold.${p.playerId}`,
      tone: "warning",
      headline: `${p.name} ${p.primaryLine.label} ${p.primaryLine.formatted} (${p.sampleLabel.toLowerCase()})`,
      score: 63,
    });
  }

  const kpi = kpis.find((k) => k.metric === "K%");
  if (kpi && kpi.positive === false) {
    items.push({
      id: "brief.k",
      tone: "warning",
      headline: `Team K% at ${kpi.current} (${kpi.diffLabel} vs prior)`,
      score: 68,
    });
  }

  items.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: BriefingItem[] = [];
  for (const item of items) {
    if (seen.has(item.headline)) continue;
    seen.add(item.headline);
    out.push({ id: item.id, tone: item.tone, headline: item.headline });
    if (out.length >= INSIGHTS_DASHBOARD_CONFIG.briefingMax) break;
  }
  return out;
}

function buildAlertCenter(
  bundle: InsightsBundle,
  pitchIntel: PitchIntelligence,
  hotPlayers: PlayerTrendRow[],
  coldPlayers: PlayerTrendRow[],
  hotPitchers: PitcherTrendRow[],
  coldPitchers: PitcherTrendRow[],
  kpis: KpiCard[]
): AlertCenterSplit {
  const team: AlertCenterSection = { concerns: [], strengths: [] };
  const player: AlertCenterSection = { concerns: [], strengths: [] };
  const pitcher: AlertCenterSection = { concerns: [], strengths: [] };
  const seenTeam = new Set<string>();

  const pushTeam = (list: AlertCenterItem[], item: AlertCenterItem) => {
    if (seenTeam.has(item.id)) return;
    seenTeam.add(item.id);
    list.push(item);
  };

  for (const ins of [...bundle.alerts, ...bundle.insights]) {
    if (isPlayerInsight(ins)) continue;
    const c = insightToConcern(ins);
    if (c) pushTeam(team.concerns, c);
    const s = insightToStrength(ins);
    if (s) pushTeam(team.strengths, s);
  }

  if (pitchIntel.worstPitch) {
    pushTeam(team.concerns, {
      id: "concern.worst_pitch",
      title: `${pitchIntel.worstPitch.pitchLabel} being hit hard`,
      statLabel: "AVG vs",
      stat: pitchIntel.worstPitch.value,
      context: "AVG against in current sample",
    });
  }

  const rispKpi = kpis.find((k) => k.metric === "RISP AVG");
  if (rispKpi && rispKpi.positive === false) {
    pushTeam(team.concerns, {
      id: "concern.risp",
      title: "Team AVG with RISP declining",
      statLabel: "RISP AVG",
      stat: rispKpi.current,
      context: `Down ${rispKpi.diffLabel} vs prior sample (${rispKpi.previous})`,
    });
  }

  const strikeKpi = kpis.find((k) => k.metric === "Strike%");
  if (strikeKpi && strikeKpi.positive === false) {
    pushTeam(team.concerns, {
      id: "concern.strike",
      title: "Strike percentage declining",
      statLabel: "Strike %",
      stat: strikeKpi.current,
      context: `${strikeKpi.diffLabel} vs prior (${strikeKpi.previous})`,
    });
  }

  if (pitchIntel.highestWhiff) {
    pushTeam(team.strengths, {
      id: "strength.whiff",
      title: `${pitchIntel.highestWhiff.pitchLabel} generating high whiff rate`,
      statLabel: "Whiff %",
      stat: pitchIntel.highestWhiff.value,
      context: "Best swing-and-miss pitch in the sample",
    });
  }

  const opsKpi = kpis.find((k) => k.metric === "OPS");
  if (opsKpi && opsKpi.positive === true) {
    pushTeam(team.strengths, {
      id: "strength.ops",
      title: "Team offensive improvement",
      statLabel: "OPS",
      stat: opsKpi.current,
      context: `OPS ${opsKpi.diffLabel} vs prior sample (${opsKpi.previous})`,
    });
  }

  for (const p of coldPlayers) {
    player.concerns.push({
      id: `player.concern.${p.playerId}`,
      title: `${p.name} cooling off`,
      statLabel: p.primaryLine.label,
      stat: p.primaryLine.formatted,
      statImproved: p.primaryLine.improved,
      context: playerTrendContext(p),
      playerId: p.playerId,
    });
  }

  for (const p of hotPlayers) {
    player.strengths.push({
      id: `player.strength.${p.playerId}`,
      title: `${p.name} heating up`,
      statLabel: p.primaryLine.label,
      stat: p.primaryLine.formatted,
      statImproved: p.primaryLine.improved,
      context: playerTrendContext(p),
      playerId: p.playerId,
    });
  }

  for (const p of coldPitchers) {
    pitcher.concerns.push({
      id: `pitcher.concern.${p.playerId}`,
      title: `${p.name} struggling`,
      statLabel: p.primaryLine.label,
      stat: p.primaryLine.formatted,
      statImproved: p.primaryLine.improved,
      context: p.sampleLabel,
      playerId: p.playerId,
    });
  }

  for (const p of hotPitchers) {
    pitcher.strengths.push({
      id: `pitcher.strength.${p.playerId}`,
      title: `${p.name} on a roll`,
      statLabel: p.primaryLine.label,
      stat: p.primaryLine.formatted,
      statImproved: p.primaryLine.improved,
      context: p.sampleLabel,
      playerId: p.playerId,
    });
  }

  return {
    team: {
      concerns: team.concerns.slice(0, 8),
      strengths: team.strengths.slice(0, 8),
    },
    player: {
      concerns: player.concerns.slice(0, 8),
      strengths: player.strengths.slice(0, 8),
    },
    pitcher: {
      concerns: pitcher.concerns.slice(0, 8),
      strengths: pitcher.strengths.slice(0, 8),
    },
  };
}

function buildRecommendations(bundle: InsightsBundle): DashboardRecommendation[] {
  return bundle.recommendations.map((rec) => ({
    id: rec.id,
    action: rec.title,
    reason:
      rec.detail ??
      (rec.evidence.map((e) => `${e.label}: ${e.value}`).join(" · ") || "Based on current team trends."),
    priority: rec.priority,
  }));
}

function buildHitterOpsMap(ctx: InsightsContext, rows: PlayerTrendRow[]): Map<string, string> {
  const cfg = INSIGHTS_DASHBOARD_CONFIG;
  const map = new Map<string, string>();
  for (const row of rows) {
    const pas = lastNPasForBatter(ctx, row.playerId, cfg.playerRecentPa);
    const bat = battingStatsFromPAs(pas);
    map.set(row.playerId, bat ? fmtRate(bat.ops) : row.primaryLine.recent);
  }
  return map;
}

function buildPitcherStatsMap(
  ctx: InsightsContext,
  rows: PitcherTrendRow[]
): Map<string, { era: string; whip: string; strikePct: string | null }> {
  const cfg = INSIGHTS_DASHBOARD_CONFIG;
  const map = new Map<string, { era: string; whip: string; strikePct: string | null }>();
  for (const row of rows) {
    const pas = lastNBfForPitcher(ctx, row.playerId, cfg.pitcherRecentBf);
    const line = pitchingLineForPas(ctx, row.playerId, pas);
    map.set(row.playerId, {
      era: line ? fmtEra(line.era) : "—",
      whip: line ? line.whip.toFixed(2) : "—",
      strikePct: line?.rates.strikePct != null ? pct(line.rates.strikePct) : null,
    });
  }
  return map;
}

export function buildInsightsDashboard(ctx: InsightsContext, bundle: InsightsBundle): InsightsDashboard {
  const games = ctx.gamesNewestFirst;
  const last3 = metricsForWindow(games, ctx.allPas, "last_3");
  const prevGames = baselineGames(games);
  const prevMetrics = metricsForWindow(prevGames, ctx.allPas, "last_3");
  const prev =
    prevMetrics ??
    (() => {
      const pas = flatOurBattingPas([...prevGames].reverse(), ctx.allPas);
      const m = offenseMetricsFromPas(pas);
      return m ? { ...m, games: prevGames.length } : null;
    })();

  const last3Games = games.slice(0, 3);
  const last3Log = pitchLogMetrics(ourPitchingPas(ctx, last3Games), ctx.pitchEvents);
  const prevLog = pitchLogMetrics(ourPitchingPas(ctx, prevGames), ctx.pitchEvents);

  const { hot: hotPlayers, cold: coldPlayers } = buildPlayerTrends(ctx);
  const { hot: hotPitchers, cold: coldPitchers } = buildPitcherTrends(ctx);
  const pitchIntel = buildPitchIntel(ctx);
  const kpis = buildKpis(last3Games, prevGames, last3, prev);
  const recommendations = buildRecommendations(bundle);
  const pitchKpis = buildPitchKpisOnly(last3Log, prevLog);

  const allHitters = [...hotPlayers, ...coldPlayers];
  const allPitchers = [...hotPitchers, ...coldPitchers];
  const hitterOps = buildHitterOpsMap(ctx, allHitters);
  const pitcherStats = buildPitcherStatsMap(ctx, allPitchers);

  const executive = buildExecutiveSummary(kpis, recommendations, last3Games, prevGames);
  const actionCenter = buildActionCenter(
    recommendations,
    pitchIntel,
    coldPlayers,
    hotPlayers,
    kpis
  );
  const playerTrends = buildPlayerTrendsSection(
    hotPlayers,
    coldPlayers,
    hotPitchers,
    coldPitchers,
    hitterOps,
    pitcherStats
  );
  const pitchCenter = buildPitchCenter(pitchIntel);
  const teamStory = buildTeamStory(
    kpis,
    pitchIntel,
    hotPlayers,
    coldPlayers,
    hotPitchers,
    coldPitchers,
    last3Games,
    prevGames
  );
  const alertsFeed = buildAlertsFeed(
    kpis,
    pitchIntel,
    hotPlayers,
    coldPlayers,
    hotPitchers,
    coldPitchers,
    executive
  );

  const ourPa = flatOurBattingPas([...games].reverse(), ctx.allPas);

  return {
    executive,
    actionCenter,
    kpis,
    playerTrends,
    pitchCenter,
    teamStory,
    alertsFeed,
    drillDown: {
      kpis,
      pitchRows: pitchIntel.rows,
      pitchKpis,
      hotHitters: hotPlayers,
      coldHitters: coldPlayers,
      hotPitchers,
      coldPitchers,
    },
    meta: { gameCount: games.length, paCount: ourPa.length },
  };
}

export function runInsightsDashboard(ctx: InsightsContext): InsightsDashboard {
  const bundle = runInsightsEngine(ctx, "team");
  return normalizeInsightsDashboard(buildInsightsDashboard(ctx, bundle));
}

export const EMPTY_ALERT_SECTION: AlertCenterSection = { concerns: [], strengths: [] };

export const EMPTY_PITCH_INTEL: PitchIntelligence = {
  kpis: [],
  callouts: [],
  bestPitch: null,
  worstPitch: null,
  mostUsed: null,
  highestWhiff: null,
  bestPutaway: null,
  bestCommand: null,
  rows: [],
  sampleLabel: "",
};

function normalizeAlertItem(item: AlertCenterItem): AlertCenterItem {
  if (item.statLabel) return item;
  const opsMatch = item.stat.match(/^OPS\s+(.+)$/i);
  if (opsMatch) return { ...item, statLabel: "OPS", stat: opsMatch[1]! };
  return { ...item, statLabel: "Stat" };
}

function normalizeAlertSection(section?: AlertCenterSection | null): AlertCenterSection {
  const safe = section ?? EMPTY_ALERT_SECTION;
  return {
    concerns: (safe.concerns ?? []).map(normalizeAlertItem),
    strengths: (safe.strengths ?? []).map(normalizeAlertItem),
  };
}

export const EMPTY_DRILL_DOWN: DrillDownData = {
  kpis: [],
  pitchRows: [],
  pitchKpis: [],
  hotHitters: [],
  coldHitters: [],
  hotPitchers: [],
  coldPitchers: [],
};

/** Ensures a complete dashboard shape (handles legacy payloads). */
export function normalizeInsightsDashboard(
  raw: Partial<InsightsDashboard> & Record<string, unknown>
): InsightsDashboard {
  if (raw.executive) {
    return {
      executive: { ...EMPTY_EXECUTIVE, ...raw.executive },
      actionCenter: {
        offensive: raw.actionCenter?.offensive ?? [],
        pitching: raw.actionCenter?.pitching ?? [],
        defensive: raw.actionCenter?.defensive ?? [],
      },
      kpis: raw.kpis ?? [],
      playerTrends: { ...EMPTY_PLAYER_TRENDS, ...raw.playerTrends },
      pitchCenter: { ...EMPTY_PITCH_CENTER, ...raw.pitchCenter },
      teamStory: raw.teamStory ?? [],
      alertsFeed: raw.alertsFeed ?? [],
      drillDown: { ...EMPTY_DRILL_DOWN, ...raw.drillDown },
      meta: raw.meta ?? { gameCount: 0, paCount: 0 },
    };
  }

  return {
    executive: EMPTY_EXECUTIVE,
    actionCenter: EMPTY_ACTION_CENTER,
    kpis: raw.kpis ?? [],
    playerTrends: EMPTY_PLAYER_TRENDS,
    pitchCenter: EMPTY_PITCH_CENTER,
    teamStory: [],
    alertsFeed: [],
    drillDown: EMPTY_DRILL_DOWN,
    meta: raw.meta ?? { gameCount: 0, paCount: 0 },
  };
}
