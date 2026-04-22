"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { analystPlayerProfileHref } from "@/lib/analystRoutes";
import { comparePlayersByLastNameThenFull } from "@/lib/playerSort";
import { formatPPa } from "@/lib/format";
import { REGULATION_INNINGS } from "@/lib/leagueConfig";
import { PITCHING_STAT_HEADER_TOOLTIPS } from "@/lib/statHeaderTooltips";
import type {
  BattingFinalCountBucketKey,
  PitchingRateLine,
  PitchingStats,
  PitchingStatsWithSplits,
  Player,
  StatsRunnersFilterKey,
} from "@/lib/types";
import { FINAL_COUNT_BUCKET_OPTIONS } from "@/components/analyst/battingStatsSheetModel";
import { aggregatePitchingTeamLine } from "@/lib/compute/pitchingStats";

const THROWS_LABEL: Record<string, string> = { L: "L", R: "R" };

/** Same idea as batting `SplitView` — which batter-handedness sample to show. */
export type PitchingSplitView = "overall" | "vsLHB" | "vsRHB";

type PitchSortKey =
  | "name"
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
  | "bf"
  | "swingPct"
  | "whiffPct"
  | "foulPct"
  | "gbPct"
  | "ldPct"
  | "fbPct"
  | "iffPct"
  | "e"
  | "plTyped"
  | "plMixFB"
  | "plMixSI"
  | "plMixFC"
  | "plMixSL"
  | "plMixSW"
  | "plMixCB"
  | "plMixCH"
  | "plMixSP"
  | "plMixOT"
  | "plSwFB"
  | "plSwSI"
  | "plSwFC"
  | "plSwSL"
  | "plSwSW"
  | "plSwCB"
  | "plSwCH"
  | "plSwSP"
  | "plSwOT"
  | "plWhiffFB"
  | "plWhiffSI"
  | "plWhiffFC"
  | "plWhiffSL"
  | "plWhiffSW"
  | "plWhiffCB"
  | "plWhiffCH"
  | "plWhiffSP"
  | "plWhiffOT"
  | "plBaaFB"
  | "plBaaSI"
  | "plBaaFC"
  | "plBaaSL"
  | "plBaaSW"
  | "plBaaCB"
  | "plBaaCH"
  | "plBaaSP"
  | "plBaaOT";

type ColFormat =
  | "name"
  | "int"
  | "era"
  | "ip"
  | "rate7"
  | "pct"
  | "pPa"
  | "avgAgainst"
  | "avgPitchType";

const RI = REGULATION_INNINGS;

const COLUMNS: {
  key: PitchSortKey;
  label: string;
  align: "left" | "right";
  format: ColFormat;
  tooltip: string;
  borderLeft?: boolean;
}[] = [
  { key: "name", label: "Player", align: "left", format: "name", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.player },
  { key: "g", label: "G", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.g },
  { key: "gs", label: "GS", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.gs },
  { key: "ip", label: "IP", align: "right", format: "ip", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.ip },
  { key: "h", label: "H", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.h, borderLeft: true },
  { key: "baa", label: "BAA", align: "right", format: "avgAgainst", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.baa },
  { key: "r", label: "R", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.r },
  { key: "ir", label: "IR", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.ir },
  { key: "irs", label: "IRS", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.irs },
  { key: "er", label: "ER", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.er },
  { key: "hr", label: "HR", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.hr },
  { key: "so", label: "SO", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.so, borderLeft: true },
  { key: "bb", label: "BB", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.bb },
  { key: "hbp", label: "HBP", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.hbp },
  { key: "era", label: `ERA (${RI})`, align: "right", format: "era", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.era, borderLeft: true },
  { key: "fip", label: `FIP (${RI})`, align: "right", format: "era", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.fip },
  { key: "whip", label: "WHIP", align: "right", format: "era", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.whip },
  { key: "k7", label: `K/${RI}`, align: "right", format: "rate7", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.k7, borderLeft: true },
  { key: "bb7", label: `BB/${RI}`, align: "right", format: "rate7", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.bb7 },
  { key: "h7", label: `H/${RI}`, align: "right", format: "rate7", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.h7 },
  { key: "hr7", label: `HR/${RI}`, align: "right", format: "rate7", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.hr7 },
  { key: "kPct", label: "K%", align: "right", format: "pct", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.kPctPitch },
  { key: "bbPct", label: "BB%", align: "right", format: "pct", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.bbPctPitch },
  { key: "strikePct", label: "Strike%", align: "right", format: "pct", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.strikePctPitch, borderLeft: true },
  { key: "fpsPct", label: "FPS%", align: "right", format: "pct", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.fpsPctPitch },
  { key: "pPa", label: "P/PA", align: "right", format: "pPa", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.pPaPitch },
  { key: "e", label: "E", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.e, borderLeft: true },
];

const CONTACT_PITCH_COLUMNS: (typeof COLUMNS)[number][] = [
  COLUMNS[0]!,
  COLUMNS[1]!,
  COLUMNS[2]!,
  COLUMNS[3]!,
  {
    key: "bf",
    label: "PA",
    align: "right",
    format: "int",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.paPitchContact,
  },
  COLUMNS.find((c) => c.key === "pPa")!,
  COLUMNS.find((c) => c.key === "fpsPct")!,
  COLUMNS.find((c) => c.key === "strikePct")!,
  {
    key: "swingPct",
    label: "Sw%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.swingPctPitchContact,
  },
  {
    key: "whiffPct",
    label: "Whiff%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.whiffPctPitchContact,
  },
  {
    key: "foulPct",
    label: "Foul%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.foulPctPitchContact,
  },
  {
    key: "gbPct",
    label: "GB%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.gbPctPitchContact,
  },
  {
    key: "ldPct",
    label: "LD%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.ldPctPitchContact,
  },
  {
    key: "fbPct",
    label: "FB%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.fbPctPitchContact,
  },
  {
    key: "iffPct",
    label: "IFF%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.iffPctPitchContact,
  },
  COLUMNS.find((c) => c.key === "e")!,
];

const PITCH_TYPE_PITCH_COLUMNS: (typeof COLUMNS)[number][] = [
  COLUMNS[0]!,
  COLUMNS[1]!,
  COLUMNS[2]!,
  COLUMNS[3]!,
  {
    key: "bf",
    label: "PA",
    align: "right",
    format: "int",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.paPitchContact,
  },
  {
    key: "plTyped",
    label: "Typed",
    align: "right",
    format: "int",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plTypedPitch,
  },
  {
    key: "plMixFB",
    label: "FB%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plMixFBPitch,
  },
  {
    key: "plMixSI",
    label: "SI%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plMixSIPitch,
  },
  {
    key: "plMixFC",
    label: "FC%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plMixFCPitch,
  },
  {
    key: "plMixSL",
    label: "SL%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plMixSLPitch,
  },
  {
    key: "plMixSW",
    label: "SW%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plMixSWPitch,
  },
  {
    key: "plMixCB",
    label: "CB%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plMixCBPitch,
  },
  {
    key: "plMixCH",
    label: "CH%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plMixCHPitch,
  },
  {
    key: "plMixSP",
    label: "SP%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plMixSPPitch,
  },
  {
    key: "plMixOT",
    label: "OT%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plMixOTPitch,
  },
  {
    key: "plSwFB",
    label: "FB Sw%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plSwFBPitch,
  },
  {
    key: "plSwSI",
    label: "SI Sw%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plSwSIPitch,
  },
  {
    key: "plSwFC",
    label: "FC Sw%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plSwFCPitch,
  },
  {
    key: "plSwSL",
    label: "SL Sw%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plSwSLPitch,
  },
  {
    key: "plSwSW",
    label: "SW Sw%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plSwSWPitch,
  },
  {
    key: "plSwCB",
    label: "CB Sw%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plSwCBPitch,
  },
  {
    key: "plSwCH",
    label: "CH Sw%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plSwCHPitch,
  },
  {
    key: "plSwSP",
    label: "SP Sw%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plSwSPPitch,
  },
  {
    key: "plSwOT",
    label: "OT Sw%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plSwOTPitch,
  },
  {
    key: "plWhiffFB",
    label: "FB Whiff%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plWhiffFBPitch,
  },
  {
    key: "plWhiffSI",
    label: "SI Whiff%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plWhiffSIPitch,
  },
  {
    key: "plWhiffFC",
    label: "FC Whiff%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plWhiffFCPitch,
  },
  {
    key: "plWhiffSL",
    label: "SL Whiff%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plWhiffSLPitch,
  },
  {
    key: "plWhiffSW",
    label: "SW Whiff%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plWhiffSWPitch,
  },
  {
    key: "plWhiffCB",
    label: "CB Whiff%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plWhiffCBPitch,
  },
  {
    key: "plWhiffCH",
    label: "CH Whiff%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plWhiffCHPitch,
  },
  {
    key: "plWhiffSP",
    label: "SP Whiff%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plWhiffSPPitch,
  },
  {
    key: "plWhiffOT",
    label: "OT Whiff%",
    align: "right",
    format: "pct",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plWhiffOTPitch,
  },
  {
    key: "plBaaFB",
    label: "FB AVG",
    align: "right",
    format: "avgPitchType",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plBaaFBPitch,
  },
  {
    key: "plBaaSI",
    label: "SI AVG",
    align: "right",
    format: "avgPitchType",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plBaaSIPitch,
  },
  {
    key: "plBaaFC",
    label: "FC AVG",
    align: "right",
    format: "avgPitchType",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plBaaFCPitch,
  },
  {
    key: "plBaaSL",
    label: "SL AVG",
    align: "right",
    format: "avgPitchType",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plBaaSLPitch,
  },
  {
    key: "plBaaSW",
    label: "SW AVG",
    align: "right",
    format: "avgPitchType",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plBaaSWPitch,
  },
  {
    key: "plBaaCB",
    label: "CB AVG",
    align: "right",
    format: "avgPitchType",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plBaaCBPitch,
  },
  {
    key: "plBaaCH",
    label: "CH AVG",
    align: "right",
    format: "avgPitchType",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plBaaCHPitch,
  },
  {
    key: "plBaaSP",
    label: "SP AVG",
    align: "right",
    format: "avgPitchType",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plBaaSPPitch,
  },
  {
    key: "plBaaOT",
    label: "OT AVG",
    align: "right",
    format: "avgPitchType",
    tooltip: PITCHING_STAT_HEADER_TOOLTIPS.plBaaOTPitch,
  },
  COLUMNS.find((c) => c.key === "e")!,
];

/** No bold “leader” styling — usage / swing context is ambiguous in a max/min sense. */
const PITCH_SHEET_PITCH_TYPE_NEUTRAL = new Set<PitchSortKey>([
  "ir",
  "plTyped",
  "plMixFB",
  "plMixSI",
  "plMixFC",
  "plMixSL",
  "plMixSW",
  "plMixCB",
  "plMixCH",
  "plMixSP",
  "plMixOT",
  "plSwFB",
  "plSwSI",
  "plSwFC",
  "plSwSL",
  "plSwSW",
  "plSwCB",
  "plSwCH",
  "plSwSP",
  "plSwOT",
]);

const LOWER_BETTER = new Set<PitchSortKey>([
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
  "plBaaFB",
  "plBaaSI",
  "plBaaFC",
  "plBaaSL",
  "plBaaSW",
  "plBaaCB",
  "plBaaCH",
  "plBaaSP",
  "plBaaOT",
]);

const HIGHER_BETTER = new Set<PitchSortKey>([
  "so",
  "k7",
  "kPct",
  "whiffPct",
  "plWhiffFB",
  "plWhiffSI",
  "plWhiffFC",
  "plWhiffSL",
  "plWhiffSW",
  "plWhiffCB",
  "plWhiffCH",
  "plWhiffSP",
  "plWhiffOT",
]);

type PitchColumnMode = "standard" | "contact" | "pitchTypes";

function contactPitchBorderLeft(key: PitchSortKey): boolean {
  return key === "pPa" || key === "swingPct" || key === "gbPct";
}

function pitchTypePitchBorderLeft(key: PitchSortKey): boolean {
  return (
    key === "bf" ||
    key === "plTyped" ||
    key === "plMixFB" ||
    key === "plSwFB" ||
    key === "plWhiffFB" ||
    key === "plBaaFB" ||
    key === "e"
  );
}

function pitchSheetHeaderBorderLeft(
  columnMode: PitchColumnMode,
  key: PitchSortKey,
  borderLeft: boolean | undefined,
  idx: number
): boolean {
  if (columnMode === "contact") return contactPitchBorderLeft(key) || borderLeft === true || idx === 0;
  if (columnMode === "pitchTypes") return pitchTypePitchBorderLeft(key) || idx === 0;
  return borderLeft === true || idx === 0;
}

const OVERALL_PER7: PitchSortKey[] = ["k7", "bb7", "h7", "hr7"];

const STICKY_LEAD = {
  rank: "sticky left-0 z-[100] isolate [transform:translateZ(0)] w-12 min-w-[3rem] shrink-0",
  player:
    "sticky left-12 z-[100] isolate [transform:translateZ(0)] w-[12rem] min-w-[12rem] max-w-[12rem] shrink-0",
  throws:
    "sticky left-[15rem] z-[100] isolate [transform:translateZ(0)] w-10 min-w-[2.5rem] max-w-[2.5rem] shrink-0 shadow-[2px_0_0_0_var(--border)]",
} as const;

const SCROLL_CELL_Z = "relative !z-0";

/** Full-width rule above team totals (`border-separate` tables don’t paint `<tr>` borders reliably). */
const TEAM_FOOTER_TOP_RULE =
  "border-t-[3px] border-[color-mix(in_srgb,var(--accent)_85%,var(--border)_15%)]";

/** Stat-group dividers on the team row (plain `--border` reads too dim next to accent totals). */
const TEAM_FOOTER_GROUP_LEFT =
  "border-l-2 border-[color-mix(in_srgb,var(--accent)_58%,var(--border)_42%)]";

function stickyLeadRowBg(selected: boolean, index: number): string {
  const isEven = index % 2 === 0;
  const hoverMix = isEven
    ? "group-hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--bg-base))]"
    : "group-hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--bg-elevated))]";
  if (selected) {
    const selMix = isEven
      ? "bg-[color-mix(in_srgb,var(--accent)_18%,var(--bg-base))]"
      : "bg-[color-mix(in_srgb,var(--accent)_18%,var(--bg-elevated))]";
    return `${selMix} ${hoverMix}`;
  }
  const baseSolid = isEven ? "bg-[var(--bg-base)]" : "bg-[var(--bg-elevated)]";
  return `${baseSolid} ${hoverMix}`;
}

function formatEraLike(value: number): string {
  if (value === 0) return "0.00";
  return value.toFixed(2);
}

/** Opponent AVG — three decimals, batting-style (drop leading 0). */
function formatOppBattingAvg(stats: PitchingStats): string {
  if (stats.abAgainst < 1) return "—";
  const v = stats.h / stats.abAgainst;
  const s = v.toFixed(3);
  return s.startsWith("0.") ? s.slice(1) : s;
}

function pitchTypeBaaFromRates(
  rates: PitchingRateLine,
  abKey: keyof PitchingRateLine,
  hKey: keyof PitchingRateLine
): number | undefined {
  const ab = rates[abKey];
  const h = rates[hKey];
  const abN = typeof ab === "number" && !Number.isNaN(ab) ? ab : 0;
  const hN = typeof h === "number" && !Number.isNaN(h) ? h : 0;
  return abN >= 1 ? hN / abN : undefined;
}

function formatPitchTypeBaa(rate: number | undefined): string {
  if (rate === undefined) return "—";
  const s = rate.toFixed(3);
  return s.startsWith("0.") ? s.slice(1) : s;
}

/** AB denominator for per–pitch-type AVG (for leader styling). */
const PITCH_BAA_AB_KEY: Partial<Record<PitchSortKey, keyof PitchingRateLine>> = {
  plBaaFB: "plTxAbFB",
  plBaaSI: "plTxAbSI",
  plBaaFC: "plTxAbFC",
  plBaaSL: "plTxAbSL",
  plBaaSW: "plTxAbSW",
  plBaaCB: "plTxAbCB",
  plBaaCH: "plTxAbCH",
  plBaaSP: "plTxAbSP",
  plBaaOT: "plTxAbOT",
};

function getPitchingLineForSheet(
  splits: Record<string, PitchingStatsWithSplits>,
  playerId: string,
  platoon: PitchingSplitView,
  runners: StatsRunnersFilterKey
): PitchingStats | undefined {
  const s = splits[playerId];
  if (!s) return undefined;
  if (runners === "all") {
    if (platoon === "overall") return s.overall;
    if (platoon === "vsLHB") return s.vsLHB ?? undefined;
    return s.vsRHB ?? undefined;
  }
  const triple = s.runnerSituations?.[runners];
  if (!triple) return undefined;
  if (platoon === "overall") return triple.combined ?? undefined;
  if (platoon === "vsLHB") return triple.vsLHB ?? undefined;
  return triple.vsRHB ?? undefined;
}

function getPitchingFinalCountMapForSplit(
  splits: Record<string, PitchingStatsWithSplits>,
  playerId: string,
  split: PitchingSplitView,
  runners: StatsRunnersFilterKey
): Partial<Record<BattingFinalCountBucketKey, PitchingStats | null>> | undefined {
  if (runners !== "all") return undefined;
  const sfc = splits[playerId]?.statsByFinalCount;
  if (!sfc) return undefined;
  if (split === "overall") return sfc.overall;
  if (split === "vsLHB") return sfc.vsLHB;
  return sfc.vsRHB;
}

function getPitchingStatValue(stats: PitchingStats | undefined, key: PitchSortKey): number | undefined {
  if (!stats || key === "name") return undefined;
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
      return stats.abAgainst >= 1 ? stats.h / stats.abAgainst : undefined;
    case "r":
      return stats.r;
    case "ir":
      return stats.ir;
    case "irs":
      return stats.irs;
    case "era":
      return stats.era;
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
      return stats.fip;
    case "whip":
      return stats.whip;
    case "k7":
      return stats.rates.k7;
    case "bb7":
      return stats.rates.bb7;
    case "h7":
      return stats.rates.h7;
    case "hr7":
      return stats.rates.hr7;
    case "kPct":
      return stats.rates.kPct;
    case "bbPct":
      return stats.rates.bbPct;
    case "strikePct":
      return stats.rates.strikePct ?? undefined;
    case "fpsPct":
      return stats.rates.fpsPct ?? undefined;
    case "pPa":
      return stats.rates.pPa ?? undefined;
    case "bf":
      return stats.rates.pa;
    case "swingPct":
      return stats.rates.swingPct ?? undefined;
    case "whiffPct":
      return stats.rates.whiffPct ?? undefined;
    case "foulPct":
      return stats.rates.foulPct ?? undefined;
    case "gbPct":
      return stats.rates.gbPct ?? undefined;
    case "ldPct":
      return stats.rates.ldPct ?? undefined;
    case "fbPct":
      return stats.rates.fbPct ?? undefined;
    case "iffPct":
      return stats.rates.iffPct ?? undefined;
    case "plTyped":
      return stats.rates.plTyped ?? undefined;
    case "plMixFB":
      return stats.rates.plMixFB ?? undefined;
    case "plMixSI":
      return stats.rates.plMixSI ?? undefined;
    case "plMixFC":
      return stats.rates.plMixFC ?? undefined;
    case "plMixSL":
      return stats.rates.plMixSL ?? undefined;
    case "plMixSW":
      return stats.rates.plMixSW ?? undefined;
    case "plMixCB":
      return stats.rates.plMixCB ?? undefined;
    case "plMixCH":
      return stats.rates.plMixCH ?? undefined;
    case "plMixSP":
      return stats.rates.plMixSP ?? undefined;
    case "plMixOT":
      return stats.rates.plMixOT ?? undefined;
    case "plSwFB":
      return stats.rates.plSwFB ?? undefined;
    case "plSwSI":
      return stats.rates.plSwSI ?? undefined;
    case "plSwFC":
      return stats.rates.plSwFC ?? undefined;
    case "plSwSL":
      return stats.rates.plSwSL ?? undefined;
    case "plSwSW":
      return stats.rates.plSwSW ?? undefined;
    case "plSwCB":
      return stats.rates.plSwCB ?? undefined;
    case "plSwCH":
      return stats.rates.plSwCH ?? undefined;
    case "plSwSP":
      return stats.rates.plSwSP ?? undefined;
    case "plSwOT":
      return stats.rates.plSwOT ?? undefined;
    case "plWhiffFB":
      return stats.rates.plWhiffFB ?? undefined;
    case "plWhiffSI":
      return stats.rates.plWhiffSI ?? undefined;
    case "plWhiffFC":
      return stats.rates.plWhiffFC ?? undefined;
    case "plWhiffSL":
      return stats.rates.plWhiffSL ?? undefined;
    case "plWhiffSW":
      return stats.rates.plWhiffSW ?? undefined;
    case "plWhiffCB":
      return stats.rates.plWhiffCB ?? undefined;
    case "plWhiffCH":
      return stats.rates.plWhiffCH ?? undefined;
    case "plWhiffSP":
      return stats.rates.plWhiffSP ?? undefined;
    case "plWhiffOT":
      return stats.rates.plWhiffOT ?? undefined;
    case "plBaaFB":
      return pitchTypeBaaFromRates(stats.rates, "plTxAbFB", "plTxHFB");
    case "plBaaSI":
      return pitchTypeBaaFromRates(stats.rates, "plTxAbSI", "plTxHSI");
    case "plBaaFC":
      return pitchTypeBaaFromRates(stats.rates, "plTxAbFC", "plTxHFC");
    case "plBaaSL":
      return pitchTypeBaaFromRates(stats.rates, "plTxAbSL", "plTxHSL");
    case "plBaaSW":
      return pitchTypeBaaFromRates(stats.rates, "plTxAbSW", "plTxHSW");
    case "plBaaCB":
      return pitchTypeBaaFromRates(stats.rates, "plTxAbCB", "plTxHCB");
    case "plBaaCH":
      return pitchTypeBaaFromRates(stats.rates, "plTxAbCH", "plTxHCH");
    case "plBaaSP":
      return pitchTypeBaaFromRates(stats.rates, "plTxAbSP", "plTxHSP");
    case "plBaaOT":
      return pitchTypeBaaFromRates(stats.rates, "plTxAbOT", "plTxHOT");
    default:
      return undefined;
  }
}

function getSortValue(stats: PitchingStats | undefined, key: PitchSortKey): number {
  if (key === "name") return 0;
  if (!stats) return key === "ip" ? -1 : 0;
  if (key === "ip") return stats.ip;
  const n = getPitchingStatValue(stats, key);
  return n ?? -1;
}

function displayCell(stats: PitchingStats | undefined, key: PitchSortKey, format: ColFormat): string {
  if (!stats) return "—";
  if (key === "name") return "";
  if (key === "ip") return stats.ipDisplay;
  if (format === "era") {
    const v = getPitchingStatValue(stats, key);
    if (v === undefined) return "—";
    if ((key === "era" || key === "fip" || key === "whip") && stats.ip <= 0) return "—";
    return formatEraLike(v);
  }
  if (format === "rate7") {
    const v = getPitchingStatValue(stats, key);
    if (v === undefined) return "—";
    if (OVERALL_PER7.includes(key) && stats.ip <= 0) return "—";
    return formatEraLike(v);
  }
  if (format === "pct") {
    const v = getPitchingStatValue(stats, key);
    if (v === undefined) return "—";
    return `${(v * 100).toFixed(1)}%`;
  }
  if (format === "pPa") {
    const p = stats.rates.pPa;
    if (p == null || Number.isNaN(p)) return "—";
    return formatPPa(p);
  }
  if (format === "avgAgainst") {
    return formatOppBattingAvg(stats);
  }
  if (format === "avgPitchType") {
    return formatPitchTypeBaa(getPitchingStatValue(stats, key));
  }
  const n = getPitchingStatValue(stats, key);
  if (n === undefined) return "—";
  return String(n);
}

function LeaderStat({ children, show }: { children: ReactNode; show: boolean }) {
  return show ? <span className="font-bold italic">{children}</span> : <>{children}</>;
}

function isLeaderMatch(key: PitchSortKey, val: number | undefined, best: number | undefined): boolean {
  if (val === undefined || best === undefined) return false;
  if (Number.isNaN(val) || Number.isNaN(best)) return false;
  return Math.abs(val - best) <= 1e-6;
}

/** Opponent + batter (opposition hitter) filters — mirrors batting sheet Opponent / Pitcher. */
export interface PitchingMatchupToolbarConfig {
  opponents: { key: string; label: string }[];
  battersByOpponent: Record<string, { id: string; name: string }[]>;
  opponentKey: string;
  batterId: string;
  onOpponentChange: (opponentKey: string) => void;
  onBatterChange: (batterId: string) => void;
  /** When set, the Opponent dropdown is hidden and this flat list is used (e.g. your batters vs this opponent). */
  battersFlat?: { id: string; name: string }[];
}

export interface PitchingStatsSheetProps {
  players?: Player[];
  pitchingStatsWithSplits?: Record<string, PitchingStatsWithSplits>;
  heading?: string;
  subheading?: string;
  toolbarEnd?: ReactNode;
  /** Shown beside the search field on the same row (e.g. reset URL filters). */
  sampleToolbarEnd?: ReactNode;
  matchupToolbar?: PitchingMatchupToolbarConfig;
  /** When true (e.g. specific batter selected), platoon split resets to Overall and is disabled. */
  splitDisabled?: boolean;
  finalCountBucket?: BattingFinalCountBucketKey | null;
  onFinalCountBucketChange?: (v: BattingFinalCountBucketKey | null) => void;
  runnersFilter?: StatsRunnersFilterKey;
  onRunnersFilterChange?: (v: StatsRunnersFilterKey) => void;
  toolbarVariant?: "default" | "grouped";
}

export function PitchingStatsSheet({
  players = [],
  pitchingStatsWithSplits = {},
  heading,
  subheading,
  toolbarEnd,
  sampleToolbarEnd,
  matchupToolbar,
  splitDisabled = false,
  finalCountBucket: finalCountBucketProp,
  onFinalCountBucketChange,
  runnersFilter: runnersFilterProp,
  onRunnersFilterChange,
  toolbarVariant = "default",
}: PitchingStatsSheetProps) {
  const [search, setSearch] = useState("");
  const [splitView, setSplitView] = useState<PitchingSplitView>("overall");
  const [runnersFilterInternal, setRunnersFilterInternal] = useState<StatsRunnersFilterKey>("all");
  const runnersControlled = onRunnersFilterChange != null;
  const runnersFilter = runnersControlled ? (runnersFilterProp ?? "all") : runnersFilterInternal;
  const setRunnersFilter = (v: StatsRunnersFilterKey) => {
    if (runnersControlled) onRunnersFilterChange(v);
    else setRunnersFilterInternal(v);
  };
  const [columnMode, setColumnMode] = useState<PitchColumnMode>("standard");
  const [finalCountBucketInternal, setFinalCountBucketInternal] = useState<BattingFinalCountBucketKey | null>(null);
  const finalCountControlled = onFinalCountBucketChange != null;
  const finalCountBucket = finalCountControlled ? (finalCountBucketProp ?? null) : finalCountBucketInternal;
  const setFinalCountBucket = (v: BattingFinalCountBucketKey | null) => {
    if (finalCountControlled) onFinalCountBucketChange(v);
    else setFinalCountBucketInternal(v);
  };

  useEffect(() => {
    if (splitDisabled && splitView !== "overall") setSplitView("overall");
  }, [splitDisabled, splitView]);

  useEffect(() => {
    if (runnersFilter === "all") return;
    if (finalCountControlled) {
      if (finalCountBucket != null) onFinalCountBucketChange?.(null);
    } else {
      setFinalCountBucketInternal((prev) => (prev == null ? prev : null));
    }
  }, [runnersFilter, finalCountControlled, finalCountBucket, onFinalCountBucketChange]);

  const [sortKey, setSortKey] = useState<PitchSortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const displayColumns =
    columnMode === "contact" ? CONTACT_PITCH_COLUMNS : columnMode === "pitchTypes" ? PITCH_TYPE_PITCH_COLUMNS : COLUMNS;

  useEffect(() => {
    setSortKey("name");
    setSortDir("asc");
  }, [columnMode]);

  const initialPitchingStats = useMemo(() => {
    const out: Record<string, PitchingStats> = {};
    for (const p of players) {
      let s: PitchingStats | undefined;
      if (finalCountBucket != null) {
        const map = getPitchingFinalCountMapForSplit(
          pitchingStatsWithSplits,
          p.id,
          splitView,
          runnersFilter
        );
        s = map?.[finalCountBucket] ?? undefined;
      } else {
        s = getPitchingLineForSheet(pitchingStatsWithSplits, p.id, splitView, runnersFilter);
      }
      if (s) out[p.id] = s;
    }
    return out;
  }, [players, pitchingStatsWithSplits, splitView, finalCountBucket, runnersFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => p.name.toLowerCase().includes(q));
  }, [players, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") {
        const cmp = comparePlayersByLastNameThenFull(a, b);
        return sortDir === "asc" ? cmp : -cmp;
      }
      const sa = initialPitchingStats[a.id];
      const sb = initialPitchingStats[b.id];
      const va = getSortValue(sa, sortKey);
      const vb = getSortValue(sb, sortKey);
      const cmp = va - vb;
      const diff = sortDir === "asc" ? cmp : -cmp;
      if (diff !== 0) return diff;
      return comparePlayersByLastNameThenFull(a, b);
    });
  }, [filtered, initialPitchingStats, sortKey, sortDir, displayColumns]);

  const teamColumnBest = useMemo(() => {
    const keys = displayColumns.filter((c) => c.key !== "name").map((c) => c.key);
    const best: Partial<Record<PitchSortKey, number>> = {};
    for (const key of keys) {
      if (PITCH_SHEET_PITCH_TYPE_NEUTRAL.has(key)) continue;
      const vals: number[] = [];
      for (const p of filtered) {
        const s = initialPitchingStats[p.id];
        const n = getPitchingStatValue(s, key);
        if (n === undefined || Number.isNaN(n)) continue;
        if ((key === "era" || key === "fip" || key === "whip") && s && s.ip <= 0) continue;
        if (OVERALL_PER7.includes(key) && s && s.ip <= 0) continue;
        if (key === "baa" && s && s.abAgainst < 1) continue;
        vals.push(n);
      }
      if (vals.length === 0) continue;
      if (HIGHER_BETTER.has(key)) {
        best[key] = Math.max(...vals);
      } else if (LOWER_BETTER.has(key)) {
        best[key] = Math.min(...vals);
      } else {
        best[key] = Math.max(...vals);
      }
    }
    return best;
  }, [filtered, initialPitchingStats, displayColumns]);

  const pitchingTeamLine = useMemo(() => {
    const lines = filtered
      .map((p) => initialPitchingStats[p.id])
      .filter((s): s is PitchingStats => s != null);
    return aggregatePitchingTeamLine(lines);
  }, [filtered, initialPitchingStats]);

  const handleSort = (key: PitchSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      if (key === "name") {
        setSortDir("asc");
      } else if (HIGHER_BETTER.has(key)) {
        setSortDir("desc");
      } else {
        setSortDir(LOWER_BETTER.has(key) ? "asc" : "desc");
      }
    }
  };

  const isL = (key: PitchSortKey, s: PitchingStats | undefined) => {
    if (key === "name" || PITCH_SHEET_PITCH_TYPE_NEUTRAL.has(key)) return false;
    const val = getPitchingStatValue(s, key);
    const b = teamColumnBest[key];
    if (val === undefined || b === undefined) return false;
    if ((key === "era" || key === "fip" || key === "whip") && s && s.ip <= 0) return false;
    if (OVERALL_PER7.includes(key) && s && s.ip <= 0) return false;
    if (key === "baa" && s && s.abAgainst < 1) return false;
    const baaAbK = PITCH_BAA_AB_KEY[key];
    if (baaAbK && s) {
      const ab = s.rates[baaAbK];
      if (typeof ab !== "number" || ab < 1) return false;
    }
    return isLeaderMatch(key, val, b);
  };

  return (
    <div className="space-y-4">
      {(heading || subheading) && (
        <div>
          {heading && (
            <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--text)]">{heading}</h2>
          )}
          {subheading && <p className="mt-1 text-sm text-[var(--text-muted)]">{subheading}</p>}
        </div>
      )}

      {toolbarVariant === "grouped" ? (
        <div className="flex flex-col gap-3">
          <div className="min-w-0 rounded-lg border border-[var(--border)]/55 bg-[var(--bg-elevated)]/30 px-4 py-3">
            <div className="mb-3">
              <p className="font-display text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Filters
              </p>
            </div>
            <div
              className={`grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 ${
                matchupToolbar
                  ? "xl:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6"
                  : "xl:grid-cols-4 2xl:grid-cols-5"
              }`}
            >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Split
                  </span>
                  <select
                    value={splitView}
                    onChange={(e) => setSplitView(e.target.value as PitchingSplitView)}
                    disabled={splitDisabled}
                    title={
                      splitDisabled
                        ? "Platoon split is off while a specific batter is selected."
                        : undefined
                    }
                    className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Pitching split view"
                  >
                    <option value="overall">Overall</option>
                    <option value="vsLHB">vs LHB</option>
                    <option value="vsRHB">vs RHB</option>
                  </select>
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Runners
                  </span>
                  <select
                    value={runnersFilter}
                    onChange={(e) => setRunnersFilter(e.target.value as StatsRunnersFilterKey)}
                    className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                    aria-label="Filter by base state before the plate appearance"
                    title="Uses offensive base state at the start of each PA."
                  >
                    <option value="all">All situations</option>
                    <option value="basesEmpty">Bases empty</option>
                    <option value="runnersOn">Runners on</option>
                    <option value="risp">RISP</option>
                    <option value="basesLoaded">Bases loaded</option>
                  </select>
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Final count
                  </span>
                  <select
                    value={finalCountBucket ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFinalCountBucket(v === "" ? null : (v as BattingFinalCountBucketKey));
                    }}
                    disabled={runnersFilter !== "all"}
                    className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Filter stats to plate appearances ending at this ball–strike count"
                    title={
                      runnersFilter !== "all"
                        ? "Clear Runners filter to use Final count."
                        : "Optional. When set, table uses only PAs whose saved final count matches. Works with Standard, Discipline, or Pitch-type columns."
                    }
                  >
                    <option value="">All PAs</option>
                    {FINAL_COUNT_BUCKET_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                {matchupToolbar ? (
                  <>
                    {matchupToolbar.battersFlat === undefined ? (
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                          Opponent
                        </span>
                        <select
                          value={matchupToolbar.opponentKey}
                          onChange={(e) => {
                            const v = e.target.value;
                            matchupToolbar.onOpponentChange(v);
                            matchupToolbar.onBatterChange("");
                          }}
                          className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                          aria-label="Filter by opponent"
                        >
                          <option value="">All opponents</option>
                          {matchupToolbar.opponents.map((o) => (
                            <option key={o.key} value={o.key}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        Batter
                      </span>
                      <select
                        value={matchupToolbar.batterId}
                        onChange={(e) => matchupToolbar.onBatterChange(e.target.value)}
                        disabled={matchupToolbar.battersFlat === undefined ? !matchupToolbar.opponentKey : false}
                        className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={
                          matchupToolbar.battersFlat !== undefined
                            ? "Filter by batter (lineup side)"
                            : "Filter by opposing batter"
                        }
                      >
                        <option value="">
                          {matchupToolbar.battersFlat !== undefined
                            ? "All batters"
                            : matchupToolbar.opponentKey
                              ? "All batters"
                              : "Choose opponent first"}
                        </option>
                        {(matchupToolbar.battersFlat ??
                          matchupToolbar.battersByOpponent[matchupToolbar.opponentKey] ??
                          []
                        ).map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : null}
              <div
                className={`col-span-full grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 ${
                  matchupToolbar
                    ? "xl:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6"
                    : "xl:grid-cols-4 2xl:grid-cols-5"
                }`}
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Columns
                  </span>
                  <select
                    value={columnMode}
                    onChange={(e) => setColumnMode(e.target.value as PitchColumnMode)}
                    className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                    aria-label="Pitching stat column set"
                  >
                    <option value="standard">Standard</option>
                    <option value="contact">Discipline &amp; BIP</option>
                    <option value="pitchTypes">Pitch types</option>
                  </select>
                </div>
                <div
                  className={`flex min-w-0 flex-col gap-1.5 ${
                    matchupToolbar
                      ? "sm:col-span-1 lg:col-span-2 xl:col-span-3 2xl:col-span-4 min-[1800px]:col-span-5"
                      : "sm:col-span-1 lg:col-span-2 xl:col-span-3 2xl:col-span-4"
                  }`}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Search
                  </span>
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:gap-3 sm:justify-start">
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Player name…"
                      className="w-full max-w-[16rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none"
                    />
                    {sampleToolbarEnd ? <div className="shrink-0">{sampleToolbarEnd}</div> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {toolbarEnd ? <div className="flex shrink-0 justify-end">{toolbarEnd}</div> : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <label className="flex min-w-0 items-center gap-2 text-sm text-white">
              <span className="shrink-0">Split</span>
              <select
                value={splitView}
                onChange={(e) => setSplitView(e.target.value as PitchingSplitView)}
                disabled={splitDisabled}
                title={
                  splitDisabled
                    ? "Platoon split is off while a specific batter is selected."
                    : undefined
                }
                className="max-w-[11rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Pitching split view"
              >
                <option value="overall">Overall</option>
                <option value="vsLHB">vs LHB</option>
                <option value="vsRHB">vs RHB</option>
              </select>
            </label>
            <label className="flex min-w-0 items-center gap-2 text-sm text-white">
              <span className="shrink-0">Runners</span>
              <select
                value={runnersFilter}
                onChange={(e) => setRunnersFilter(e.target.value as StatsRunnersFilterKey)}
                className="max-w-[12rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                aria-label="Filter by base state before the plate appearance"
                title="Uses offensive base state at the start of each PA."
              >
                <option value="all">All situations</option>
                <option value="basesEmpty">Bases empty</option>
                <option value="runnersOn">Runners on</option>
                <option value="risp">RISP</option>
                <option value="basesLoaded">Bases loaded</option>
              </select>
            </label>
            <label className="flex min-w-0 items-center gap-2 text-sm text-white">
              <span className="shrink-0">Columns</span>
              <select
                value={columnMode}
                onChange={(e) => setColumnMode(e.target.value as PitchColumnMode)}
                className="max-w-[12rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                aria-label="Pitching stat column set"
              >
                <option value="standard">Standard</option>
                <option value="contact">Discipline &amp; BIP</option>
                <option value="pitchTypes">Pitch types</option>
              </select>
            </label>
            <label className="flex min-w-0 items-center gap-2 text-sm text-white">
              <span className="shrink-0">Final count</span>
              <select
                value={finalCountBucket ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setFinalCountBucket(v === "" ? null : (v as BattingFinalCountBucketKey));
                }}
                disabled={runnersFilter !== "all"}
                className="max-w-[7.5rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Filter stats to plate appearances ending at this ball–strike count"
                title={
                  runnersFilter !== "all"
                    ? "Clear Runners filter to use Final count."
                    : "Optional. When set, table uses only PAs whose saved final count matches. Works with Standard, Discipline, or Pitch-type columns."
                }
              >
                <option value="">All PAs</option>
                {FINAL_COUNT_BUCKET_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {matchupToolbar ? (
              <>
                {matchupToolbar.battersFlat === undefined ? (
                  <label className="flex min-w-0 max-w-full items-center gap-2 text-sm text-white">
                    <span className="shrink-0">Opponent</span>
                    <select
                      value={matchupToolbar.opponentKey}
                      onChange={(e) => {
                        const v = e.target.value;
                        matchupToolbar.onOpponentChange(v);
                        matchupToolbar.onBatterChange("");
                      }}
                      className="min-w-0 max-w-[14rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                      aria-label="Filter by opponent"
                    >
                      <option value="">All opponents</option>
                      {matchupToolbar.opponents.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="flex min-w-0 max-w-full items-center gap-2 text-sm text-white">
                  <span className="shrink-0">Batter</span>
                  <select
                    value={matchupToolbar.batterId}
                    onChange={(e) => matchupToolbar.onBatterChange(e.target.value)}
                    disabled={matchupToolbar.battersFlat === undefined ? !matchupToolbar.opponentKey : false}
                    className="min-w-0 max-w-[14rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={
                      matchupToolbar.battersFlat !== undefined
                        ? "Filter by batter (lineup side)"
                        : "Filter by opposing batter"
                    }
                  >
                        <option value="">
                          {matchupToolbar.battersFlat !== undefined
                            ? "All batters"
                            : matchupToolbar.opponentKey
                              ? "All batters"
                              : "Choose opponent first"}
                        </option>
                    {(matchupToolbar.battersFlat ??
                      matchupToolbar.battersByOpponent[matchupToolbar.opponentKey] ??
                      []
                    ).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            <label className="flex min-w-0 items-center gap-2 text-sm text-white">
              <span className="shrink-0">Search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Player name…"
                className="min-w-[8rem] max-w-[16rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none"
            />
          </label>
        </div>
        {toolbarEnd ? <div className="flex shrink-0 items-center">{toolbarEnd}</div> : null}
      </div>
      )}
      {finalCountBucket != null && (
        <p className="text-xs leading-snug text-[var(--text-muted)]">
          Showing stats for PAs whose{" "}
          <strong className="font-medium text-[var(--text)]">saved final count</strong> is{" "}
          <strong className="font-medium text-[var(--text)]">{finalCountBucket}</strong> (after Split). Clear Final count
          to return to all PAs.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="stats-sheet-table w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="bg-[var(--bg-elevated)]">
              <th
                className={`font-display border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] ${STICKY_LEAD.rank}`}
                title={PITCHING_STAT_HEADER_TOOLTIPS.rank}
              >
                #
              </th>
              <th
                title={COLUMNS[0].tooltip}
                className={`font-display border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)] ${STICKY_LEAD.player} ${COLUMNS[0].align === "right" ? "text-right" : "text-left"} cursor-pointer select-none hover:opacity-85 ${sortKey === COLUMNS[0].key ? "font-bold" : ""}`}
                onClick={() => handleSort(COLUMNS[0].key)}
              >
                {COLUMNS[0].label}
                {sortKey === COLUMNS[0].key && (
                  <span className="ml-1 text-[var(--accent)]" aria-hidden>
                    {sortDir === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </th>
              <th
                title={PITCHING_STAT_HEADER_TOOLTIPS.throws}
                className={`font-display border-b border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] ${STICKY_LEAD.throws}`}
              >
                T
              </th>
              {displayColumns.slice(1).map(({ key, label, align, tooltip, borderLeft }, idx) => (
                <th
                  key={`${key}-${idx}`}
                    title={tooltip}
                  className={`border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)] ${SCROLL_CELL_Z} ${pitchSheetHeaderBorderLeft(columnMode, key, borderLeft, idx) ? "border-l border-[var(--border)]" : ""} ${align === "right" ? "text-right" : "text-left"} cursor-pointer select-none hover:opacity-85 ${sortKey === key ? "font-bold" : ""}`}
                    onClick={() => handleSort(key)}
                  >
                    {label}
                    {sortKey === key && (
                      <span className="ml-1 text-[var(--accent)]" aria-hidden>
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((player, index) => {
              const s = initialPitchingStats[player.id];
              return (
                <tr
                  key={player.id}
                  tabIndex={0}
                  onClick={() => setSelectedPlayerId((prev) => (prev === player.id ? null : player.id))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedPlayerId((prev) => (prev === player.id ? null : player.id));
                    }
                  }}
                  className={`group cursor-pointer transition-colors ${
                    selectedPlayerId === player.id
                      ? index % 2 === 0
                        ? "bg-[color-mix(in_srgb,var(--accent)_18%,var(--bg-base))]"
                        : "bg-[color-mix(in_srgb,var(--accent)_18%,var(--bg-elevated))]"
                      : index % 2 === 0
                        ? "bg-[var(--bg-base)] hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--bg-base))]"
                        : "bg-[var(--bg-elevated)] hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--bg-elevated))]"
                  }`}
                >
                  <td
                    className={`px-3 py-2 text-center text-[var(--text-muted)] tabular-nums ${STICKY_LEAD.rank} ${stickyLeadRowBg(selectedPlayerId === player.id, index)}`}
                  >
                    {index + 1}
                  </td>
                  <td
                    className={`min-w-0 px-3 py-2 font-medium text-[var(--text)] ${STICKY_LEAD.player} ${stickyLeadRowBg(selectedPlayerId === player.id, index)}`}
                  >
                    <Link
                      href={analystPlayerProfileHref(player.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate text-[var(--accent)] hover:underline"
                      title={player.name}
                    >
                      {player.name}
                      {player.jersey && (
                        <span className="ml-1 text-[var(--text-muted)]">#{player.jersey}</span>
                      )}
                    </Link>
                  </td>
                  <td
                    className={`${STICKY_LEAD.throws} px-2 py-2 text-center text-[var(--text)] ${stickyLeadRowBg(selectedPlayerId === player.id, index)}`}
                  >
                    {player.throws != null ? THROWS_LABEL[player.throws] ?? player.throws : "—"}
                  </td>
                  {displayColumns.slice(1).map((col, idx) => (
                    <td
                      key={`${col.key}-${idx}`}
                      className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)] ${pitchSheetHeaderBorderLeft(columnMode, col.key, col.borderLeft, idx) ? "border-l border-[var(--border)]" : ""}`}
                    >
                      <LeaderStat show={isL(col.key, s)}>{displayCell(s, col.key, col.format)}</LeaderStat>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          {sorted.length > 0 && pitchingTeamLine ? (
            <tfoot>
              <tr className="font-semibold text-[var(--text)] [&_td]:py-2.5">
                <td
                  className={`${TEAM_FOOTER_TOP_RULE} bg-[var(--bg-elevated)] px-3 py-2 text-center text-[var(--text-muted)] tabular-nums ${STICKY_LEAD.rank}`}
                >
                  —
                </td>
                <td
                  className={`${TEAM_FOOTER_TOP_RULE} min-w-0 bg-[var(--bg-elevated)] px-3 py-2 font-display font-semibold text-[var(--text)] ${STICKY_LEAD.player}`}
                >
                  Team
                </td>
                <td
                  className={`${TEAM_FOOTER_TOP_RULE} ${STICKY_LEAD.throws} bg-[var(--bg-elevated)] px-2 py-2 text-center text-[var(--text-muted)]`}
                >
                  —
                </td>
                {displayColumns.slice(1).map((col, idx) => (
                  <td
                    key={`team-total-${col.key}-${idx}`}
                    className={`${TEAM_FOOTER_TOP_RULE} ${SCROLL_CELL_Z} bg-[var(--bg-elevated)] px-3 py-2 text-right tabular-nums font-semibold text-[var(--accent)] ${pitchSheetHeaderBorderLeft(columnMode, col.key, col.borderLeft, idx) ? TEAM_FOOTER_GROUP_LEFT : ""}`}
                    title={
                      col.key === "g" || col.key === "gs"
                        ? "Team total not shown: summing each pitcher’s games does not equal team games played."
                        : undefined
                    }
                  >
                    {col.key === "g" || col.key === "gs"
                      ? "—"
                      : displayCell(pitchingTeamLine, col.key, col.format)}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {sorted.length === 0 && (
        <p className="py-8 text-center text-sm text-[var(--text-muted)]">
          {search.trim() ? "No pitchers match your search." : "No pitchers on roster."}
        </p>
      )}
    </div>
  );
}
