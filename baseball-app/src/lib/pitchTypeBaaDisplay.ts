/**
 * Opponent BAA by pitch type (terminal logged pitch) — shared labels and row builders for UI.
 */

import { fmtDecimalNoLeadingZero } from "@/lib/format";
import type { PitchTypeBucketKey, PitchTypeBucketProfile, PitchingRateLine, PitchingStats } from "@/lib/types";

export const PITCH_TYPE_STATS_HELPER_TEXT =
  "Usage and command stats use every typed pitch. BAA, K%, SLG, and batted-ball splits use plate appearances that ended on that pitch type (final logged pitch). PAs with no pitch log or an untyped final pitch are excluded from results columns.";

/** @deprecated Use PITCH_TYPE_STATS_HELPER_TEXT */
export const PITCH_TYPE_BAA_HELPER_TEXT = PITCH_TYPE_STATS_HELPER_TEXT;

export const PITCH_TYPE_COLUMNS_MODE_LABEL = "By pitch type (mix + BAA)";

const PITCH_TYPE_LABELS: readonly { key: PitchTypeBucketKey; label: string; abbrev: string }[] = [
  { key: "fastball", abbrev: "FB", label: "Fastball" },
  { key: "sinker", abbrev: "SI", label: "Sinker" },
  { key: "cutter", abbrev: "FC", label: "Cutter" },
  { key: "slider", abbrev: "SL", label: "Slider" },
  { key: "sweeper", abbrev: "SW", label: "Sweeper" },
  { key: "curveball", abbrev: "CB", label: "Curveball" },
  { key: "changeup", abbrev: "CH", label: "Changeup" },
  { key: "splitter", abbrev: "SP", label: "Splitter" },
  { key: "other", abbrev: "OT", label: "Other" },
];

export type PitchTypeBaaRow = {
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
  baa: number | undefined;
  kPct: number | undefined;
  bbPct: number | undefined;
  hrPct: number | undefined;
  xbhPct: number | undefined;
  slg: number | undefined;
  iso: number | undefined;
  gbPct: number | undefined;
  ldPct: number | undefined;
  fbPct: number | undefined;
  hasTypedPitches: boolean;
};

type PitchTypeFieldSet = {
  key: PitchTypeBucketKey;
  abbrev: string;
  label: string;
  mix: keyof PitchingRateLine;
  sw: keyof PitchingRateLine;
  wh: keyof PitchingRateLine;
  ab: keyof PitchingRateLine;
  h: keyof PitchingRateLine;
};

const PITCH_TYPE_BAA_ROWS: readonly PitchTypeFieldSet[] = [
  { key: "fastball", abbrev: "FB", label: "Fastball", mix: "plMixFB", sw: "plSwFB", wh: "plWhiffFB", ab: "plTxAbFB", h: "plTxHFB" },
  { key: "sinker", abbrev: "SI", label: "Sinker", mix: "plMixSI", sw: "plSwSI", wh: "plWhiffSI", ab: "plTxAbSI", h: "plTxHSI" },
  { key: "cutter", abbrev: "FC", label: "Cutter", mix: "plMixFC", sw: "plSwFC", wh: "plWhiffFC", ab: "plTxAbFC", h: "plTxHFC" },
  { key: "slider", abbrev: "SL", label: "Slider", mix: "plMixSL", sw: "plSwSL", wh: "plWhiffSL", ab: "plTxAbSL", h: "plTxHSL" },
  { key: "sweeper", abbrev: "SW", label: "Sweeper", mix: "plMixSW", sw: "plSwSW", wh: "plWhiffSW", ab: "plTxAbSW", h: "plTxHSW" },
  { key: "curveball", abbrev: "CB", label: "Curveball", mix: "plMixCB", sw: "plSwCB", wh: "plWhiffCB", ab: "plTxAbCB", h: "plTxHCB" },
  { key: "changeup", abbrev: "CH", label: "Changeup", mix: "plMixCH", sw: "plSwCH", wh: "plWhiffCH", ab: "plTxAbCH", h: "plTxHCH" },
  { key: "splitter", abbrev: "SP", label: "Splitter", mix: "plMixSP", sw: "plSwSP", wh: "plWhiffSP", ab: "plTxAbSP", h: "plTxHSP" },
  { key: "other", abbrev: "OT", label: "Other", mix: "plMixOT", sw: "plSwOT", wh: "plWhiffOT", ab: "plTxAbOT", h: "plTxHOT" },
];

function numField(rates: PitchingRateLine, key: keyof PitchingRateLine): number | undefined {
  const v = rates[key];
  return typeof v === "number" && !Number.isNaN(v) ? v : undefined;
}

function rowFromProfile(
  def: (typeof PITCH_TYPE_LABELS)[number],
  profile: PitchTypeBucketProfile | undefined,
  typedTotal: number,
  legacy?: { mix?: number; swingPct?: number; whiffPct?: number; ab?: number; h?: number }
): PitchTypeBaaRow {
  const mixN = profile?.mix ?? legacy?.mix;
  const hasTypedPitches = typedTotal > 0 && mixN != null && mixN > 0;
  const ab = profile?.ab ?? legacy?.ab;
  const h = profile?.h ?? legacy?.h;
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
    swingPct: profile?.swingPct ?? legacy?.swingPct,
    whiffPct: profile?.whiffPct ?? legacy?.whiffPct,
    twoStrikeWhiffPct: profile?.twoStrikeWhiffPct,
    contactPct: profile?.contactPct,
    ab,
    h,
    baa: profile?.baa ?? (ab != null && ab >= 1 && h != null ? h / ab : undefined),
    kPct: profile?.kPct,
    bbPct: profile?.bbPct,
    hrPct: profile?.hrPct,
    xbhPct: profile?.xbhPct,
    slg: profile?.slg,
    iso: profile?.iso,
    gbPct: profile?.gbPct,
    ldPct: profile?.ldPct,
    fbPct: profile?.fbPct,
    hasTypedPitches,
  };
}

export function buildPitchTypeBaaRows(rates: PitchingRateLine): PitchTypeBaaRow[] {
  const typedTotal = rates.plTyped ?? 0;
  const buckets = rates.plBuckets;

  if (buckets && Object.keys(buckets).length > 0) {
    return PITCH_TYPE_LABELS.map((def) =>
      rowFromProfile(def, buckets[def.key], typedTotal)
    );
  }

  return PITCH_TYPE_BAA_ROWS.map((def) => {
    const abRaw = numField(rates, def.ab) ?? 0;
    const hRaw = numField(rates, def.h) ?? 0;
    return rowFromProfile(
      def,
      undefined,
      typedTotal,
      {
        mix: numField(rates, def.mix),
        swingPct: numField(rates, def.sw),
        whiffPct: numField(rates, def.wh),
        ab: abRaw > 0 ? abRaw : undefined,
        h: abRaw > 0 ? hRaw : undefined,
      }
    );
  });
}

/** Rows with at least one typed pitch or a BAA sample — hides unused types. */
export function buildPitchTypeBaaRowsVisible(rates: PitchingRateLine): PitchTypeBaaRow[] {
  return buildPitchTypeBaaRows(rates).filter((r) => r.hasTypedPitches || r.ab != null);
}

export function formatPitchTypeBaa(rate: number | undefined): string {
  if (rate === undefined) return "—";
  return fmtDecimalNoLeadingZero(rate, 3);
}

export function formatPitchTypeRate(rate: number | undefined, decimals = 3): string {
  if (rate === undefined) return "—";
  return fmtDecimalNoLeadingZero(rate, decimals);
}

export function formatPitchTypeMix(rate: number | undefined): string {
  if (rate === undefined) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatPitchTypePct(rate: number | undefined): string {
  if (rate === undefined) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export function pitchTypeBaaColumnLabel(abbrev: string): string {
  return `BAA ${abbrev}`;
}

export function pitchingStatsToRateLine(stats: PitchingStats | undefined): PitchingRateLine | undefined {
  return stats?.rates;
}
