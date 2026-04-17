/**
 * Pitching stat column defs, cell formatting, and compare highlighting for head-to-head views
 * (e.g. compare players). Mirrors logic in {@link PitchingStatsSheet} without pulling in the table UI.
 */

import { formatPPa } from "@/lib/format";
import { REGULATION_INNINGS } from "@/lib/leagueConfig";
import { PITCHING_STAT_HEADER_TOOLTIPS } from "@/lib/statHeaderTooltips";
import type { PitchingStats, PitchingStatsWithSplits } from "@/lib/types";

const RI = REGULATION_INNINGS;

export type PitchCompareSortKey =
  | "g"
  | "gs"
  | "ip"
  | "h"
  | "baa"
  | "r"
  | "ir"
  | "irs"
  | "er"
  | "hr"
  | "so"
  | "bb"
  | "hbp"
  | "era"
  | "fip"
  | "whip"
  | "k7"
  | "bb7"
  | "h7"
  | "hr7"
  | "kPct"
  | "bbPct"
  | "strikePct"
  | "fpsPct"
  | "pPa"
  | "e";

type ColFormat = "int" | "era" | "ip" | "rate7" | "pct" | "pPa" | "avgAgainst";

export type PitchCompareColumnDef = {
  key: PitchCompareSortKey;
  label: string;
  format: ColFormat;
  tooltip: string;
};

/** Standard pitching sheet columns (no Player column) — same order as {@link PitchingStatsSheet} `COLUMNS`. */
export const PITCHING_COMPARE_STANDARD_COLUMNS: PitchCompareColumnDef[] = [
  { key: "g", label: "G", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.g },
  { key: "gs", label: "GS", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.gs },
  { key: "ip", label: "IP", format: "ip", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.ip },
  { key: "h", label: "H", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.h },
  { key: "baa", label: "BAA", format: "avgAgainst", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.baa },
  { key: "r", label: "R", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.r },
  { key: "ir", label: "IR", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.ir },
  { key: "irs", label: "IRS", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.irs },
  { key: "er", label: "ER", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.er },
  { key: "hr", label: "HR", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.hr },
  { key: "so", label: "SO", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.so },
  { key: "bb", label: "BB", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.bb },
  { key: "hbp", label: "HBP", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.hbp },
  { key: "era", label: `ERA (${RI})`, format: "era", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.era },
  { key: "fip", label: `FIP (${RI})`, format: "era", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.fip },
  { key: "whip", label: "WHIP", format: "era", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.whip },
  { key: "k7", label: `K/${RI}`, format: "rate7", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.k7 },
  { key: "bb7", label: `BB/${RI}`, format: "rate7", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.bb7 },
  { key: "h7", label: `H/${RI}`, format: "rate7", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.h7 },
  { key: "hr7", label: `HR/${RI}`, format: "rate7", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.hr7 },
  { key: "kPct", label: "K%", format: "pct", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.kPctPitch },
  { key: "bbPct", label: "BB%", format: "pct", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.bbPctPitch },
  { key: "strikePct", label: "Strike%", format: "pct", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.strikePctPitch },
  { key: "fpsPct", label: "FPS%", format: "pct", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.fpsPctPitch },
  { key: "pPa", label: "P/PA", format: "pPa", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.pPaPitch },
  { key: "e", label: "E", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.e },
];

const LOWER_IS_BETTER = new Set<PitchCompareSortKey>([
  "era",
  "fip",
  "whip",
  "h",
  "r",
  "irs",
  "er",
  "hr",
  "bb",
  "hbp",
  "baa",
  "bb7",
  "h7",
  "hr7",
  "bbPct",
  "pPa",
  "e",
]);

const HIGHER_IS_BETTER = new Set<PitchCompareSortKey>(["so", "k7", "kPct"]);

/** Playing time / ambiguous — no winner highlight. */
const PITCHING_COMPARE_NEUTRAL_KEYS = new Set<PitchCompareSortKey>(["g", "gs", "ip", "ir"]);

function formatEraLike(value: number): string {
  if (value === 0) return "0.00";
  return value.toFixed(2);
}

function formatOppBattingAvg(stats: PitchingStats): string {
  if (stats.abAgainst < 1) return "—";
  const v = stats.h / stats.abAgainst;
  const s = v.toFixed(3);
  return s.startsWith("0.") ? s.slice(1) : s;
}

export function pitchingCompareStatBorderLeft(key: PitchCompareSortKey): boolean {
  return key === "h" || key === "so" || key === "era" || key === "k7" || key === "strikePct" || key === "e";
}

export function getPitchingCompareNumericValue(
  stats: PitchingStats | undefined,
  key: PitchCompareSortKey
): number | null {
  if (!stats) return null;
  switch (key) {
    case "g":
      return stats.g;
    case "gs":
      return stats.gs;
    case "ip":
      return stats.ip;
    case "h":
      return stats.h;
    case "baa":
      return stats.abAgainst >= 1 ? stats.h / stats.abAgainst : null;
    case "r":
      return stats.r;
    case "ir":
      return stats.ir ?? null;
    case "irs":
      return stats.irs ?? null;
    case "era":
      return stats.ip > 0 ? stats.era : null;
    case "er":
      return stats.er;
    case "hr":
      return stats.hr;
    case "so":
      return stats.so;
    case "bb":
      return stats.bb;
    case "hbp":
      return stats.hbp;
    case "e":
      return stats.e ?? 0;
    case "fip":
      return stats.ip > 0 ? stats.fip : null;
    case "whip":
      return stats.ip > 0 ? stats.whip : null;
    case "k7":
      return stats.ip > 0 ? stats.rates.k7 : null;
    case "bb7":
      return stats.ip > 0 ? stats.rates.bb7 : null;
    case "h7":
      return stats.ip > 0 ? stats.rates.h7 : null;
    case "hr7":
      return stats.ip > 0 ? stats.rates.hr7 : null;
    case "kPct":
      return stats.rates.kPct;
    case "bbPct":
      return stats.rates.bbPct;
    case "strikePct":
      return stats.rates.strikePct ?? null;
    case "fpsPct":
      return stats.rates.fpsPct ?? null;
    case "pPa":
      return stats.rates.pPa ?? null;
    default:
      return null;
  }
}

export function formatPitchingCompareCell(col: PitchCompareColumnDef, stats: PitchingStats | undefined): string {
  if (!stats) return "—";
  if (col.key === "ip") return stats.ipDisplay;
  if (col.format === "era") {
    const v = getPitchingCompareNumericValue(stats, col.key);
    if (v === null) return "—";
    return formatEraLike(v);
  }
  if (col.format === "rate7") {
    const v = getPitchingCompareNumericValue(stats, col.key);
    if (v === null) return "—";
    return formatEraLike(v);
  }
  if (col.format === "pct") {
    const v = getPitchingCompareNumericValue(stats, col.key);
    if (v === null) return "—";
    return `${(v * 100).toFixed(1)}%`;
  }
  if (col.format === "pPa") {
    const p = stats.rates.pPa;
    if (p == null || Number.isNaN(p)) return "—";
    return formatPPa(p);
  }
  if (col.format === "avgAgainst") {
    return formatOppBattingAvg(stats);
  }
  const n = getPitchingCompareNumericValue(stats, col.key);
  if (n === null) return "—";
  return String(Math.round(n));
}

/**
 * Green highlight: better for the pitcher. Ties unstyled; volume cols (G, GS, IP, IR) neutral.
 * Keys not in lower/higher sets default to higher = better (e.g. Strike%, FPS%).
 */
export function pitchingSheetCompareHighlight(
  col: PitchCompareColumnDef,
  lineA: PitchingStats | undefined,
  lineB: PitchingStats | undefined,
  side: "a" | "b"
): boolean {
  if (PITCHING_COMPARE_NEUTRAL_KEYS.has(col.key)) return false;

  const na = getPitchingCompareNumericValue(lineA, col.key);
  const nb = getPitchingCompareNumericValue(lineB, col.key);
  if (na === null || nb === null) return false;
  if (Math.abs(na - nb) <= 1e-9) return false;

  const lower = LOWER_IS_BETTER.has(col.key);
  const higher = HIGHER_IS_BETTER.has(col.key);
  const preferLower = lower && !higher;
  const preferHigher = higher || !lower;

  if (side === "a") {
    return preferLower ? na < nb : preferHigher ? na > nb : na > nb;
  }
  return preferLower ? nb < na : preferHigher ? nb > na : nb > na;
}

/** Same values as compare page URL `scope` (batting: vs pitcher hand; pitching: vs batter hand). */
export type CompareStatScope = "overall" | "vsL" | "vsR" | "risp";

/** Map compare scope to a pitching line (platoon = vs LHB / vs RHB; RISP = combined bucket). */
export function comparePitchingLineFromSplits(
  splits: PitchingStatsWithSplits | null,
  scope: CompareStatScope
): PitchingStats | undefined {
  if (!splits) return undefined;
  if (scope === "overall") return splits.overall;
  if (scope === "vsL") return splits.vsLHB ?? undefined;
  if (scope === "vsR") return splits.vsRHB ?? undefined;
  return splits.runnerSituations?.risp?.combined ?? undefined;
}
