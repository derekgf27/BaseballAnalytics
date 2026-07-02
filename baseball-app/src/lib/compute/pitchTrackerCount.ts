import {
  countAfterPitch,
  replayCountAtEndOfSequence,
  resultImpliesBattedBallInPlay,
  summarizePitchSequence,
  withInferredTerminalOutcomePitches,
  type PitchSequenceEntry,
} from "@/lib/compute/pitchSequence";
import type {
  PAResult,
  PitchEvent,
  PitchOutcome,
  PitchTrackerLogResult,
  PitchTrackerPitch,
  PlateAppearance,
} from "@/lib/types";

export type RecordDraftPitchSequenceSummary = ReturnType<typeof summarizePitchSequence>;

/**
 * Pitch-log entries for the open AB: analyst pad rows first, else coach rows with a logged result.
 */
export function recordDraftPitchSequenceEntries(
  draftLog: PitchSequenceEntry[],
  coachRows: ReadonlyArray<{ pitch_number: number; result: PitchTrackerLogResult | null }>
): PitchSequenceEntry[] {
  if (draftLog.length > 0) return draftLog;
  const coachResolved = coachRows.filter(
    (r): r is typeof r & { result: PitchTrackerLogResult } => r.result != null
  );
  if (coachResolved.length > 0) return pitchTrackerRowsToSequenceEntries(coachResolved);
  return [];
}

/**
 * Full sequence for Record display/save: logged pitches + inferred terminal BIP / walk / HBP pitch.
 * When outcome is ROE (or any BIP) with no log, synthesizes one `in_play` pitch so the counter shows 1.
 */
export function recordDraftPitchSequenceWithTerminal(
  draftLog: PitchSequenceEntry[],
  coachRows: ReadonlyArray<{ pitch_number: number; result: PitchTrackerLogResult | null }>,
  result: PAResult | null
): PitchSequenceEntry[] {
  const entries = recordDraftPitchSequenceEntries(draftLog, coachRows);
  const withTerminal = withInferredTerminalOutcomePitches(entries, result);
  if (withTerminal.length > 0) return withTerminal;
  if (result != null && resultImpliesBattedBallInPlay(result)) {
    return [{ balls_before: 0, strikes_before: 0, outcome: "in_play" }];
  }
  if (result === "bb" || result === "ibb") {
    return [{ balls_before: 0, strikes_before: 0, outcome: "ball" }];
  }
  if (result === "hbp") {
    return [{ balls_before: 0, strikes_before: 0, outcome: "hbp" }];
  }
  return [];
}

export function recordDraftPitchSequenceSummary(
  draftLog: PitchSequenceEntry[],
  coachRows: ReadonlyArray<{ pitch_number: number; result: PitchTrackerLogResult | null }>,
  result: PAResult | null
): RecordDraftPitchSequenceSummary | null {
  const sequence = recordDraftPitchSequenceWithTerminal(draftLog, coachRows, result);
  if (sequence.length === 0) return null;
  return summarizePitchSequence(sequence);
}

/** Synthetic PA id for in-progress coach tracker pitches (merged into matchup cards before Record saves). */
export const COACH_LIVE_AB_PA_ID = "__coach_live_ab__";

/** Coach `pitch_number` is global within a tracker group; sort rows for the current AB. */
export function sortCoachPitchRowsForAb(rows: PitchTrackerPitch[]): PitchTrackerPitch[] {
  return [...rows].sort((a, b) => a.pitch_number - b.pitch_number);
}

/** Map 1-based pitch index within the AB → coach tracker row (not raw `pitch_number`). */
export function coachPitchRowByAbIndex(rows: PitchTrackerPitch[]): Map<number, PitchTrackerPitch> {
  const sorted = sortCoachPitchRowsForAb(rows);
  const m = new Map<number, PitchTrackerPitch>();
  sorted.forEach((row, i) => m.set(i + 1, row));
  return m;
}

/** Next pitch # in this tracker session (all rows in the group, not per batter). */
export function nextOpenPitchNumberInGroup(
  rows: ReadonlyArray<Pick<PitchTrackerPitch, "pitch_number">>
): number {
  const occupied = new Set(rows.map((r) => r.pitch_number));
  let n = 1;
  while (occupied.has(n)) n += 1;
  return n;
}

/**
 * Align coach pitch types to a pitch-log sequence by AB-relative index.
 * Inferred terminal rows (BIP `in_play`, walk 4th ball, HBP) inherit the prior pitch type when
 * the coach pad has no extra row for them.
 */
export function mapCoachPitchTypesToSequence(
  sequence: PitchSequenceEntry[],
  coachRows: PitchTrackerPitch[]
): (PitchTrackerPitch["pitch_type"])[] {
  const sorted = sortCoachPitchRowsForAb(coachRows);
  const types: (PitchTrackerPitch["pitch_type"])[] = [];
  let lastTyped: PitchTrackerPitch["pitch_type"] = null;
  for (let i = 0; i < sequence.length; i++) {
    const entry = sequence[i]!;
    let t = sorted[i]?.pitch_type ?? null;
    if (t == null && i > 0) {
      const prev = sequence[i - 1]!;
      const inferredTerminal =
        (entry.outcome === "in_play" && prev.outcome !== "in_play") ||
        (entry.outcome === "ball" && entry.balls_before === 3 && prev.outcome !== "ball") ||
        (entry.outcome === "hbp" && prev.outcome !== "hbp");
      if (inferredTerminal) {
        t = sorted[i - 1]?.pitch_type ?? lastTyped;
      }
    }
    if (t != null) lastTyped = t;
    types.push(t);
  }
  return types;
}

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

function enrichPitchTypesFromTrackerRows(
  events: PitchEvent[],
  paId: string,
  rows: PitchTrackerPitch[]
): PitchEvent[] {
  if (rows.length === 0) return events;
  const sorted = sortCoachPitchRowsForAb(rows);
  const types = mapCoachPitchTypesToSequence(
    events
      .filter((e) => e.pa_id === paId)
      .sort((a, b) => a.pitch_index - b.pitch_index)
      .map((e) => ({
        balls_before: e.balls_before,
        strikes_before: e.strikes_before,
        outcome: e.outcome,
      })),
    rows
  );
  return events.map((e) => {
    if (e.pa_id !== paId || e.pitch_type) return e;
    const t = types[e.pitch_index - 1] ?? sorted[e.pitch_index - 1]?.pitch_type ?? null;
    if (!t) return e;
    return { ...e, pitch_type: t };
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
