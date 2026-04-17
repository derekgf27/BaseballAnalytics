/**
 * Roster totals row for analyst batting stat sheets: sum counting stats and
 * recompute slash / wOBA / K% like {@link lineupAggregateFromBattingStats}.
 */

import { lineupAggregateFromBattingStats } from "@/lib/compute/battingStats";
import type { BattingStats, BattingStatsWithSplits, Player } from "@/lib/types";

function sumField(lines: BattingStats[], key: keyof BattingStats): number {
  return lines.reduce((s, b) => {
    const v = b[key];
    return s + (typeof v === "number" && !Number.isNaN(v) ? v : 0);
  }, 0);
}

function weightedAvgByPa(lines: BattingStats[], key: keyof BattingStats): number | undefined {
  let num = 0;
  let den = 0;
  for (const b of lines) {
    const pa = b.pa ?? 0;
    const v = b[key];
    if (pa > 0 && typeof v === "number" && !Number.isNaN(v)) {
      num += v * pa;
      den += pa;
    }
  }
  return den > 0 ? num / den : undefined;
}

const CONTACT_RATE_KEYS: (keyof BattingStats)[] = [
  "swingPct",
  "whiffPct",
  "foulPct",
  "gbPct",
  "ldPct",
  "fbPct",
  "iffPct",
];

/**
 * Team line for visible roster rows. CS uses each player’s `overall` line (same as the stat sheet);
 * SB / SB% use split-aware lines in `lineById`.
 */
export function aggregateBattingTeamLine(
  players: Player[],
  lineById: Record<string, BattingStats | undefined>,
  splitsById: Record<string, BattingStatsWithSplits | undefined>
): BattingStats | null {
  const lines = players.map((p) => lineById[p.id]).filter((s): s is BattingStats => s != null);
  if (lines.length === 0) return null;

  const agg = lineupAggregateFromBattingStats(lines);
  if (!agg) return null;

  const pa = sumField(lines, "pa");
  const walks = sumField(lines, "bb") + sumField(lines, "ibb");
  const bbPct = pa > 0 ? walks / pa : 0;

  const csTotal = players.reduce((s, p) => s + (splitsById[p.id]?.overall?.cs ?? 0), 0);
  const sbTotal = sumField(lines, "sb");
  const sbPct = sbTotal + csTotal > 0 ? sbTotal / (sbTotal + csTotal) : undefined;

  const pitchSum = lines.reduce((s, b) => s + (b.pitchesSeenTotal ?? 0), 0);
  const pPa =
    pa > 0 && pitchSum > 0 ? pitchSum / pa : agg.pPa;

  const team: BattingStats = {
    ...agg,
    bbPct,
    pPa,
    // gp / gs intentionally omitted: Σ player games ≠ team games (same game counted per player).
    pa,
    ab: sumField(lines, "ab"),
    h: sumField(lines, "h"),
    double: sumField(lines, "double"),
    triple: sumField(lines, "triple"),
    hr: sumField(lines, "hr"),
    rbi: sumField(lines, "rbi"),
    r: sumField(lines, "r"),
    sb: sbTotal,
    bb: sumField(lines, "bb"),
    ibb: sumField(lines, "ibb"),
    hbp: sumField(lines, "hbp"),
    so: sumField(lines, "so"),
    gidp: sumField(lines, "gidp"),
    fieldersChoice: sumField(lines, "fieldersChoice"),
    sf: sumField(lines, "sf"),
    sh: sumField(lines, "sh"),
    cs: csTotal,
    sbPct,
    e: sumField(lines, "e"),
    pitchesSeenTotal: pitchSum > 0 ? pitchSum : undefined,
    kPct: agg.kPct,
  };

  for (const k of CONTACT_RATE_KEYS) {
    const w = weightedAvgByPa(lines, k);
    if (w !== undefined) (team as BattingStats)[k] = w;
  }

  return team;
}
