import {
  countAfterPitch,
  replayCountAtEndOfSequence,
  type PitchSequenceEntry,
} from "@/lib/compute/pitchSequence";
import type { PitchEvent, PitchOutcome, PitchTrackerLogResult, PitchTrackerPitch } from "@/lib/types";

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
      pitch_index: i + 1,
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
      pitch_index: i + 1,
      balls_before: 0,
      strikes_before: 0,
      outcome: o,
      pitch_type: row.pitch_type,
    });
  }
  return out;
}
