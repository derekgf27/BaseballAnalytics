/**
 * Pitch-type usage and discipline from `pitch_events.pitch_type` (pitcher / mound view).
 * Batting stat lines intentionally omit these fields — use the pitching stat sheet for mix by type.
 */

import {
  pitchOutcomeIsSwing,
  pitchOutcomeStrikesThrownIncrement,
} from "@/lib/compute/pitchSequence";
import { PITCH_TRACKER_TYPES } from "@/lib/pitchTrackerUi";
import type {
  PAResult,
  PitchEvent,
  PitchingRateLine,
  PitchTypeBucketCounts,
  PitchTypeBucketKey,
  PitchTypeBucketProfile,
  PitchTrackerPitchType,
  PlateAppearance,
} from "@/lib/types";

export type { PitchTypeBucketKey } from "@/lib/types";

/** PAs that do not count as an at-bat against the pitcher (mirrors `atBatsAgainst` exclusions). */
const PA_NON_AB_RESULTS = new Set<PAResult>(["bb", "ibb", "hbp", "sac_fly", "sac", "sac_bunt"]);

const PA_HIT_RESULTS = new Set<PAResult>(["single", "double", "triple", "hr"]);

function paCountsAsAtBatAgainst(pa: PlateAppearance): boolean {
  return !PA_NON_AB_RESULTS.has(pa.result);
}

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

function emptyBucketCounts(): PitchTypeBucketCounts {
  return {
    n: 0,
    balls: 0,
    calledStrikes: 0,
    swingingStrikes: 0,
    fouls: 0,
    swings: 0,
    whiffs: 0,
    strikesThrown: 0,
    twoStrikePitches: 0,
    twoStrikeSwings: 0,
    twoStrikeWhiffs: 0,
    aheadPitches: 0,
    behindPitches: 0,
    evenPitches: 0,
    firstPitch: 0,
    paEnds: 0,
    terminalAb: 0,
    terminalH: 0,
    terminalSo: 0,
    terminalBb: 0,
    terminalIbb: 0,
    terminalHbp: 0,
    terminalHr: 0,
    terminal2b: 0,
    terminal3b: 0,
    terminalSingle: 0,
    terminalBip: 0,
    terminalGb: 0,
    terminalLd: 0,
    terminalFb: 0,
    terminalIff: 0,
  };
}

function totalBasesFromTerminal(c: PitchTypeBucketCounts): number {
  return c.terminalSingle + 2 * c.terminal2b + 3 * c.terminal3b + 4 * c.terminalHr;
}

function bucketRatesFromCounts(
  c: PitchTypeBucketCounts,
  typedTotal: number,
  totalFirstPitch: number,
  totalAhead: number,
  totalBehind: number,
  totalEven: number,
  totalPaEnds: number
): PitchTypeBucketProfile {
  const profile: PitchTypeBucketProfile = { pitches: c.n };
  if (c.n <= 0) return profile;

  profile.mix = c.n / typedTotal;
  if (totalFirstPitch > 0 && c.firstPitch > 0) profile.firstPitchMix = c.firstPitch / totalFirstPitch;
  if (totalAhead > 0 && c.aheadPitches > 0) profile.mixAhead = c.aheadPitches / totalAhead;
  if (totalBehind > 0 && c.behindPitches > 0) profile.mixBehind = c.behindPitches / totalBehind;
  if (totalEven > 0 && c.evenPitches > 0) profile.mixEven = c.evenPitches / totalEven;

  profile.strikePct = c.strikesThrown / c.n;
  profile.ballPct = c.balls / c.n;
  profile.calledStrikePct = c.calledStrikes / c.n;
  profile.foulPct = c.fouls / c.n;
  profile.swingPct = c.swings / c.n;
  if (c.swings > 0) {
    profile.whiffPct = c.whiffs / c.swings;
    profile.contactPct = (c.swings - c.whiffs) / c.swings;
  }
  if (c.twoStrikeSwings > 0) profile.twoStrikeWhiffPct = c.twoStrikeWhiffs / c.twoStrikeSwings;

  if (c.paEnds > 0) {
    profile.paEnds = c.paEnds;
    if (totalPaEnds > 0) profile.paEndPct = c.paEnds / totalPaEnds;
    const bbHbp = c.terminalBb + c.terminalIbb + c.terminalHbp;
    if (bbHbp > 0) profile.bbPct = bbHbp / c.paEnds;
  }

  const kDenom = c.terminalAb + c.terminalSo;
  if (kDenom > 0 && c.terminalSo > 0) profile.kPct = c.terminalSo / kDenom;

  if (c.terminalAb > 0) {
    profile.ab = c.terminalAb;
    profile.h = c.terminalH;
    profile.baa = c.terminalH / c.terminalAb;
    const xbh = c.terminalHr + c.terminal2b + c.terminal3b;
    if (xbh > 0) profile.xbhPct = xbh / c.terminalAb;
    if (c.terminalHr > 0) profile.hrPct = c.terminalHr / c.terminalAb;
    const tb = totalBasesFromTerminal(c);
    profile.slg = tb / c.terminalAb;
    profile.iso = (tb - c.terminalAb) / c.terminalAb;
  }

  if (c.terminalBip > 0) {
    profile.gbPct = c.terminalGb / c.terminalBip;
    profile.ldPct = c.terminalLd / c.terminalBip;
    profile.fbPct = c.terminalFb / c.terminalBip;
  }

  return profile;
}

function mergeBucketCounts(target: PitchTypeBucketCounts, add: PitchTypeBucketCounts): void {
  for (const key of Object.keys(target) as (keyof PitchTypeBucketCounts)[]) {
    target[key] += add[key];
  }
}

export function aggregatePitchTypeBucketCounts(
  pas: PlateAppearance[],
  eventsByPaId: Map<string, PitchEvent[]>
): {
  typedTotal: number;
  buckets: Record<PitchTypeBucketKey, PitchTypeBucketCounts>;
  totalFirstPitch: number;
  totalAhead: number;
  totalBehind: number;
  totalEven: number;
  totalPaEnds: number;
} {
  const buckets = {} as Record<PitchTypeBucketKey, PitchTypeBucketCounts>;
  for (const bucket of ALL_PITCH_STAT_BUCKETS) buckets[bucket] = emptyBucketCounts();

  let typedTotal = 0;
  let totalFirstPitch = 0;
  let totalAhead = 0;
  let totalBehind = 0;
  let totalEven = 0;
  let totalPaEnds = 0;

  for (const pa of pas) {
    const evs = eventsByPaId.get(pa.id) ?? [];
    for (const e of evs) {
      const b = normalizePitchTypeBucket(e.pitch_type);
      if (b == null) continue;
      typedTotal += 1;
      const box = buckets[b] ?? emptyBucketCounts();
      if (!buckets[b]) buckets[b] = box;
      box.n += 1;

      if (e.outcome === "ball") box.balls += 1;
      else if (e.outcome === "called_strike") box.calledStrikes += 1;
      else if (e.outcome === "swinging_strike") box.swingingStrikes += 1;
      else if (e.outcome === "foul") box.fouls += 1;
      box.strikesThrown += pitchOutcomeStrikesThrownIncrement(e.outcome);
      if (pitchOutcomeIsSwing(e.outcome)) {
        box.swings += 1;
        if (e.outcome === "swinging_strike") box.whiffs += 1;
      }
      if (e.strikes_before === 2) {
        box.twoStrikePitches += 1;
        if (pitchOutcomeIsSwing(e.outcome)) {
          box.twoStrikeSwings += 1;
          if (e.outcome === "swinging_strike") box.twoStrikeWhiffs += 1;
        }
      }
      if (e.strikes_before > e.balls_before) {
        box.aheadPitches += 1;
        totalAhead += 1;
      } else if (e.balls_before > e.strikes_before) {
        box.behindPitches += 1;
        totalBehind += 1;
      } else {
        box.evenPitches += 1;
        totalEven += 1;
      }
      if (e.pitch_index === 1) {
        box.firstPitch += 1;
        totalFirstPitch += 1;
      }
    }

    if (evs.length === 0) continue;
    const last = evs[evs.length - 1]!;
    const terminalBucket = normalizePitchTypeBucket(last.pitch_type);
    if (terminalBucket == null) continue;

    const cell = buckets[terminalBucket] ?? emptyBucketCounts();
    if (!buckets[terminalBucket]) buckets[terminalBucket] = cell;
    cell.paEnds += 1;
    totalPaEnds += 1;

    const result = pa.result;
    if (result === "so" || result === "so_looking") cell.terminalSo += 1;
    if (result === "bb") cell.terminalBb += 1;
    if (result === "ibb") cell.terminalIbb += 1;
    if (result === "hbp") cell.terminalHbp += 1;

    if (paCountsAsAtBatAgainst(pa)) {
      cell.terminalAb += 1;
      if (PA_HIT_RESULTS.has(result)) cell.terminalH += 1;
      if (result === "single") cell.terminalSingle += 1;
      else if (result === "double") cell.terminal2b += 1;
      else if (result === "triple") cell.terminal3b += 1;
      else if (result === "hr") cell.terminalHr += 1;
    }

    const bbt = pa.batted_ball_type;
    if (bbt) {
      cell.terminalBip += 1;
      if (bbt === "ground_ball") cell.terminalGb += 1;
      else if (bbt === "line_drive") cell.terminalLd += 1;
      else if (bbt === "fly_ball") cell.terminalFb += 1;
      else if (bbt === "infield_fly") cell.terminalIff += 1;
    }
  }

  return { typedTotal, buckets, totalFirstPitch, totalAhead, totalBehind, totalEven, totalPaEnds };
}

export function pitchTypeProfilesFromCounts(
  typedTotal: number,
  buckets: Record<PitchTypeBucketKey, PitchTypeBucketCounts>,
  totals: {
    totalFirstPitch: number;
    totalAhead: number;
    totalBehind: number;
    totalEven: number;
    totalPaEnds: number;
  }
): Partial<Record<PitchTypeBucketKey, PitchTypeBucketProfile>> {
  const out: Partial<Record<PitchTypeBucketKey, PitchTypeBucketProfile>> = {};
  if (typedTotal <= 0) return out;
  for (const bucket of ALL_PITCH_STAT_BUCKETS) {
    const c = buckets[bucket];
    if (c == null || c.n <= 0) continue;
    out[bucket] = bucketRatesFromCounts(
      c,
      typedTotal,
      totals.totalFirstPitch,
      totals.totalAhead,
      totals.totalBehind,
      totals.totalEven,
      totals.totalPaEnds
    );
  }
  return out;
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

/** Every bucket stats code may read (includes sweeper for legacy DB pitches; not on coach pad). */
const ALL_PITCH_STAT_BUCKETS: readonly PitchTypeBucketKey[] = [
  ...new Set([
    ...PITCH_BUCKET_TO_STATS.map((r) => r.bucket),
    ...PITCH_BUCKET_TERMINAL_AB_HITS.map((r) => r.bucket),
  ]),
];

export function aggregatePitchTypeBuckets(
  pas: PlateAppearance[],
  eventsByPaId: Map<string, PitchEvent[]>
): { typedTotal: number; buckets: Record<PitchTypeBucketKey, BucketAgg> } {
  const buckets = {} as Record<PitchTypeBucketKey, BucketAgg>;
  for (const bucket of ALL_PITCH_STAT_BUCKETS) buckets[bucket] = emptyBucket();

  let typedTotal = 0;

  for (const pa of pas) {
    const evs = eventsByPaId.get(pa.id) ?? [];
    for (const e of evs) {
      const b = normalizePitchTypeBucket(e.pitch_type);
      if (b == null) continue;
      typedTotal += 1;
      const box = buckets[b] ?? emptyBucket();
      if (!buckets[b]) buckets[b] = box;
      box.n += 1;
      if (pitchOutcomeIsSwing(e.outcome)) box.swings += 1;
      if (e.outcome === "swinging_strike") box.whiffs += 1;
    }
  }
  return { typedTotal, buckets };
}

function emptyTerminalTallies(): Record<PitchTypeBucketKey, { ab: number; h: number }> {
  const out = {} as Record<PitchTypeBucketKey, { ab: number; h: number }>;
  for (const bucket of ALL_PITCH_STAT_BUCKETS) out[bucket] = { ab: 0, h: 0 };
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
    const cell = tallies[b] ?? { ab: 0, h: 0 };
    if (!tallies[b]) tallies[b] = cell;
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
    const cell = tallies[bucket];
    if (cell == null) continue;
    const { ab: abN, h: hN } = cell;
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
    if (b == null) continue;
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
  const full = aggregatePitchTypeBucketCounts(pas, eventsByPaId);
  const legacyBuckets = {} as Record<PitchTypeBucketKey, BucketAgg>;
  for (const bucket of ALL_PITCH_STAT_BUCKETS) {
    const c = full.buckets[bucket];
    legacyBuckets[bucket] = c
      ? { n: c.n, swings: c.swings, whiffs: c.whiffs }
      : emptyBucket();
  }
  fillPitchLogTypeFields(full.typedTotal, legacyBuckets, rates);
  fillPitchTerminalAbHitFields(
    Object.fromEntries(
      ALL_PITCH_STAT_BUCKETS.map((bucket) => {
        const c = full.buckets[bucket] ?? emptyBucketCounts();
        return [bucket, { ab: c.terminalAb, h: c.terminalH }] as const;
      })
    ) as Record<PitchTypeBucketKey, { ab: number; h: number }>,
    rates
  );
  const countSnapshot = {} as Partial<Record<PitchTypeBucketKey, PitchTypeBucketCounts>>;
  for (const bucket of ALL_PITCH_STAT_BUCKETS) {
    const c = full.buckets[bucket];
    if (c != null && c.n > 0) countSnapshot[bucket] = { ...c };
  }
  rates.plBucketCounts = countSnapshot;
  rates.plBuckets = pitchTypeProfilesFromCounts(full.typedTotal, full.buckets, {
    totalFirstPitch: full.totalFirstPitch,
    totalAhead: full.totalAhead,
    totalBehind: full.totalBehind,
    totalEven: full.totalEven,
    totalPaEnds: full.totalPaEnds,
  });
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

  const rateTarget = target as unknown as PitchingRateLine;
  if (!lines.some((l) => (l as unknown as PitchingRateLine).plBucketCounts != null)) return;

  const mergedCounts = {} as Record<PitchTypeBucketKey, PitchTypeBucketCounts>;
  for (const bucket of ALL_PITCH_STAT_BUCKETS) mergedCounts[bucket] = emptyBucketCounts();

  for (const line of lines) {
    const counts = (line as unknown as PitchingRateLine).plBucketCounts;
    if (!counts) continue;
    for (const bucket of ALL_PITCH_STAT_BUCKETS) {
      const add = counts[bucket];
      if (!add || add.n <= 0) continue;
      mergeBucketCounts(mergedCounts[bucket]!, add);
    }
  }

  let totalFirstPitch = 0;
  let totalAhead = 0;
  let totalBehind = 0;
  let totalEven = 0;
  let totalPaEnds = 0;
  for (const bucket of ALL_PITCH_STAT_BUCKETS) {
    const c = mergedCounts[bucket]!;
    totalFirstPitch += c.firstPitch;
    totalAhead += c.aheadPitches;
    totalBehind += c.behindPitches;
    totalEven += c.evenPitches;
    totalPaEnds += c.paEnds;
  }

  if (plT > 0) {
    const countSnapshot = {} as Partial<Record<PitchTypeBucketKey, PitchTypeBucketCounts>>;
    for (const bucket of ALL_PITCH_STAT_BUCKETS) {
      const c = mergedCounts[bucket]!;
      if (c.n > 0) countSnapshot[bucket] = { ...c };
    }
    rateTarget.plBucketCounts = countSnapshot;
    rateTarget.plBuckets = pitchTypeProfilesFromCounts(plT, mergedCounts, {
      totalFirstPitch,
      totalAhead,
      totalBehind,
      totalEven,
      totalPaEnds,
    });
  }
}
