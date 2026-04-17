/**
 * Single source of truth for Analyst batting stat sheet column order, labels, and display formatting.
 * Used by {@link BattingStatsSheet} and player profile batting tables.
 */

import { formatPPa } from "@/lib/format";
import { BATTING_STAT_HEADER_TOOLTIPS } from "@/lib/statHeaderTooltips";
import type { BattingFinalCountBucketKey, BattingStats } from "@/lib/types";

export type BattingSheetSortKey =
  | "name"
  | "gp"
  | "gs"
  | "pa"
  | "ab"
  | "h"
  | "double"
  | "triple"
  | "hr"
  | "rbi"
  | "r"
  | "sb"
  | "cs"
  | "sbPct"
  | "bb"
  | "ibb"
  | "hbp"
  | "so"
  | "gidp"
  | "fieldersChoice"
  | "kPct"
  | "bbPct"
  | "avg"
  | "obp"
  | "slg"
  | "ops"
  | "opsPlus"
  | "woba"
  | "pPa"
  | "swingPct"
  | "whiffPct"
  | "foulPct"
  | "gbPct"
  | "ldPct"
  | "fbPct"
  | "iffPct"
  | "e";

export type BattingSheetColumnDef = {
  key: BattingSheetSortKey;
  label: string;
  align: "left" | "right" | "center";
  format: "name" | "int" | "avg" | "pct";
  tooltip: string;
};

/** Full column set including Player (row 0) — matches BattingStatsSheet `COLUMNS`. */
export const BATTING_SHEET_COLUMNS: BattingSheetColumnDef[] = [
  { key: "name", label: "Player", align: "left", format: "name", tooltip: BATTING_STAT_HEADER_TOOLTIPS.player },
  { key: "gp", label: "G", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.gp },
  { key: "gs", label: "GS", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.gs },
  { key: "pa", label: "PA", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.pa },
  { key: "ab", label: "AB", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.ab },
  { key: "h", label: "H", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.h },
  { key: "double", label: "2B", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.double },
  { key: "triple", label: "3B", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.triple },
  { key: "hr", label: "HR", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.hr },
  { key: "rbi", label: "RBI", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.rbi },
  { key: "r", label: "R", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.r },
  { key: "pPa", label: "P/PA", align: "right", format: "avg", tooltip: BATTING_STAT_HEADER_TOOLTIPS.pPa },
  { key: "kPct", label: "K%", align: "right", format: "pct", tooltip: BATTING_STAT_HEADER_TOOLTIPS.kPct },
  { key: "bbPct", label: "BB%", align: "right", format: "pct", tooltip: BATTING_STAT_HEADER_TOOLTIPS.bbPct },
  { key: "bb", label: "BB", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.bb },
  { key: "ibb", label: "IBB", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.ibb },
  { key: "hbp", label: "HBP", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.hbp },
  { key: "so", label: "SO", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.so },
  { key: "gidp", label: "GIDP", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.gidp },
  { key: "fieldersChoice", label: "FC", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.fieldersChoice },
  { key: "avg", label: "AVG", align: "right", format: "avg", tooltip: BATTING_STAT_HEADER_TOOLTIPS.avg },
  { key: "obp", label: "OBP", align: "right", format: "avg", tooltip: BATTING_STAT_HEADER_TOOLTIPS.obp },
  { key: "slg", label: "SLG", align: "right", format: "avg", tooltip: BATTING_STAT_HEADER_TOOLTIPS.slg },
  { key: "ops", label: "OPS", align: "right", format: "avg", tooltip: BATTING_STAT_HEADER_TOOLTIPS.ops },
  { key: "opsPlus", label: "OPS+", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.opsPlus },
  { key: "woba", label: "wOBA", align: "right", format: "avg", tooltip: BATTING_STAT_HEADER_TOOLTIPS.woba },
  { key: "sb", label: "SB", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.sb },
  { key: "cs", label: "CS", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.cs },
  { key: "sbPct", label: "SB%", align: "right", format: "pct", tooltip: BATTING_STAT_HEADER_TOOLTIPS.sbPct },
  { key: "e", label: "E", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.e },
];

export const BATTING_SHEET_STAT_GROUP_BORDER_LEFT: Partial<Record<BattingSheetSortKey, true>> = {
  pPa: true,
  avg: true,
  sb: true,
  e: true,
};

export type BattingSheetColumnMode = "standard" | "contact";

/** Dropdown options: one saved final count (balls–strikes) bucket for the full Standard stat line. */
export const FINAL_COUNT_BUCKET_OPTIONS: { value: BattingFinalCountBucketKey; label: string }[] = [
  { value: "0-0", label: "0-0" },
  { value: "0-1", label: "0-1" },
  { value: "0-2", label: "0-2" },
  { value: "1-0", label: "1-0" },
  { value: "1-1", label: "1-1" },
  { value: "1-2", label: "1-2" },
  { value: "2-0", label: "2-0" },
  { value: "2-1", label: "2-1" },
  { value: "2-2", label: "2-2" },
  { value: "3-0", label: "3-0" },
  { value: "3-1", label: "3-1" },
  { value: "3-2", label: "3-2" },
];

export const BATTING_SHEET_CONTACT_COLUMNS: BattingSheetColumnDef[] = [
  BATTING_SHEET_COLUMNS[0]!,
  BATTING_SHEET_COLUMNS[1]!,
  BATTING_SHEET_COLUMNS[2]!,
  BATTING_SHEET_COLUMNS[3]!,
  BATTING_SHEET_COLUMNS.find((c) => c.key === "pPa")!,
  BATTING_SHEET_COLUMNS.find((c) => c.key === "kPct")!,
  {
    key: "swingPct",
    label: "Sw%",
    align: "right",
    format: "pct",
    tooltip: BATTING_STAT_HEADER_TOOLTIPS.swingPct,
  },
  {
    key: "whiffPct",
    label: "Whiff%",
    align: "right",
    format: "pct",
    tooltip: BATTING_STAT_HEADER_TOOLTIPS.whiffPct,
  },
  {
    key: "foulPct",
    label: "Foul%",
    align: "right",
    format: "pct",
    tooltip: BATTING_STAT_HEADER_TOOLTIPS.foulPct,
  },
  {
    key: "gbPct",
    label: "GB%",
    align: "right",
    format: "pct",
    tooltip: BATTING_STAT_HEADER_TOOLTIPS.gbPct,
  },
  {
    key: "ldPct",
    label: "LD%",
    align: "right",
    format: "pct",
    tooltip: BATTING_STAT_HEADER_TOOLTIPS.ldPct,
  },
  {
    key: "fbPct",
    label: "FB%",
    align: "right",
    format: "pct",
    tooltip: BATTING_STAT_HEADER_TOOLTIPS.fbPct,
  },
  {
    key: "iffPct",
    label: "IFF%",
    align: "right",
    format: "pct",
    tooltip: BATTING_STAT_HEADER_TOOLTIPS.iffPct,
  },
  BATTING_SHEET_COLUMNS.find((c) => c.key === "e")!,
];

export function battingSheetColumnsForMode(mode: BattingSheetColumnMode): BattingSheetColumnDef[] {
  return mode === "contact" ? BATTING_SHEET_CONTACT_COLUMNS : BATTING_SHEET_COLUMNS;
}

/** Data columns only (excludes Player) for profile / compact tables. */
export function battingSheetDataColumns(mode: BattingSheetColumnMode): BattingSheetColumnDef[] {
  return battingSheetColumnsForMode(mode).slice(1);
}

export function battingSheetContactStatBorderLeft(key: BattingSheetSortKey): boolean {
  return key === "pPa" || key === "swingPct" || key === "gbPct" || key === "e";
}

export function battingSheetStandardStatBorderLeft(key: BattingSheetSortKey): boolean {
  return BATTING_SHEET_STAT_GROUP_BORDER_LEFT[key] === true;
}

export function formatBattingSheetNumber(value: number | undefined, format: "int" | "avg" | "pct"): string {
  if (value === undefined) return "—";
  if (format === "int") return String(value);
  if (format === "pct") return `${(value * 100).toFixed(1)}%`;
  const s = value.toFixed(3);
  return s.startsWith("0.") ? s.slice(1) : s;
}

/**
 * Display string for one cell. CS and SB% follow the stat sheet: values come from `baserunningSource`
 * when provided (overall line), else from `line`.
 */
export function formatBattingSheetDataCell(
  col: BattingSheetColumnDef,
  line: BattingStats | undefined,
  baserunningSource: BattingStats | undefined
): string {
  if (!line) return "—";
  const srcBr = baserunningSource ?? line;

  if (col.key === "cs") {
    const v = srcBr.cs;
    return typeof v === "number" ? String(v) : "—";
  }
  if (col.key === "sbPct") {
    const v = srcBr.sbPct;
    return typeof v === "number" ? formatBattingSheetNumber(v, "pct") : "—";
  }
  if (col.key === "pPa") {
    return line.pPa != null ? formatPPa(line.pPa) : "—";
  }

  const v = line[col.key as keyof BattingStats];
  if (col.format === "pct") {
    return typeof v === "number" ? formatBattingSheetNumber(v, "pct") : "—";
  }
  if (col.format === "avg") {
    return typeof v === "number" ? formatBattingSheetNumber(v, "avg") : "—";
  }
  if (col.format === "int") {
    return typeof v === "number" ? formatBattingSheetNumber(v, "int") : "—";
  }
  return "—";
}

/** Raw numeric value for a cell (same sourcing rules as {@link formatBattingSheetDataCell}). */
export function battingSheetCellNumericValue(
  col: BattingSheetColumnDef,
  line: BattingStats | undefined,
  baserunningSource: BattingStats | undefined
): number | null {
  if (!line) return null;
  const srcBr = baserunningSource ?? line;

  if (col.key === "cs") {
    const v = srcBr.cs;
    return typeof v === "number" ? v : null;
  }
  if (col.key === "sbPct") {
    const v = srcBr.sbPct;
    return typeof v === "number" ? v : null;
  }
  if (col.key === "pPa") {
    return line.pPa != null ? line.pPa : null;
  }

  const v = line[col.key as keyof BattingStats];
  return typeof v === "number" ? v : null;
}

/** No winner highlighting — playing time / ambiguous. */
const BATTING_COMPARE_NEUTRAL_KEYS: Partial<Record<BattingSheetSortKey, true>> = {
  name: true,
  gp: true,
  gs: true,
  pa: true,
  ab: true,
  fieldersChoice: true,
};

/** Lower numeric value is better for the batter. */
const BATTING_COMPARE_LOWER_IS_BETTER: Partial<Record<BattingSheetSortKey, true>> = {
  kPct: true,
  so: true,
  gidp: true,
  cs: true,
  e: true,
};

/**
 * Whether this cell should use success/green styling when comparing two players.
 * Only the strictly better side is highlighted; ties stay default (white). Missing values on either side yield no highlight.
 */
export function battingSheetCompareHighlight(
  col: BattingSheetColumnDef,
  lineA: BattingStats | undefined,
  lineB: BattingStats | undefined,
  overallA: BattingStats | undefined,
  overallB: BattingStats | undefined,
  side: "a" | "b"
): boolean {
  if (BATTING_COMPARE_NEUTRAL_KEYS[col.key]) return false;

  const na = battingSheetCellNumericValue(col, lineA, overallA);
  const nb = battingSheetCellNumericValue(col, lineB, overallB);
  if (na === null || nb === null) return false;

  if (na === nb) return false;

  const lower = BATTING_COMPARE_LOWER_IS_BETTER[col.key] === true;
  if (side === "a") {
    return lower ? na < nb : na > nb;
  }
  return lower ? nb < na : nb > na;
}
