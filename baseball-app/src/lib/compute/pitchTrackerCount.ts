import {
  countAfterPitch,
  replayCountAtEndOfSequence,
  type PitchSequenceEntry,
} from "@/lib/compute/pitchSequence";
import type { PitchEvent, PitchOutcome, PitchTrackerLogResult, PitchTrackerPitch, PlateAppearance } from "@/lib/types";

/** Synthetic PA id for in-progress coach tracker pitches (merged into matchup cards before Record saves). */
export const COACH_LIVE_AB_PA_ID = "__coach_live_ab__";

function mapTrackerResultToOutcome(r: PitchTrackerLogResult): PitchOutcome {
  switch (r) {
    case "ball":
      return "ball";
    case "called_strike":
      return "called_strike";
    case "swinging_strike":
      return "swinging_strike";
    case "foul":
      return "foul";
    case "in_play":
      return "in_play";
    default: {
      const _ex: never = r;
      return _ex;
    }
  }
}

/** Build pitch-log-style entries from tracker rows that already have a `result`. */
export function pitchTrackerRowsToSequenceEntries(
  rows: { pitch_number: number; result: PitchTrackerLogResult | null }[]
): PitchSequenceEntry[] {
  const sorted = [...rows]
    .filter((r): r is typeof r & { result: PitchTrackerLogResult } => r.result != null)
    .sort((a, b) => a.pitch_number - b.pitch_number);
  let b = 0;
  let s = 0;
  const entries: PitchSequenceEntry[] = [];
  for (const row of sorted) {
    const o = mapTrackerResultToOutcome(row.result);
    entries.push({ balls_before: b, strikes_before: s, outcome: o });
    const next = countAfterPitch(b, s, o);
    b = next.balls;
    s = next.strikes;
  }
  return entries;
}

/** Balls/strikes for coach top bar from resolved pitches only (pending pitches omitted). */
export function displayCountFromPitchTrackerRows(
  rows: { pitch_number: number; result: PitchTrackerLogResult | null }[]
): { balls: number; strikes: number } {
  const entries = pitchTrackerRowsToSequenceEntries(rows);
  if (entries.length === 0) return { balls: 0, strikes: 0 };
  const { balls, strikes } = replayCountAtEndOfSequence(entries);
  return {
    balls: Math.min(3, balls),
    strikes: strikes >= 3 ? 2 : Math.min(2, strikes),
  };
}

/** Pitch log rows for Sw% / pitch-type mix while the AB is still open on the coach pad. */
export function pitchEventsFromCoachTrackerRows(paId: string, rows: PitchTrackerPitch[]): PitchEvent[] {
  const sorted = [...rows]
    .filter((r): r is PitchTrackerPitch & { result: PitchTrackerLogResult } => r.result != null)
    .sort((a, b) => a.pitch_number - b.pitch_number);
  let b = 0;
  let s = 0;
  const out: PitchEvent[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]!;
    const o = mapTrackerResultToOutcome(row.result);
    out.push({
      id: `__coach_pe_${paId}_${row.pitch_number}`,
      pa_id: paId,
      pitch_index: row.pitch_number,
      balls_before: b,
      strikes_before: s,
      outcome: o,
      pitch_type: row.pitch_type != null ? row.pitch_type : null,
    });
    const next = countAfterPitch(b, s, o);
    b = next.balls;
    s = next.strikes;
  }
  return out;
}

/**
 * One `PitchEvent` per coach row that has a `pitch_type`, including rows still waiting on Record for
 * ball/strike (`result` null). Use **only** for pitch-type mix counts — not for strike% / Sw% / 2-strike
 * blocks (those should use {@link pitchEventsFromCoachTrackerRows} with resolved outcomes only).
 */
export function pitchTypeMixEventsFromCoachTrackerRows(paId: string, rows: PitchTrackerPitch[]): PitchEvent[] {
  const sorted = [...rows]
    .filter((r) => r.pitch_type != null)
    .sort((a, b) => a.pitch_number - b.pitch_number);
  const out: PitchEvent[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]!;
    const o =
      row.result != null ? mapTrackerResultToOutcome(row.result) : ("ball" as PitchOutcome);
    out.push({
      id: `__coach_mix_pe_${paId}_${row.pitch_number}`,
      pa_id: paId,
      pitch_index: row.pitch_number,
      balls_before: 0,
      strikes_before: 0,
      outcome: o,
      pitch_type: row.pitch_type,
    });
  }
  return out;
}

function enrichPitchTypesFromTrackerRows(
  events: PitchEvent[],
  paId: string,
  rows: PitchTrackerPitch[]
): PitchEvent[] {
  if (rows.length === 0) return events;
  const rowsByNum = new Map(rows.map((r) => [r.pitch_number, r]));
  return events.map((e) => {
    if (e.pa_id !== paId || e.pitch_type) return e;
    const row = rowsByNum.get(e.pitch_index);
    if (!row?.pitch_type) return e;
    return { ...e, pitch_type: row.pitch_type };
  });
}

function supplementRateEventsFromTrackerRows(
  events: PitchEvent[],
  paId: string,
  rows: PitchTrackerPitch[]
): PitchEvent[] {
  if (rows.length === 0) return events;
  const hasPaEvents = events.some((e) => e.pa_id === paId);
  if (hasPaEvents) return events;
  const fromTracker = pitchEventsFromCoachTrackerRows(paId, rows);
  return fromTracker.length > 0 ? [...events, ...fromTracker] : events;
}

function buildDistributionEventsForPa(
  rateEvents: PitchEvent[],
  paId: string,
  rows: PitchTrackerPitch[]
): PitchEvent[] {
  if (rows.length === 0) return rateEvents.filter((e) => e.pa_id === paId);
  let dist = enrichPitchTypesFromTrackerRows(rateEvents, paId, rows);
  for (const mix of pitchTypeMixEventsFromCoachTrackerRows(paId, rows)) {
    const idx = dist.findIndex((e) => e.pa_id === paId && e.pitch_index === mix.pitch_index);
    if (idx >= 0) {
      if (!dist[idx]!.pitch_type && mix.pitch_type) {
        dist = dist.map((e, i) => (i === idx ? { ...e, pitch_type: mix.pitch_type } : e));
      }
    } else if (mix.pitch_type) {
      dist = [...dist, mix];
    }
  }
  return dist;
}

/** Merge linked coach `pitches` rows into pitch-log arrays used by Record / box score pitch mix. */
export function mergeTrackerPitchesIntoPitchEvents(
  pitchEvents: PitchEvent[],
  trackerPitches: PitchTrackerPitch[],
  live?: { paId: string; rows: PitchTrackerPitch[] }
): { pitchEvents: PitchEvent[]; distributionPitchEvents: PitchEvent[] } {
  const byPa = new Map<string, PitchTrackerPitch[]>();
  for (const row of trackerPitches) {
    if (!row.at_bat_id) continue;
    const arr = byPa.get(row.at_bat_id) ?? [];
    arr.push(row);
    byPa.set(row.at_bat_id, arr);
  }

  let rateEvents = [...pitchEvents];
  for (const [paId, rows] of byPa) {
    rateEvents = enrichPitchTypesFromTrackerRows(rateEvents, paId, rows);
    rateEvents = supplementRateEventsFromTrackerRows(rateEvents, paId, rows);
  }

  if (live && live.rows.length > 0) {
    rateEvents = enrichPitchTypesFromTrackerRows(rateEvents, live.paId, live.rows);
    rateEvents = supplementRateEventsFromTrackerRows(rateEvents, live.paId, live.rows);
  }

  const paIds = new Set<string>([...byPa.keys(), ...(live ? [live.paId] : [])]);
  let distributionPitchEvents = [...rateEvents];
  for (const paId of paIds) {
    const linked = byPa.get(paId) ?? [];
    const rows = paId === live?.paId ? [...linked, ...live.rows] : linked;
    if (rows.length === 0) continue;
    const paDist = buildDistributionEventsForPa(rateEvents, paId, rows);
    const other = distributionPitchEvents.filter((e) => e.pa_id !== paId);
    distributionPitchEvents = [...other, ...paDist];
  }

  return { pitchEvents: rateEvents, distributionPitchEvents };
}

/** Synthetic PA for in-progress coach tracker rows on Record (before PA save). */
export function recordLiveTrackerSyntheticPa(
  gameId: string,
  batterId: string,
  pitcherId: string | null,
  inning: number,
  inningHalf: "top" | "bottom",
  paId: string
): PlateAppearance {
  return {
    id: paId,
    game_id: gameId,
    batter_id: batterId,
    inning,
    outs: 0,
    base_state: "000",
    score_diff: 0,
    count_balls: 0,
    count_strikes: 0,
    result: "other",
    contact_quality: null,
    hit_direction: null,
    batted_ball_type: null,
    pitches_seen: null,
    strikes_thrown: null,
    first_pitch_strike: null,
    rbi: 0,
    runs_scored_player_ids: [],
    unearned_runs_scored_player_ids: [],
    pitcher_hand: null,
    pitcher_id: pitcherId,
    notes: null,
    inning_half: inningHalf,
  };
}
