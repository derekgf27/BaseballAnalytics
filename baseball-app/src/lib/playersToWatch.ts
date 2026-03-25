/**
 * "Players to watch" — season vs last-10-PA rate changes (AVG, OBP, SLG, OPS).
 */

import { isDemoId } from "@/lib/db/mockData";
import type { Player } from "@/lib/types";

/** Input shape for selection (matches dashboard data layer). */
export type PlayerStatsForWatch = {
  id: string;
  name: string;
  position: string;
  pa: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  /** Strikeout rate as percentage 0–100 */
  kRate: number;
  bbRate: number;
  last10PA?: {
    avg: number;
    obp: number;
    slg: number;
    ops: number;
    hits: number;
    ab: number;
    hr: number;
    double: number;
    triple: number;
    rbi: number;
    r: number;
    sb: number;
    strikeouts: number;
    paCount: number;
    /** Last-10 K% / BB% (0–100), aligned with season kRate/bbRate */
    kRate: number;
    bbRate: number;
  };
};

export type PlayersToWatchCategory = "hot" | "cold";

export type PlayersToWatchStatKey = "OPS" | "AVG" | "OBP" | "SLG";

/** One slash-line trend (season → last 10 PA) shown when |Δ| exceeds the threshold. */
export type PlayersToWatchTrendLine = {
  label: PlayersToWatchStatKey;
  formatted: string;
};

export type PlayersToWatchRow = {
  id: string;
  name: string;
  position: string;
  category: PlayersToWatchCategory;
  /** Largest single-stat move (points as decimal, e.g. 0.15 = 150 “points”) */
  primaryValue: number;
  /** Only stats with |season − last10| > threshold; order OPS → AVG → OBP → SLG */
  trendLines: PlayersToWatchTrendLine[];
  /** e.g. `3-4, 1HR, 2 2B, 4 RBI, 1 SB, 2 R` */
  last10PaSummary: string;
  /** True when row is illustrative (no real flags) — show preview banner in UI */
  isPreview?: boolean;
};

/** Minimum absolute change in AVG, OBP, SLG, or OPS to qualify (“100 points” = 0.100). */
export const PLAYERS_TO_WATCH_MIN_POINT_CHANGE = 0.1;

const MAX_TOTAL = 5;

/** Batting-style rate for display: `.822` from 0.822 */
export function formatAvgOpsDisplay(n: number): string {
  const t = n.toFixed(3);
  return t.startsWith("0.") ? t.slice(1) : t;
}

export function formatTrendAvgOps(before: number, after: number): string {
  return `${formatAvgOpsDisplay(before)} -> ${formatAvgOpsDisplay(after)}`;
}

/** Box-style last-10 line: `3-4, 1HR, 2 2B, 4 RBI, 1 SB, 2 R` (only non-zero extras after H-AB). */
export function formatLast10PaSummary(u: {
  hits: number;
  ab: number;
  hr: number;
  double: number;
  triple: number;
  rbi: number;
  r: number;
  sb: number;
}): string {
  const segs: string[] = [`${u.hits}-${u.ab}`];
  if (u.hr > 0) segs.push(`${u.hr}HR`);
  if (u.double > 0) segs.push(`${u.double} 2B`);
  if (u.triple > 0) segs.push(`${u.triple} 3B`);
  if (u.rbi > 0) segs.push(`${u.rbi} RBI`);
  if (u.sb > 0) segs.push(`${u.sb} SB`);
  if (u.r > 0) segs.push(`${u.r} R`);
  return segs.join(", ");
}

function isEligible(p: PlayerStatsForWatch): boolean {
  if (p.pa < 1) return false;
  if (p.pa >= 5) return true;
  return p.last10PA != null && p.last10PA.paCount >= 1;
}

/** Absolute deltas (rate units) for each slash line vs season. */
function pointDeltas(p: PlayerStatsForWatch): { avg: number; obp: number; slg: number; ops: number } | null {
  const l = p.last10PA;
  if (!l || l.paCount < 1) return null;
  return {
    avg: Math.abs(l.avg - p.avg),
    obp: Math.abs(l.obp - p.obp),
    slg: Math.abs(l.slg - p.slg),
    ops: Math.abs(l.ops - p.ops),
  };
}

/** Largest move across AVG, OBP, SLG, OPS (same units as rates). */
export function maxPointDelta(p: PlayerStatsForWatch): number {
  const d = pointDeltas(p);
  if (!d) return 0;
  return Math.max(d.avg, d.obp, d.slg, d.ops);
}

function qualifiesByPointChange(p: PlayerStatsForWatch): boolean {
  return maxPointDelta(p) > PLAYERS_TO_WATCH_MIN_POINT_CHANGE;
}

/** Slash lines whose absolute season vs last-10 change exceeds the threshold (stable OPS→AVG→OBP→SLG order). */
export function qualifyingTrendLines(p: PlayerStatsForWatch): PlayersToWatchTrendLine[] {
  const l = p.last10PA;
  if (!l || l.paCount < 1) return [];
  const d = pointDeltas(p);
  if (!d) return [];
  const out: PlayersToWatchTrendLine[] = [];
  const thr = PLAYERS_TO_WATCH_MIN_POINT_CHANGE;
  const pushIf = (label: PlayersToWatchStatKey, before: number, after: number, absDelta: number) => {
    if (absDelta > thr) {
      out.push({ label, formatted: formatTrendAvgOps(before, after) });
    }
  };
  pushIf("OPS", p.ops, l.ops, d.ops);
  pushIf("AVG", p.avg, l.avg, d.avg);
  pushIf("OBP", p.obp, l.obp, d.obp);
  pushIf("SLG", p.slg, l.slg, d.slg);
  return out;
}

/**
 * Players with any of AVG / OBP / SLG / OPS moving more than 100 points vs season,
 * ranked by the largest such move. Icon: hot if last-10 OPS ≥ season OPS, else cold.
 */
export function selectPlayersToWatch(players: PlayerStatsForWatch[]): PlayersToWatchRow[] {
  const eligible = players.filter(isEligible);
  const movers = eligible
    .filter((p) => qualifiesByPointChange(p))
    .sort((a, b) => maxPointDelta(b) - maxPointDelta(a))
    .slice(0, MAX_TOTAL);

  return movers.map((p) => {
    const l = p.last10PA!;
    const category: PlayersToWatchCategory = l.ops >= p.ops ? "hot" : "cold";
    return {
      id: p.id,
      name: p.name,
      position: p.position,
      category,
      primaryValue: maxPointDelta(p),
      trendLines: qualifyingTrendLines(p),
      last10PaSummary: formatLast10PaSummary({
        hits: l.hits,
        ab: l.ab,
        hr: l.hr,
        double: l.double,
        triple: l.triple,
        rbi: l.rbi,
        r: l.r,
        sb: l.sb,
      }),
    };
  });
}

/** When no one qualifies, show up to 5 real roster names with sample stats (UI preview only). */
export function buildRosterPreviewWatchRows(players: Player[]): PlayersToWatchRow[] {
  const list = players.filter((p) => !isDemoId(p.id)).slice(0, 5);
  const templates: Pick<
    PlayersToWatchRow,
    "category" | "primaryValue" | "trendLines" | "last10PaSummary"
  >[] = [
    {
      category: "hot",
      primaryValue: 0.2,
      trendLines: [{ label: "OPS", formatted: ".650 -> .850" }],
      last10PaSummary: "4-8, 1HR, 2 2B, 4 RBI, 1 SB, 2 R",
    },
    {
      category: "cold",
      primaryValue: 0.19,
      trendLines: [{ label: "AVG", formatted: ".290 -> .100" }],
      last10PaSummary: "2-10, 3 RBI, 1 R",
    },
    {
      category: "hot",
      primaryValue: 0.15,
      trendLines: [
        { label: "OPS", formatted: ".701 -> .851" },
        { label: "OBP", formatted: ".330 -> .470" },
      ],
      last10PaSummary: "5-9, 2HR, 1 2B, 5 RBI, 2 R",
    },
    {
      category: "cold",
      primaryValue: 0.16,
      trendLines: [{ label: "SLG", formatted: ".400 -> .240" }],
      last10PaSummary: "1-8, 1 2B, 1 RBI",
    },
    {
      category: "hot",
      primaryValue: 0.13,
      trendLines: [
        { label: "AVG", formatted: ".210 -> .340" },
        { label: "SLG", formatted: ".350 -> .500" },
      ],
      last10PaSummary: "3-10, 1HR, 1 3B, 2 RBI, 1 SB, 1 R",
    },
  ];
  return list.map((p, i) => ({
    id: p.id,
    name: p.name,
    position: p.positions?.[0] ?? "—",
    ...templates[i]!,
    isPreview: true,
  }));
}

/** Map BattingStats kPct (0–1) to percentage 0–100 */
export function kPctToKRate(kPct: number | undefined): number {
  if (kPct == null || Number.isNaN(kPct)) return 0;
  return kPct * 100;
}
