/**
 * Discipline & BIP rates from pitches at a ball–strike count state.
 * `reachedCount`: every PA that saw a pitch at that count (profile + stats sheet discipline mode).
 * `finalCount`: only PAs that ended at that count (combined Runners + final-count filters).
 */

import {
  battingStatsFromPAs,
  fieldingErrorsByPlayerFromPas,
} from "@/lib/compute/battingStats";
import {
  distinctGameCount,
  gamesStartedInSplit,
  pasMatchFinalCount,
} from "@/lib/compute/battingStatsWithSplitsFromPas";
import type { BattingSheetColumnMode } from "@/components/analyst/battingStatsSheetModel";
import {
  paMatchesBattingPlatoonSplit,
  paMatchesPitchingPlatoonSplit,
  paMatchesStatsRunnersFilter,
  type BattingSheetSplitView,
  type PitchingSheetSplitView,
} from "@/lib/compute/statsSheetLiveFilters";
import { pitchOutcomeIsSwing } from "@/lib/compute/pitchSequence";
import type { ProfileBattingLine } from "@/lib/profileBattingDisplay";
import type {
  BattingFinalCountBucketKey,
  BattingStats,
  Bats,
  PitchEvent,
  PitchingRateLine,
  PitchingStats,
  PlateAppearance,
  Player,
  StatsRunnersFilterKey,
} from "@/lib/types";

export type CountStatePaQualification = "reachedCount" | "finalCount";

export type CountStateContactRates = {
  swingPct?: number;
  whiffPct?: number;
  foulPct?: number;
  gbPct?: number;
  ldPct?: number;
  fbPct?: number;
  iffPct?: number;
  /** Pitches at this count state ÷ qualifying PAs. */
  pPa?: number;
  /** Raw pitch / swing / BIP counts at this count (profile denominators). */
  pitches?: number;
  swings?: number;
  bipTyped?: number;
};

type ContactAgg = {
  pitches: number;
  swings: number;
  whiffs: number;
  fouls: number;
  bipTyped: number;
  gb: number;
  ld: number;
  fb: number;
  iff: number;
};

function mkAgg(): ContactAgg {
  return { pitches: 0, swings: 0, whiffs: 0, fouls: 0, bipTyped: 0, gb: 0, ld: 0, fb: 0, iff: 0 };
}

function countBipType(t: string | null | undefined, a: ContactAgg): void {
  if (!t) return;
  a.bipTyped += 1;
  if (t === "ground_ball") a.gb += 1;
  else if (t === "line_drive") a.ld += 1;
  else if (t === "fly_ball") a.fb += 1;
  else if (t === "infield_fly") a.iff += 1;
}

function aggToRates(a: ContactAgg, paN: number): CountStateContactRates {
  return {
    swingPct: a.pitches > 0 ? a.swings / a.pitches : undefined,
    whiffPct: a.swings > 0 ? a.whiffs / a.swings : undefined,
    foulPct: a.pitches > 0 ? a.fouls / a.pitches : undefined,
    gbPct: a.bipTyped > 0 ? a.gb / a.bipTyped : undefined,
    ldPct: a.bipTyped > 0 ? a.ld / a.bipTyped : undefined,
    fbPct: a.bipTyped > 0 ? a.fb / a.bipTyped : undefined,
    iffPct: a.bipTyped > 0 ? a.iff / a.bipTyped : undefined,
    pPa: paN > 0 ? a.pitches / paN : undefined,
    pitches: a.pitches,
    swings: a.swings,
    bipTyped: a.bipTyped,
  };
}

function parseCountBucket(bucket: BattingFinalCountBucketKey): [number, number] | null {
  const [ballsNeed, strikesNeed] = bucket.split("-").map((n) => Number(n));
  if (!Number.isFinite(ballsNeed) || !Number.isFinite(strikesNeed)) return null;
  return [ballsNeed, strikesNeed];
}

function paIdsWithPitchAtCount(
  pitchEvents: PitchEvent[],
  ballsNeed: number,
  strikesNeed: number
): Set<string> {
  const out = new Set<string>();
  for (const e of pitchEvents) {
    if (e.balls_before === ballsNeed && e.strikes_before === strikesNeed) {
      out.add(e.pa_id);
    }
  }
  return out;
}

/** Every PA starts at 0-0; other counts require a recorded pitch at that count. */
export function paQualifiesForReachedCountState(
  paId: string,
  ballsNeed: number,
  strikesNeed: number,
  paIdsWithPitchAtCount: Set<string>
): boolean {
  if (ballsNeed === 0 && strikesNeed === 0) return true;
  return paIdsWithPitchAtCount.has(paId);
}

function buildQualifyingPaMap(
  pas: PlateAppearance[],
  playerIds: Set<string>,
  matchPlayer: (pa: PlateAppearance) => boolean,
  splitView: BattingSheetSplitView | PitchingSheetSplitView,
  runnersFilter: StatsRunnersFilterKey,
  ballsNeed: number,
  strikesNeed: number,
  paQualification: CountStatePaQualification,
  pitchEvents: PitchEvent[] | undefined,
  batterBatsById?: Map<string, Bats | null | undefined>,
  pitchingSplit?: boolean
): { paById: Map<string, PlateAppearance>; paCountByEntity: Record<string, number> } {
  const paIdsAtCount =
    paQualification === "reachedCount" && pitchEvents?.length
      ? paIdsWithPitchAtCount(pitchEvents, ballsNeed, strikesNeed)
      : null;
  const paById = new Map<string, PlateAppearance>();
  const paCountByEntity: Record<string, number> = {};
  for (const pa of pas) {
    if (!matchPlayer(pa)) continue;
    const entityId = pitchingSplit ? pa.pitcher_id : pa.batter_id;
    if (!entityId || !playerIds.has(entityId)) continue;
    if (pitchingSplit) {
      if (
        !paMatchesPitchingPlatoonSplit(
          pa,
          splitView as PitchingSheetSplitView,
          batterBatsById ?? new Map()
        )
      ) {
        continue;
      }
    } else if (!paMatchesBattingPlatoonSplit(pa, splitView as BattingSheetSplitView)) {
      continue;
    }
    if (!paMatchesStatsRunnersFilter(pa, runnersFilter)) continue;
    if (paQualification === "finalCount") {
      if (!pasMatchFinalCount(pa, ballsNeed, strikesNeed)) continue;
    } else if (
      !paQualifiesForReachedCountState(pa.id, ballsNeed, strikesNeed, paIdsAtCount ?? new Set())
    ) {
      continue;
    }
    paById.set(pa.id, pa);
    paCountByEntity[entityId] = (paCountByEntity[entityId] ?? 0) + 1;
  }
  return { paById, paCountByEntity };
}

function aggregateCountStateContact(
  paById: Map<string, PlateAppearance>,
  paCountByEntity: Record<string, number>,
  pitchEvents: PitchEvent[],
  ballsNeed: number,
  strikesNeed: number,
  entityIdFromPa: (pa: PlateAppearance) => string
): Record<string, CountStateContactRates> {
  const aggByEntity: Record<string, ContactAgg> = {};
  for (const e of pitchEvents) {
    if (e.balls_before !== ballsNeed || e.strikes_before !== strikesNeed) continue;
    const pa = paById.get(e.pa_id);
    if (!pa) continue;
    const eid = entityIdFromPa(pa);
    const cur = aggByEntity[eid] ?? mkAgg();
    cur.pitches += 1;
    if (pitchOutcomeIsSwing(e.outcome)) cur.swings += 1;
    if (e.outcome === "swinging_strike") cur.whiffs += 1;
    if (e.outcome === "foul") cur.fouls += 1;
    if (e.outcome === "in_play") countBipType(pa.batted_ball_type, cur);
    aggByEntity[eid] = cur;
  }

  const out: Record<string, CountStateContactRates> = {};
  for (const eid of new Set([...Object.keys(paCountByEntity), ...Object.keys(aggByEntity)])) {
    const paN = paCountByEntity[eid] ?? 0;
    if (paN === 0) continue;
    const a = aggByEntity[eid] ?? mkAgg();
    out[eid] = aggToRates(a, paN);
  }
  return out;
}

export function countStatePaQualificationForRunnersFilter(
  runnersFilter: StatsRunnersFilterKey
): CountStatePaQualification {
  return runnersFilter !== "all" ? "finalCount" : "reachedCount";
}

export function buildCountStateContactByBatter(
  players: Player[],
  pas: PlateAppearance[] | undefined,
  pitchEvents: PitchEvent[] | undefined,
  splitView: BattingSheetSplitView,
  runnersFilter: StatsRunnersFilterKey,
  finalCountBucket: BattingFinalCountBucketKey | null,
  paQualification: CountStatePaQualification = "reachedCount"
): Record<string, CountStateContactRates> {
  if (!pas?.length || !pitchEvents?.length || !finalCountBucket) return {};
  const parsed = parseCountBucket(finalCountBucket);
  if (!parsed) return {};
  const [ballsNeed, strikesNeed] = parsed;
  const playerIds = new Set(players.map((p) => p.id));
  const { paById, paCountByEntity } = buildQualifyingPaMap(
    pas,
    playerIds,
    (pa) => playerIds.has(pa.batter_id),
    splitView,
    runnersFilter,
    ballsNeed,
    strikesNeed,
    paQualification,
    pitchEvents
  );
  return aggregateCountStateContact(paById, paCountByEntity, pitchEvents, ballsNeed, strikesNeed, (pa) => pa.batter_id);
}

export function buildCountStateContactByPitcher(
  players: Player[],
  pas: PlateAppearance[] | undefined,
  pitchEvents: PitchEvent[] | undefined,
  splitView: PitchingSheetSplitView,
  runnersFilter: StatsRunnersFilterKey,
  finalCountBucket: BattingFinalCountBucketKey | null,
  batterBatsById: Record<string, Bats | null | undefined> | undefined,
  paQualification: CountStatePaQualification = "reachedCount"
): Record<string, CountStateContactRates> {
  if (!pas?.length || !pitchEvents?.length || !finalCountBucket) return {};
  const parsed = parseCountBucket(finalCountBucket);
  if (!parsed) return {};
  const [ballsNeed, strikesNeed] = parsed;
  const playerIds = new Set(players.map((p) => p.id));
  const batsMap = new Map(Object.entries(batterBatsById ?? {}));
  const { paById, paCountByEntity } = buildQualifyingPaMap(
    pas,
    playerIds,
    (pa) => !!pa.pitcher_id && playerIds.has(pa.pitcher_id),
    splitView,
    runnersFilter,
    ballsNeed,
    strikesNeed,
    paQualification,
    pitchEvents,
    batsMap,
    true
  );
  return aggregateCountStateContact(paById, paCountByEntity, pitchEvents, ballsNeed, strikesNeed, (pa) => pa.pitcher_id!);
}

function countRunsForPlayer(pasList: PlateAppearance[], playerId: string): number {
  return pasList.reduce(
    (sum, pa) => sum + (pa.runs_scored_player_ids?.filter((id) => id === playerId).length ?? 0),
    0
  );
}

/** PA-level batting line for PAs that saw at least one pitch at the count state. */
export function battingStatsForCountStateReached(
  playerId: string,
  pas: PlateAppearance[],
  pitchEvents: PitchEvent[],
  splitView: BattingSheetSplitView,
  runnersFilter: StatsRunnersFilterKey,
  countBucket: BattingFinalCountBucketKey,
  startedGames: Set<string> = new Set()
): BattingStats | undefined {
  const parsed = parseCountBucket(countBucket);
  if (!parsed) return undefined;
  const [ballsNeed, strikesNeed] = parsed;
  const paIdsAtCount = paIdsWithPitchAtCount(pitchEvents, ballsNeed, strikesNeed);
  const sub = pas.filter(
    (pa) =>
      pa.batter_id === playerId &&
      paQualifiesForReachedCountState(pa.id, ballsNeed, strikesNeed, paIdsAtCount) &&
      paMatchesBattingPlatoonSplit(pa, splitView) &&
      paMatchesStatsRunnersFilter(pa, runnersFilter)
  );
  if (sub.length === 0) return undefined;

  const st = battingStatsFromPAs(sub);
  if (!st) return undefined;

  st.r = countRunsForPlayer(sub, playerId);
  st.gp = distinctGameCount(sub);
  st.gs = gamesStartedInSplit(startedGames, sub);
  st.e = fieldingErrorsByPlayerFromPas(sub)[playerId] ?? 0;
  return st;
}

/** Profile + stats sheet: PA/K% from reached PAs; Sw% / Whiff% / BIP% from every pitch at that count. */
export function buildBattingDisciplineLineAtCountState(
  playerId: string,
  pas: PlateAppearance[] | undefined,
  pitchEvents: PitchEvent[] | undefined,
  splitView: BattingSheetSplitView,
  runnersFilter: StatsRunnersFilterKey,
  countBucket: BattingFinalCountBucketKey,
  startedGames: Set<string> = new Set()
): ProfileBattingLine | undefined {
  if (!pas?.length || !pitchEvents?.length) return undefined;
  const base = battingStatsForCountStateReached(
    playerId,
    pas,
    pitchEvents,
    splitView,
    runnersFilter,
    countBucket,
    startedGames
  );
  if (!base) return undefined;
  const paQualification = countStatePaQualificationForRunnersFilter(runnersFilter);
  const contact = buildCountStateContactByBatter(
    [{ id: playerId, name: "" } as Player],
    pas,
    pitchEvents,
    splitView,
    runnersFilter,
    countBucket,
    paQualification
  )[playerId];
  const line = applyCountStateContactToBattingStats(base, contact);
  return {
    ...line,
    countStatePitches: contact?.pitches,
  };
}

const BATTING_CONTACT_KEYS: (keyof BattingStats)[] = [
  "swingPct",
  "whiffPct",
  "foulPct",
  "gbPct",
  "ldPct",
  "fbPct",
  "iffPct",
  "pPa",
];

export function clearBattingPaLevelContact(stats: BattingStats): BattingStats {
  const out = { ...stats };
  for (const k of BATTING_CONTACT_KEYS) {
    delete out[k];
  }
  return out;
}

export function applyCountStateContactToBattingStats(
  stats: BattingStats,
  contact: CountStateContactRates | undefined
): BattingStats {
  const base = clearBattingPaLevelContact(stats);
  if (!contact) return base;
  return {
    ...base,
    ...(contact.swingPct != null ? { swingPct: contact.swingPct } : {}),
    ...(contact.whiffPct != null ? { whiffPct: contact.whiffPct } : {}),
    ...(contact.foulPct != null ? { foulPct: contact.foulPct } : {}),
    ...(contact.gbPct != null ? { gbPct: contact.gbPct } : {}),
    ...(contact.ldPct != null ? { ldPct: contact.ldPct } : {}),
    ...(contact.fbPct != null ? { fbPct: contact.fbPct } : {}),
    ...(contact.iffPct != null ? { iffPct: contact.iffPct } : {}),
    ...(contact.pPa != null ? { pPa: contact.pPa } : {}),
  };
}

const PITCHING_CONTACT_RATE_KEYS: (keyof PitchingRateLine)[] = [
  "swingPct",
  "whiffPct",
  "foulPct",
  "gbPct",
  "ldPct",
  "fbPct",
  "iffPct",
  "pPa",
];

export function applyCountStateContactToPitchingStats(
  stats: PitchingStats,
  contact: CountStateContactRates | undefined
): PitchingStats {
  const rates = { ...stats.rates };
  for (const k of PITCHING_CONTACT_RATE_KEYS) {
    delete rates[k];
  }
  if (contact) {
    if (contact.swingPct != null) rates.swingPct = contact.swingPct;
    if (contact.whiffPct != null) rates.whiffPct = contact.whiffPct;
    if (contact.foulPct != null) rates.foulPct = contact.foulPct;
    if (contact.gbPct != null) rates.gbPct = contact.gbPct;
    if (contact.ldPct != null) rates.ldPct = contact.ldPct;
    if (contact.fbPct != null) rates.fbPct = contact.fbPct;
    if (contact.iffPct != null) rates.iffPct = contact.iffPct;
    if (contact.pPa != null) rates.pPa = contact.pPa;
  }
  return { ...stats, rates };
}

/** Overlay count-state discipline rates onto an existing batting line (season / split rows). */
export function battingLineWithCountStateContact(
  line: BattingStats | undefined,
  playerId: string,
  pas: PlateAppearance[] | undefined,
  pitchEvents: PitchEvent[] | undefined,
  splitView: BattingSheetSplitView,
  runnersFilter: StatsRunnersFilterKey,
  finalCountBucket: BattingFinalCountBucketKey | null,
  columnMode: BattingSheetColumnMode
): BattingStats | undefined {
  if (!line || columnMode !== "contact" || !finalCountBucket || !pas?.length || !pitchEvents?.length) {
    return line;
  }
  const map = buildCountStateContactByBatter(
    [{ id: playerId, name: "" } as Player],
    pas,
    pitchEvents,
    splitView,
    runnersFilter,
    finalCountBucket,
    countStatePaQualificationForRunnersFilter(runnersFilter)
  );
  return applyCountStateContactToBattingStats(line, map[playerId]);
}

export function pitchingLineWithCountStateContact(
  line: PitchingStats | undefined,
  pitcherId: string,
  pas: PlateAppearance[] | undefined,
  pitchEvents: PitchEvent[] | undefined,
  splitView: PitchingSheetSplitView,
  runnersFilter: StatsRunnersFilterKey,
  finalCountBucket: BattingFinalCountBucketKey | null,
  batterBatsById: Record<string, Bats | null | undefined> | undefined,
  columnMode: "standard" | "contact"
): PitchingStats | undefined {
  if (!line || columnMode !== "contact" || !finalCountBucket || !pas?.length || !pitchEvents?.length) {
    return line;
  }
  const map = buildCountStateContactByPitcher(
    [{ id: pitcherId, name: "" } as Player],
    pas,
    pitchEvents,
    splitView,
    runnersFilter,
    finalCountBucket,
    batterBatsById,
    countStatePaQualificationForRunnersFilter(runnersFilter)
  );
  return applyCountStateContactToPitchingStats(line, map[pitcherId]);
}
