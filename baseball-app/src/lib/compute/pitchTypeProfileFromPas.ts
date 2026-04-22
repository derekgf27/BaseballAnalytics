/**
 * Pitch-type usage and discipline from `pitch_events.pitch_type` (pitcher / mound view).
 * Batting stat lines intentionally omit these fields — use the pitching stat sheet for mix by type.
 */

import { pitchOutcomeIsSwing } from "@/lib/compute/pitchSequence";
import { PITCH_TRACKER_TYPES } from "@/lib/pitchTrackerUi";
import type {
  PAResult,
  PitchEvent,
  PitchingRateLine,
  PitchTrackerPitchType,
  PlateAppearance,
} from "@/lib/types";

/** PAs that do not count as an at-bat against the pitcher (mirrors `atBatsAgainst` exclusions). */
const PA_NON_AB_RESULTS = new Set<PAResult>(["bb", "ibb", "hbp", "sac_fly", "sac", "sac_bunt"]);

const PA_HIT_RESULTS = new Set<PAResult>(["single", "double", "triple", "hr"]);

function paCountsAsAtBatAgainst(pa: PlateAppearance): boolean {
  return !PA_NON_AB_RESULTS.has(pa.result);
}

export type PitchTypeBucketKey = PitchTrackerPitchType | "other";

/** Map free-text / coach enum to a display bucket; null = type not logged on this pitch. */
export function normalizePitchTypeBucket(raw: string | null | undefined): PitchTypeBucketKey | null {
  if (raw == null) return null;
  const t = String(raw).trim().toLowerCase();
  if (!t) return null;
  if ((PITCH_TRACKER_TYPES as readonly string[]).includes(t)) return t as PitchTrackerPitchType;

  if (t === "fb" || t.includes("four-seam") || t.includes("four seam")) return "fastball";
  if (t === "si" || t.includes("sinker") || t.includes("two-seam") || t.includes("2-seam")) return "sinker";
  if (t === "fc" || t.includes("cutter")) return "cutter";
  if (t === "sl" || t === "slider") return "slider";
  if (t === "sw" || t.includes("sweeper")) return "sweeper";
  if (t === "cb" || t === "curve" || t === "curveball" || t.includes("knuckle curve") || t === "kc") {
    return "curveball";
  }
  if (t === "ch" || t.includes("changeup") || t.includes("circle change")) return "changeup";
  if (t === "spl" || t === "split" || t.includes("splitter")) return "splitter";
  return "other";
}

type BucketAgg = { n: number; swings: number; whiffs: number };

function emptyBucket(): BucketAgg {
  return { n: 0, swings: 0, whiffs: 0 };
}

export function aggregatePitchTypeBuckets(
  pas: PlateAppearance[],
  eventsByPaId: Map<string, PitchEvent[]>
): { typedTotal: number; buckets: Record<PitchTypeBucketKey, BucketAgg> } {
  const buckets = {} as Record<PitchTypeBucketKey, BucketAgg>;
  for (const ty of PITCH_TRACKER_TYPES) buckets[ty] = emptyBucket();
  buckets.other = emptyBucket();

  let typedTotal = 0;

  for (const pa of pas) {
    const evs = eventsByPaId.get(pa.id) ?? [];
    for (const e of evs) {
      const b = normalizePitchTypeBucket(e.pitch_type);
      if (b == null) continue;
      typedTotal += 1;
      const box = buckets[b];
      box.n += 1;
      if (pitchOutcomeIsSwing(e.outcome)) box.swings += 1;
      if (e.outcome === "swinging_strike") box.whiffs += 1;
    }
  }
  return { typedTotal, buckets };
}

type PitchLogTypeFields = Pick<
  PitchingRateLine,
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
  | "plTxAbFB"
  | "plTxHFB"
  | "plTxAbSI"
  | "plTxHSI"
  | "plTxAbFC"
  | "plTxHFC"
  | "plTxAbSL"
  | "plTxHSL"
  | "plTxAbSW"
  | "plTxHSW"
  | "plTxAbCB"
  | "plTxHCB"
  | "plTxAbCH"
  | "plTxHCH"
  | "plTxAbSP"
  | "plTxHSP"
  | "plTxAbOT"
  | "plTxHOT"
>;

const PITCH_BUCKET_TO_STATS: readonly {
  bucket: PitchTypeBucketKey;
  mix: keyof PitchLogTypeFields;
  sw: keyof PitchLogTypeFields;
  wh: keyof PitchLogTypeFields;
}[] = [
  { bucket: "fastball", mix: "plMixFB", sw: "plSwFB", wh: "plWhiffFB" },
  { bucket: "sinker", mix: "plMixSI", sw: "plSwSI", wh: "plWhiffSI" },
  { bucket: "cutter", mix: "plMixFC", sw: "plSwFC", wh: "plWhiffFC" },
  { bucket: "slider", mix: "plMixSL", sw: "plSwSL", wh: "plWhiffSL" },
  { bucket: "sweeper", mix: "plMixSW", sw: "plSwSW", wh: "plWhiffSW" },
  { bucket: "curveball", mix: "plMixCB", sw: "plSwCB", wh: "plWhiffCB" },
  { bucket: "changeup", mix: "plMixCH", sw: "plSwCH", wh: "plWhiffCH" },
  { bucket: "splitter", mix: "plMixSP", sw: "plSwSP", wh: "plWhiffSP" },
  { bucket: "other", mix: "plMixOT", sw: "plSwOT", wh: "plWhiffOT" },
];

const PITCH_BUCKET_TERMINAL_AB_HITS: readonly {
  bucket: PitchTypeBucketKey;
  ab: keyof PitchLogTypeFields;
  h: keyof PitchLogTypeFields;
}[] = [
  { bucket: "fastball", ab: "plTxAbFB", h: "plTxHFB" },
  { bucket: "sinker", ab: "plTxAbSI", h: "plTxHSI" },
  { bucket: "cutter", ab: "plTxAbFC", h: "plTxHFC" },
  { bucket: "slider", ab: "plTxAbSL", h: "plTxHSL" },
  { bucket: "sweeper", ab: "plTxAbSW", h: "plTxHSW" },
  { bucket: "curveball", ab: "plTxAbCB", h: "plTxHCB" },
  { bucket: "changeup", ab: "plTxAbCH", h: "plTxHCH" },
  { bucket: "splitter", ab: "plTxAbSP", h: "plTxHSP" },
  { bucket: "other", ab: "plTxAbOT", h: "plTxHOT" },
];

function emptyTerminalTallies(): Record<PitchTypeBucketKey, { ab: number; h: number }> {
  const out = {} as Record<PitchTypeBucketKey, { ab: number; h: number }>;
  for (const ty of PITCH_TRACKER_TYPES) out[ty] = { ab: 0, h: 0 };
  out.other = { ab: 0, h: 0 };
  return out;
}

/** BAA sample: opponent AB and hits where the **last logged pitch** maps to each bucket. */
function aggregatePitchTypeTerminalAbHits(
  pas: PlateAppearance[],
  eventsByPaId: Map<string, PitchEvent[]>
): Record<PitchTypeBucketKey, { ab: number; h: number }> {
  const tallies = emptyTerminalTallies();
  for (const pa of pas) {
    if (!paCountsAsAtBatAgainst(pa)) continue;
    const evs = eventsByPaId.get(pa.id);
    if (!evs || evs.length === 0) continue;
    const last = evs[evs.length - 1]!;
    const b = normalizePitchTypeBucket(last.pitch_type);
    if (b == null) continue;
    const cell = tallies[b];
    cell.ab += 1;
    if (PA_HIT_RESULTS.has(pa.result)) cell.h += 1;
  }
  return tallies;
}

function fillPitchTerminalAbHitFields(
  tallies: Record<PitchTypeBucketKey, { ab: number; h: number }>,
  target: PitchLogTypeFields
): void {
  for (const { bucket, ab, h } of PITCH_BUCKET_TERMINAL_AB_HITS) {
    const { ab: abN, h: hN } = tallies[bucket];
    if (abN > 0) {
      target[ab] = abN;
      target[h] = hN;
    } else {
      target[ab] = undefined;
      target[h] = undefined;
    }
  }
}

function fillPitchLogTypeFields(
  typedTotal: number,
  buckets: Record<PitchTypeBucketKey, BucketAgg>,
  target: PitchLogTypeFields
): void {
  target.plTyped = typedTotal;
  if (typedTotal <= 0) return;

  for (const { bucket, mix, sw, wh } of PITCH_BUCKET_TO_STATS) {
    const b = buckets[bucket];
    target[mix] = b.n / typedTotal;
    if (b.n > 0) target[sw] = b.swings / b.n;
    if (b.swings > 0) target[wh] = b.whiffs / b.swings;
  }
}

export function mergePitchTypeProfileIntoPitchingRates(
  rates: PitchingRateLine,
  pas: PlateAppearance[],
  eventsByPaId: Map<string, PitchEvent[]>
): void {
  const { typedTotal, buckets } = aggregatePitchTypeBuckets(pas, eventsByPaId);
  fillPitchLogTypeFields(typedTotal, buckets, rates);
  const terminal = aggregatePitchTypeTerminalAbHits(pas, eventsByPaId);
  fillPitchTerminalAbHitFields(terminal, rates);
}

const PL_MIX_KEYS = PITCH_BUCKET_TO_STATS.map((r) => r.mix);
const PL_SW_KEYS = PITCH_BUCKET_TO_STATS.map((r) => r.sw);
const PL_WH_KEYS = PITCH_BUCKET_TO_STATS.map((r) => r.wh);

/** Roster / staff row: pool typed pitch counts, then recompute mix / swing / whiff rates. */
export function mergePitchTypeTeamProfileFromLines<T extends PitchLogTypeFields>(lines: T[], target: T): void {
  const plT = lines.reduce((s, b) => s + (typeof b.plTyped === "number" && !Number.isNaN(b.plTyped) ? b.plTyped : 0), 0);
  target.plTyped = plT;

  if (plT > 0) {
  for (let i = 0; i < PL_MIX_KEYS.length; i++) {
    const mk = PL_MIX_KEYS[i]!;
    let num = 0;
    for (const b of lines) {
      const typed = b.plTyped ?? 0;
      const mix = b[mk];
      if (typed > 0 && typeof mix === "number" && !Number.isNaN(mix)) num += mix * typed;
    }
    target[mk] = num / plT;
  }

  for (let i = 0; i < PL_SW_KEYS.length; i++) {
    const sk = PL_SW_KEYS[i]!;
    const mk = PL_MIX_KEYS[i]!;
    let denom = 0;
    let num = 0;
    for (const b of lines) {
      const typed = b.plTyped ?? 0;
      const mix = b[mk];
      const sw = b[sk];
      const nPitch = typed > 0 && typeof mix === "number" && !Number.isNaN(mix) ? mix * typed : 0;
      if (nPitch > 0 && typeof sw === "number" && !Number.isNaN(sw)) {
        num += sw * nPitch;
        denom += nPitch;
      }
    }
    target[sk] = denom > 0 ? num / denom : undefined;
  }

  for (let i = 0; i < PL_WH_KEYS.length; i++) {
    const wk = PL_WH_KEYS[i]!;
    const sk = PL_SW_KEYS[i]!;
    const mk = PL_MIX_KEYS[i]!;
    let denom = 0;
    let num = 0;
    for (const b of lines) {
      const typed = b.plTyped ?? 0;
      const mix = b[mk];
      const sw = b[sk];
      const wh = b[wk];
      const nPitch = typed > 0 && typeof mix === "number" && !Number.isNaN(mix) ? mix * typed : 0;
      const swings = nPitch > 0 && typeof sw === "number" && !Number.isNaN(sw) ? sw * nPitch : 0;
      if (swings > 0 && typeof wh === "number" && !Number.isNaN(wh)) {
        num += wh * swings;
        denom += swings;
      }
    }
    target[wk] = denom > 0 ? num / denom : undefined;
  }
  }

  for (const { ab, h } of PITCH_BUCKET_TERMINAL_AB_HITS) {
    let sumAb = 0;
    let sumH = 0;
    for (const line of lines) {
      const abV = line[ab];
      const hV = line[h];
      if (typeof abV === "number" && !Number.isNaN(abV)) sumAb += abV;
      if (typeof hV === "number" && !Number.isNaN(hV)) sumH += hV;
    }
    if (sumAb > 0) {
      target[ab] = sumAb;
      target[h] = sumH;
    } else {
      target[ab] = undefined;
      target[h] = undefined;
    }
  }
}
