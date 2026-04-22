import type { PAResult, PitchOutcome, PitchTrackerLogResult } from "@/lib/types";

/** PA results that imply a batted ball (final pitch is inferred `in_play` when using pitch log). */
const BATTED_BALL_IN_PLAY_RESULTS = new Set<PAResult>([
  "single",
  "double",
  "triple",
  "hr",
  "out",
  "gidp",
  "fielders_choice",
  "sac",
  "sac_fly",
  "sac_bunt",
  "reached_on_error",
]);

export function resultImpliesBattedBallInPlay(result: PAResult): boolean {
  return BATTED_BALL_IN_PLAY_RESULTS.has(result);
}

/** One pitch in a draft or stored sequence (no DB id). */
export type PitchSequenceEntry = {
  balls_before: number;
  strikes_before: number;
  outcome: PitchOutcome;
};

/** True if the batter swung (incl. foul, BIP). */
export function pitchOutcomeIsSwing(outcome: PitchOutcome): boolean {
  return (
    outcome === "swinging_strike" ||
    outcome === "foul" ||
    outcome === "in_play"
  );
}

/**
 * True if this pitch cannot follow the current count in the log.
 * A 4th ball (walk) must be recorded via PA result, not another ball.
 * At 2 strikes, **called** and **swinging** stay available for the putaway (third) strike; fouls stay allowed.
 * Blocks a **second** called/swinging in a row both at 2 strikes (duplicate putaway).
 */
export function isPitchOutcomeBlockedByFullCount(
  balls: number,
  strikes: number,
  outcome: PitchOutcome,
  lastPitch: PitchSequenceEntry | null = null
): boolean {
  if (outcome === "ball" && balls >= 3) return true;
  if (outcome === "called_strike" || outcome === "swinging_strike") {
    if (strikes < 2) return false;
    if (
      lastPitch != null &&
      (lastPitch.outcome === "called_strike" || lastPitch.outcome === "swinging_strike") &&
      lastPitch.strikes_before === 2
    ) {
      return true;
    }
    return false;
  }
  return false;
}

/** For SO validation: log includes the third strike as called or swinging (at a 2-strike count). */
export function hasPutawayStrikeAtTwoStrikes(entries: PitchSequenceEntry[]): boolean {
  return entries.some(
    (e) =>
      e.strikes_before === 2 &&
      (e.outcome === "called_strike" || e.outcome === "swinging_strike")
  );
}

/** Strikes thrown tally for PA row: balls/called/swinging/foul/in_play/hbp as in app types comment (fouls count even at 2 strikes). */
export function pitchOutcomeStrikesThrownIncrement(outcome: PitchOutcome): number {
  switch (outcome) {
    case "ball":
      return 0;
    case "called_strike":
    case "swinging_strike":
    case "foul":
    case "in_play":
      return 1;
    case "hbp":
      return 0;
    default: {
      const _exhaustive: never = outcome;
      return _exhaustive;
    }
  }
}

/**
 * Count progression after one pitch (for replay + UI).
 * Foul with 2 strikes does not add a strike; ball 4 caps at 3 balls.
 * Called/swinging at 2 strikes advances to **3** in the UI so the sequence shows e.g. 0-2 → putaway → **0-3** (stored PA still clamps strikes to 2 for the DB).
 */
export function countAfterPitch(
  balls: number,
  strikes: number,
  outcome: PitchOutcome
): { balls: number; strikes: number } {
  let b = balls;
  let s = strikes;
  switch (outcome) {
    case "ball":
      b = Math.min(3, b + 1);
      break;
    case "called_strike":
    case "swinging_strike":
      if (s < 2) s += 1;
      else if (s === 2) s = 3;
      break;
    case "foul":
      if (s < 2) s += 1;
      break;
    case "in_play":
    case "hbp":
      break;
    default: {
      const _exhaustive: never = outcome;
      return _exhaustive;
    }
  }
  return { balls: b, strikes: s };
}

/** Count after replaying the full sequence from 0-0. */
export function replayCountAtEndOfSequence(entries: PitchSequenceEntry[]): { balls: number; strikes: number } {
  let b = 0;
  let s = 0;
  for (const row of entries) {
    const next = countAfterPitch(b, s, row.outcome);
    b = next.balls;
    s = next.strikes;
  }
  return { balls: b, strikes: s };
}

/**
 * Coach pitch pad: once Record has logged a terminal pitch count for this AB, block another pitch type
 * until Undo / Reset AB. Matches tracker rules: 3 strikes (incl. putaway → 3 in UI) or 4 balls.
 */
export function coachPitchCountBlocksNewPitchType(
  pitches: { pitch_number: number; result: PitchTrackerLogResult | null }[]
): boolean {
  return coachPitchCountNewPitchTypeBlockReason(pitches) != null;
}

/** Why new coach pitch types are blocked, if at all. */
export function coachPitchCountNewPitchTypeBlockReason(
  pitches: { pitch_number: number; result: PitchTrackerLogResult | null }[]
): "strikes" | "balls" | null {
  const withResult = pitches
    .filter((p): p is typeof p & { result: PitchTrackerLogResult } => p.result != null)
    .sort((a, b) => a.pitch_number - b.pitch_number);
  if (withResult.length === 0) return null;
  const entries: PitchSequenceEntry[] = withResult.map((p) => ({
    balls_before: 0,
    strikes_before: 0,
    outcome: p.result as PitchOutcome,
  }));
  const end = replayCountAtEndOfSequence(entries);
  if (end.strikes >= 3) return "strikes";
  const ballPitches = withResult.filter((p) => p.result === "ball").length;
  if (ballPitches >= 4) return "balls";
  return null;
}

/** Derive pitches_seen, strikes_thrown, first_pitch_strike, final count from a full sequence. */
export function summarizePitchSequence(entries: PitchSequenceEntry[]): {
  pitches_seen: number;
  strikes_thrown: number;
  first_pitch_strike: boolean | null;
  finalBalls: number;
  finalStrikes: number;
} {
  if (entries.length === 0) {
    return {
      pitches_seen: 0,
      strikes_thrown: 0,
      first_pitch_strike: null,
      finalBalls: 0,
      finalStrikes: 0,
    };
  }
  let strikesThrown = 0;
  for (const row of entries) {
    strikesThrown += pitchOutcomeStrikesThrownIncrement(row.outcome);
  }
  const { balls: b, strikes: s } = replayCountAtEndOfSequence(entries);
  const first = entries[0]!.outcome;
  const first_pitch_strike: boolean | null =
    first === "ball" || first === "hbp"
      ? false
      : first === "called_strike" ||
          first === "swinging_strike" ||
          first === "foul" ||
          first === "in_play"
        ? true
        : null;
  return {
    pitches_seen: entries.length,
    strikes_thrown: strikesThrown,
    first_pitch_strike,
    finalBalls: b,
    finalStrikes: s,
  };
}

/**
 * When the PA ends on a batted ball, append one synthetic `in_play` pitch at the current count
 * (unless the last logged pitch is already `in_play`). Empty log unchanged.
 */
export function withInferredInPlayPitch(
  entries: PitchSequenceEntry[],
  result: PAResult | null
): PitchSequenceEntry[] {
  if (entries.length === 0 || result === null || !resultImpliesBattedBallInPlay(result)) {
    return entries;
  }
  const last = entries[entries.length - 1]!;
  if (last.outcome === "in_play") return entries;
  const { balls, strikes } = replayCountAtEndOfSequence(entries);
  return [...entries, { balls_before: balls, strikes_before: strikes, outcome: "in_play" }];
}
