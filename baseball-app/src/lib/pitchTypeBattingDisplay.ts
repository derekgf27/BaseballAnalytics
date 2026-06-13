/**
 * Batter results by pitch type (terminal logged pitch) — shared labels and row builders for UI.
 */

import { fmtDecimalNoLeadingZero } from "@/lib/format";
import type { BattingStats, PitchTypeBucketKey, PitchTypeBucketProfile } from "@/lib/types";
import {
  formatPitchTypeBaa,
  formatPitchTypeMix,
  formatPitchTypePct,
  formatPitchTypeRate,
} from "@/lib/pitchTypeBaaDisplay";

export const BAT_PITCH_TYPE_STATS_HELPER_TEXT =
  "Fastball, off-speed, and breaking ball — detailed pitch tags from Record roll into these three buckets. Usage, swing, and whiff use every typed pitch seen. AVG, OBP, OPS, and K% use plate appearances that ended on that bucket (final logged pitch).";

export const BAT_PITCH_TYPE_DISCIPLINE_HELPER_TEXT =
  "Sw%, Whiff%, and Foul% use every typed pitch seen in that bucket. GB%, LD%, FB%, and IFF% use batted balls when the PA ended on that bucket (ball in play).";

export const BAT_PITCH_TYPE_DISCIPLINE_MODE_LABEL = "Discipline & BIP vs pitch type (FB / OS / BRK)";

export const BAT_PITCH_TYPE_COLUMNS_MODE_LABEL = "Results vs pitch type (FB / OS / BRK)";

const BAT_PITCH_TYPE_LABELS: readonly { key: PitchTypeBucketKey; label: string; abbrev: string }[] = [
  { key: "fastball", abbrev: "FB", label: "Fastball" },
  { key: "off_speed", abbrev: "OS", label: "Off-speed" },
  { key: "breaking_ball", abbrev: "BRK", label: "Breaking ball" },
];

export type BattingPitchTypeRow = {
  key: string;
  label: string;
  abbrev: string;
  mix: number | undefined;
  firstPitchMix: number | undefined;
  mixAhead: number | undefined;
  mixBehind: number | undefined;
  mixEven: number | undefined;
  paEndPct: number | undefined;
  strikePct: number | undefined;
  ballPct: number | undefined;
  calledStrikePct: number | undefined;
  foulPct: number | undefined;
  swingPct: number | undefined;
  whiffPct: number | undefined;
  twoStrikeWhiffPct: number | undefined;
  contactPct: number | undefined;
  ab: number | undefined;
  h: number | undefined;
  avg: number | undefined;
  obp: number | undefined;
  ops: number | undefined;
  kPct: number | undefined;
  bbPct: number | undefined;
  hrPct: number | undefined;
  xbhPct: number | undefined;
  slg: number | undefined;
  iso: number | undefined;
  gbPct: number | undefined;
  ldPct: number | undefined;
  fbPct: number | undefined;
  iffPct: number | undefined;
  pitches: number | undefined;
  hasTypedPitches: boolean;
};

function rowFromProfile(
  def: (typeof BAT_PITCH_TYPE_LABELS)[number],
  profile: PitchTypeBucketProfile | undefined,
  typedTotal: number
): BattingPitchTypeRow {
  const mixN = profile?.mix;
  const hasTypedPitches = typedTotal > 0 && mixN != null && mixN > 0;
  const ab = profile?.ab;
  const h = profile?.h;
  const avg = profile?.baa ?? (ab != null && ab >= 1 && h != null ? h / ab : undefined);
  return {
    key: def.key,
    label: def.label,
    abbrev: def.abbrev,
    mix: mixN,
    firstPitchMix: profile?.firstPitchMix,
    mixAhead: profile?.mixAhead,
    mixBehind: profile?.mixBehind,
    mixEven: profile?.mixEven,
    paEndPct: profile?.paEndPct,
    strikePct: profile?.strikePct,
    ballPct: profile?.ballPct,
    calledStrikePct: profile?.calledStrikePct,
    foulPct: profile?.foulPct,
    swingPct: profile?.swingPct,
    whiffPct: profile?.whiffPct,
    twoStrikeWhiffPct: profile?.twoStrikeWhiffPct,
    contactPct: profile?.contactPct,
    ab,
    h,
    avg,
    obp: profile?.obp,
    ops: profile?.ops,
    kPct: profile?.kPct,
    bbPct: profile?.bbPct,
    hrPct: profile?.hrPct,
    xbhPct: profile?.xbhPct,
    slg: profile?.slg,
    iso: profile?.iso,
    gbPct: profile?.gbPct,
    ldPct: profile?.ldPct,
    fbPct: profile?.fbPct,
    iffPct: profile?.iffPct,
    pitches: profile?.pitches,
    hasTypedPitches,
  };
}

export function buildBattingPitchTypeRows(stats: BattingStats): BattingPitchTypeRow[] {
  const typedTotal = stats.batTyped ?? 0;
  const buckets = stats.batBuckets;
  return BAT_PITCH_TYPE_LABELS.map((def) => rowFromProfile(def, buckets?.[def.key], typedTotal));
}

/** Rows with at least one typed pitch or a results sample — hides unused types. */
export function buildBattingPitchTypeRowsVisible(stats: BattingStats): BattingPitchTypeRow[] {
  return buildBattingPitchTypeRows(stats).filter((r) => r.hasTypedPitches || r.ab != null);
}

export function formatBattingPitchTypeAvg(rate: number | undefined): string {
  return formatPitchTypeBaa(rate);
}

export { formatPitchTypeMix, formatPitchTypePct, formatPitchTypeRate };

export function pitchTypeAvgColumnLabel(abbrev: string): string {
  return `AVG ${abbrev}`;
}

export function pitchTypeKColumnLabel(abbrev: string): string {
  return `K% ${abbrev}`;
}

export function pitchTypeMixColumnLabel(abbrev: string): string {
  return `${abbrev} Mix`;
}

export function pitchTypeSwColumnLabel(abbrev: string): string {
  return `${abbrev} Sw%`;
}

export function pitchTypeWhiffColumnLabel(abbrev: string): string {
  return `${abbrev} Whiff%`;
}

/** Coach pitch abbrev + bucket key for team batting pitch-type sheet columns. */
export const BAT_PITCH_TYPE_SHEET_SUFFIXES = BAT_PITCH_TYPE_LABELS.map((row) => ({
  suffix: row.abbrev,
  abbrev: row.abbrev,
  bucket: row.key,
  label: row.label,
}));

export type BatPitchTypeSheetSuffix = (typeof BAT_PITCH_TYPE_SHEET_SUFFIXES)[number]["suffix"];

export type BatPitchTypeProfileFieldKey = "mix" | "swingPct" | "whiffPct" | "baa" | "kPct";

export type BatPitchTypeDisciplineFieldKey =
  | "swingPct"
  | "whiffPct"
  | "foulPct"
  | "contactPct"
  | "twoStrikeWhiffPct"
  | "gbPct"
  | "ldPct"
  | "fbPct"
  | "iffPct";

export function battingPitchTypeProfileRate(
  stats: BattingStats | undefined,
  bucket: PitchTypeBucketKey,
  field: BatPitchTypeProfileFieldKey
): number | undefined {
  const profile = stats?.batBuckets?.[bucket];
  if (!profile) return undefined;
  if (field === "baa") {
    const v = profile.baa;
    return typeof v === "number" && !Number.isNaN(v) ? v : undefined;
  }
  const v = profile[field];
  return typeof v === "number" && !Number.isNaN(v) ? v : undefined;
}

export function battingPitchTypeDisciplineRate(
  stats: BattingStats | undefined,
  bucket: PitchTypeBucketKey,
  field: BatPitchTypeDisciplineFieldKey
): number | undefined {
  const v = stats?.batBuckets?.[bucket]?.[field];
  return typeof v === "number" && !Number.isNaN(v) ? v : undefined;
}

export function battingPitchTypePitchesSeen(
  stats: BattingStats | undefined,
  bucket: PitchTypeBucketKey
): number | undefined {
  const n = stats?.batBuckets?.[bucket]?.pitches;
  return typeof n === "number" && n > 0 ? n : undefined;
}

export function battingPitchTypeAvg(stats: BattingStats | undefined, bucket: PitchTypeBucketKey): number | undefined {
  const profile = stats?.batBuckets?.[bucket];
  if (!profile) return undefined;
  if (profile.baa != null) return profile.baa;
  const ab = profile.ab;
  const h = profile.h;
  return ab != null && ab >= 1 && h != null ? h / ab : undefined;
}

/** Pitch types shown on batter tables (always three coarse buckets). */
export function visibleBatPitchTypeBuckets(_lines: BattingStats[]): PitchTypeBucketKey[] {
  return BAT_PITCH_TYPE_LABELS.map((d) => d.key);
}
