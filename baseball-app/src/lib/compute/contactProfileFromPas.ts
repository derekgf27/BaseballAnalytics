/**
 * Swing / whiff / foul (from pitch log) and batted-ball-type profile (from PA rows).
 * Sw% and Foul% use pitch count as denominator; Whiff% = swinging strikes ÷ swings.
 */

import {
  pitchOutcomeIsSwing,
  pitchOutcomeStrikesThrownIncrement,
} from "@/lib/compute/pitchSequence";
import { mergePitchTypeProfileIntoPitchingRates } from "@/lib/compute/pitchTypeProfileFromPas";
import type {
  BattingStats,
  PitchEvent,
  PitchOutcome,
  PitchingRateLine,
  PlateAppearance,
} from "@/lib/types";

/** In-memory pitch rows for the unsaved PA on Record PAs — merges with DB `PitchEvent[]` for live Sw%/Whiff% etc. */
export function pitchEventsFromDraftPitchLog(
  paId: string,
  rows: ReadonlyArray<{
    balls_before: number;
    strikes_before: number;
    outcome: PitchOutcome;
  }>
): PitchEvent[] {
  return rows.map((row, i) => ({
    id: `__draft_pe_${paId}_${i}`,
    pa_id: paId,
    pitch_index: i + 1,
    balls_before: row.balls_before,
    strikes_before: row.strikes_before,
    outcome: row.outcome,
    pitch_type: null,
  }));
}

export function groupPitchEventsByPaId(events: PitchEvent[]): Map<string, PitchEvent[]> {
  const m = new Map<string, PitchEvent[]>();
  for (const e of events) {
    const list = m.get(e.pa_id) ?? [];
    list.push(e);
    m.set(e.pa_id, list);
  }
  for (const [, list] of m) {
    list.sort((a, b) => a.pitch_index - b.pitch_index);
  }
  return m;
}

type ContactAgg = {
  pitchesLogged: number;
  swings: number;
  whiffs: number;
  fouls: number;
  bipTyped: number;
  gb: number;
  ld: number;
  fb: number;
  iff: number;
};

function aggregateContactFromPas(
  pas: PlateAppearance[],
  eventsByPaId: Map<string, PitchEvent[]>
): ContactAgg {
  let pitchesLogged = 0;
  let swings = 0;
  let whiffs = 0;
  let fouls = 0;
  let bipTyped = 0;
  let gb = 0;
  let ld = 0;
  let fb = 0;
  let iff = 0;

  for (const pa of pas) {
    const evs = eventsByPaId.get(pa.id) ?? [];
    if (evs.length > 0) {
      pitchesLogged += evs.length;
      for (const e of evs) {
        if (pitchOutcomeIsSwing(e.outcome)) swings += 1;
        if (e.outcome === "swinging_strike") whiffs += 1;
        if (e.outcome === "foul") fouls += 1;
      }
    }

    const t = pa.batted_ball_type;
    if (t) {
      bipTyped += 1;
      if (t === "ground_ball") gb += 1;
      else if (t === "line_drive") ld += 1;
      else if (t === "fly_ball") fb += 1;
      else if (t === "infield_fly") iff += 1;
    }
  }

  return { pitchesLogged, swings, whiffs, fouls, bipTyped, gb, ld, fb, iff };
}

/** Pitch-log + batted-ball counts for Pitch data UI (per pitcher or team). */
export type PitchMixExtrasAgg = {
  pitchesLogged: number;
  swings: number;
  whiffs: number;
  fouls: number;
  balls: number;
  calledStrikes: number;
  swingingStrikes: number;
  /** Sum of per-pitch strike increments (called/swinging/foul/in_play each +1; ball/HBP +0). */
  strikesThrown: number;
  bipTyped: number;
  gb: number;
  ld: number;
  fb: number;
  iff: number;
};

export function aggregatePitchMixExtrasFromPas(
  pas: PlateAppearance[],
  eventsByPaId: Map<string, PitchEvent[]>
): PitchMixExtrasAgg {
  let pitchesLogged = 0;
  let swings = 0;
  let whiffs = 0;
  let fouls = 0;
  let balls = 0;
  let calledStrikes = 0;
  let swingingStrikes = 0;
  let strikesThrown = 0;
  let bipTyped = 0;
  let gb = 0;
  let ld = 0;
  let fb = 0;
  let iff = 0;

  for (const pa of pas) {
    const evs = eventsByPaId.get(pa.id) ?? [];
    if (evs.length > 0) {
      pitchesLogged += evs.length;
      for (const e of evs) {
        if (e.outcome === "ball") balls += 1;
        else if (e.outcome === "called_strike") calledStrikes += 1;
        else if (e.outcome === "swinging_strike") swingingStrikes += 1;
        strikesThrown += pitchOutcomeStrikesThrownIncrement(e.outcome);

        if (pitchOutcomeIsSwing(e.outcome)) swings += 1;
        if (e.outcome === "swinging_strike") whiffs += 1;
        if (e.outcome === "foul") fouls += 1;
      }
    }

    const t = pa.batted_ball_type;
    if (t) {
      bipTyped += 1;
      if (t === "ground_ball") gb += 1;
      else if (t === "line_drive") ld += 1;
      else if (t === "fly_ball") fb += 1;
      else if (t === "infield_fly") iff += 1;
    }
  }

  return {
    pitchesLogged,
    swings,
    whiffs,
    fouls,
    balls,
    calledStrikes,
    swingingStrikes,
    strikesThrown,
    bipTyped,
    gb,
    ld,
    fb,
    iff,
  };
}

/**
 * Pitches thrown when the count already had 2 strikes (`strikes_before === 2`), e.g. 0-2 through 3-2.
 * Sw% / Foul% use those pitches as denominator; Whiff% = swinging strikes ÷ swings in that sample.
 */
export type TwoStrikePitchAgg = {
  pitchesAtTwoStrikes: number;
  swingsAtTwoStrikes: number;
  whiffsAtTwoStrikes: number;
  foulsAtTwoStrikes: number;
};

export function aggregateTwoStrikePitchAggFromPas(
  pas: PlateAppearance[],
  eventsByPaId: Map<string, PitchEvent[]>
): TwoStrikePitchAgg {
  let pitchesAtTwoStrikes = 0;
  let swingsAtTwoStrikes = 0;
  let whiffsAtTwoStrikes = 0;
  let foulsAtTwoStrikes = 0;

  for (const pa of pas) {
    const evs = eventsByPaId.get(pa.id) ?? [];
    for (const e of evs) {
      if (e.strikes_before !== 2) continue;
      pitchesAtTwoStrikes += 1;
      if (pitchOutcomeIsSwing(e.outcome)) swingsAtTwoStrikes += 1;
      if (e.outcome === "swinging_strike") whiffsAtTwoStrikes += 1;
      if (e.outcome === "foul") foulsAtTwoStrikes += 1;
    }
  }

  return {
    pitchesAtTwoStrikes,
    swingsAtTwoStrikes,
    whiffsAtTwoStrikes,
    foulsAtTwoStrikes,
  };
}

/** Attach optional Sw%, Whiff%, Foul%, GB/LD/FB/IFF% when sample exists. */
export function mergeContactProfileIntoBattingStats(
  stats: BattingStats,
  pas: PlateAppearance[],
  eventsByPaId: Map<string, PitchEvent[]>
): void {
  const a = aggregateContactFromPas(pas, eventsByPaId);
  if (a.pitchesLogged > 0) {
    stats.swingPct = a.swings / a.pitchesLogged;
    stats.foulPct = a.fouls / a.pitchesLogged;
  }
  if (a.swings > 0) {
    stats.whiffPct = a.whiffs / a.swings;
  }
  if (a.bipTyped > 0) {
    stats.gbPct = a.gb / a.bipTyped;
    stats.ldPct = a.ld / a.bipTyped;
    stats.fbPct = a.fb / a.bipTyped;
    stats.iffPct = a.iff / a.bipTyped;
  }
}

export function mergeContactProfileIntoPitchingRates(
  rates: PitchingRateLine,
  pas: PlateAppearance[],
  eventsByPaId: Map<string, PitchEvent[]>
): void {
  const a = aggregateContactFromPas(pas, eventsByPaId);
  if (a.pitchesLogged > 0) {
    rates.swingPct = a.swings / a.pitchesLogged;
    rates.foulPct = a.fouls / a.pitchesLogged;
  }
  if (a.swings > 0) {
    rates.whiffPct = a.whiffs / a.swings;
  }
  if (a.bipTyped > 0) {
    rates.gbPct = a.gb / a.bipTyped;
    rates.ldPct = a.ld / a.bipTyped;
    rates.fbPct = a.fb / a.bipTyped;
    rates.iffPct = a.iff / a.bipTyped;
  }
  mergePitchTypeProfileIntoPitchingRates(rates, pas, eventsByPaId);
}
