import {
  countAfterPitch,
  replayCountAtEndOfSequence,
  type PitchSequenceEntry,
} from "@/lib/compute/pitchSequence";
import type { PitchOutcome } from "@/lib/types";
import type { PitchTrackerLogResult } from "@/lib/types";

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
