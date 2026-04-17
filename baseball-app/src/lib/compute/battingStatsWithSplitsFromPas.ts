/**
 * Pure batting split aggregation from in-memory PAs (no DB / no next/headers).
 * Shared by server pages and client filters (e.g. Analyst → Stats matchup toolbar).
 */

import { groupPitchEventsByPaId, mergeContactProfileIntoBattingStats } from "@/lib/compute/contactProfileFromPas";
import { isDemoId } from "@/lib/db/mockData";
import type {
  BattingFinalCountBucketKey,
  BattingRunnerSituationSplit,
  BattingStats,
  BattingStatsWithSplits,
  PitchEvent,
  PlateAppearance,
} from "@/lib/types";
import {
  battingStatsFromPAs,
  fieldingErrorsByPlayerFromPas,
  isBasesEmpty,
  isBasesLoaded,
  isRisp,
  isRunnersOn,
} from "./battingStats";

/** All distinct in-play ball–strike pairs before resolution (12 rows). */
export const FINAL_COUNT_PAIRS: readonly [number, number][] = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 0],
  [1, 1],
  [1, 2],
  [2, 0],
  [2, 1],
  [2, 2],
  [3, 0],
  [3, 1],
  [3, 2],
];

export function finalCountBucketKey(balls: number, strikes: number): BattingFinalCountBucketKey {
  return `${balls}-${strikes}` as BattingFinalCountBucketKey;
}

export function pasMatchFinalCount(pa: PlateAppearance, balls: number, strikes: number): boolean {
  if (pa.count_balls == null || pa.count_strikes == null) return false;
  const cb = Math.min(3, Math.max(0, pa.count_balls));
  const cs = Math.min(2, Math.max(0, pa.count_strikes));
  return cb === balls && cs === strikes;
}

function buildFinalCountMapForPasList(
  list: PlateAppearance[],
  playerId: string,
  startedGames: Set<string>,
  eventsByPaId: Map<string, PitchEvent[]>
): Partial<Record<BattingFinalCountBucketKey, BattingStats | null>> {
  const out: Partial<Record<BattingFinalCountBucketKey, BattingStats | null>> = {};
  for (const [b, s] of FINAL_COUNT_PAIRS) {
    const key = finalCountBucketKey(b, s);
    const sub = list.filter((pa) => pasMatchFinalCount(pa, b, s));
    if (sub.length === 0) {
      out[key] = null;
      continue;
    }
    const st = battingStatsFromPAs(sub);
    if (!st) {
      out[key] = null;
      continue;
    }
    let runs = 0;
    for (const pa of sub) {
      runs += (pa.runs_scored_player_ids ?? []).filter((id) => id === playerId).length;
    }
    st.r = runs;
    st.gp = distinctGameCount(sub);
    st.gs = gamesStartedInSplit(startedGames, sub);
    mergeContactProfileIntoBattingStats(st, sub, eventsByPaId);
    st.e = fieldingErrorsByPlayerFromPas(sub)[playerId] ?? 0;
    out[key] = st;
  }
  return out;
}

export function buildStatsByFinalCountForSplits(
  pasList: PlateAppearance[],
  pasVsL: PlateAppearance[],
  pasVsR: PlateAppearance[],
  pasRisp: PlateAppearance[],
  playerId: string,
  startedGames: Set<string>,
  eventsByPaId: Map<string, PitchEvent[]>
): NonNullable<BattingStatsWithSplits["statsByFinalCount"]> {
  return {
    overall: buildFinalCountMapForPasList(pasList, playerId, startedGames, eventsByPaId),
    vsL: buildFinalCountMapForPasList(pasVsL, playerId, startedGames, eventsByPaId),
    vsR: buildFinalCountMapForPasList(pasVsR, playerId, startedGames, eventsByPaId),
    risp: buildFinalCountMapForPasList(pasRisp, playerId, startedGames, eventsByPaId),
  };
}

/** Merge per-runner SB/CS into batting stats (legacy PA `stolen_bases` + event SB; CS and SB% from events). */
export function mergeBaserunningIntoBattingStats(stats: BattingStats, br: { sb: number; cs: number }): void {
  stats.sb = (stats.sb ?? 0) + br.sb;
  stats.cs = br.cs;
  const att = br.sb + br.cs;
  stats.sbPct = att > 0 ? br.sb / att : undefined;
}

export function distinctGameCount(pas: PlateAppearance[]): number {
  return new Set(pas.map((p) => p.game_id)).size;
}

/** Games in split where the player was in the game's starting lineup. */
export function gamesStartedInSplit(startedGames: Set<string>, pasInSplit: PlateAppearance[]): number {
  if (pasInSplit.length === 0) return 0;
  let n = 0;
  const games = new Set(pasInSplit.map((p) => p.game_id));
  for (const gid of games) {
    if (startedGames.has(gid)) n++;
  }
  return n;
}

function countRunsForPlayer(pasList: PlateAppearance[], playerId: string): number {
  return pasList.reduce(
    (sum, pa) => sum + (pa.runs_scored_player_ids?.filter((id) => id === playerId).length ?? 0),
    0
  );
}

/** One runner bucket: combined + vs LHP / vs RHP lines (no season SB/CS merge — same as platoon-only splits). */
export function buildBattingRunnerSituationSplit(
  list: PlateAppearance[],
  pred: (pa: PlateAppearance) => boolean,
  playerId: string,
  startedGames: Set<string>,
  eventsByPaId: Map<string, PitchEvent[]>,
  eN: number
): BattingRunnerSituationSplit {
  const sub = list.filter(pred);
  const pasVsL = sub.filter((pa) => pa.pitcher_hand === "L");
  const pasVsR = sub.filter((pa) => pa.pitcher_hand === "R");

  const combined = sub.length > 0 ? battingStatsFromPAs(sub) : null;
  if (combined) {
    combined.r = countRunsForPlayer(sub, playerId);
    combined.gp = distinctGameCount(sub);
    combined.gs = gamesStartedInSplit(startedGames, sub);
    mergeContactProfileIntoBattingStats(combined, sub, eventsByPaId);
    combined.e = eN;
  }

  const vsL = pasVsL.length > 0 ? battingStatsFromPAs(pasVsL) : null;
  if (vsL) {
    vsL.r = countRunsForPlayer(pasVsL, playerId);
    vsL.gp = distinctGameCount(pasVsL);
    vsL.gs = gamesStartedInSplit(startedGames, pasVsL);
    mergeContactProfileIntoBattingStats(vsL, pasVsL, eventsByPaId);
    vsL.e = eN;
  }

  const vsR = pasVsR.length > 0 ? battingStatsFromPAs(pasVsR) : null;
  if (vsR) {
    vsR.r = countRunsForPlayer(pasVsR, playerId);
    vsR.gp = distinctGameCount(pasVsR);
    vsR.gs = gamesStartedInSplit(startedGames, pasVsR);
    mergeContactProfileIntoBattingStats(vsR, pasVsR, eventsByPaId);
    vsR.e = eN;
  }

  return { combined, vsL, vsR };
}

/**
 * Compute batting stats with splits from an in-memory PA list (e.g. only opponent PAs vs your club).
 * Used for the Opponents detail stat sheet and Stats page matchup filters.
 */
export function computeBattingStatsWithSplitsFromPas(
  playerIds: string[],
  pas: PlateAppearance[],
  baserunningByPlayerId: Record<string, { sb: number; cs: number }>,
  startedGamesByPlayer: Map<string, Set<string>>,
  pitchEvents: PitchEvent[] = []
): Record<string, BattingStatsWithSplits> {
  const eventsByPaId = pitchEvents.length > 0 ? groupPitchEventsByPaId(pitchEvents) : new Map<string, PitchEvent[]>();
  const eByPlayer = fieldingErrorsByPlayerFromPas(pas);
  const byBatter = new Map<string, PlateAppearance[]>();
  for (const pa of pas) {
    if (!isDemoId(pa.batter_id)) {
      const list = byBatter.get(pa.batter_id) ?? [];
      list.push(pa);
      byBatter.set(pa.batter_id, list);
    }
  }

  function countRuns(pasList: PlateAppearance[], playerId: string): number {
    return pasList.reduce(
      (sum, pa) => sum + (pa.runs_scored_player_ids?.filter((id) => id === playerId).length ?? 0),
      0
    );
  }

  const runsByPlayer: Record<string, number> = {};
  const runsVsL: Record<string, number> = {};
  const runsVsR: Record<string, number> = {};
  for (const playerId of playerIds) {
    if (isDemoId(playerId)) continue;
    const list = byBatter.get(playerId) ?? [];
    runsByPlayer[playerId] = countRuns(list, playerId);
    runsVsL[playerId] = countRuns(
      list.filter((p) => p.pitcher_hand === "L"),
      playerId
    );
    runsVsR[playerId] = countRuns(
      list.filter((p) => p.pitcher_hand === "R"),
      playerId
    );
  }

  const result: Record<string, BattingStatsWithSplits> = {};
  for (const playerId of playerIds) {
    if (isDemoId(playerId)) continue;
    const list = byBatter.get(playerId) ?? [];
    const pasVsL = list.filter((pa) => pa.pitcher_hand === "L");
    const pasVsR = list.filter((pa) => pa.pitcher_hand === "R");
    const pasRisp = list.filter((pa) => isRisp(pa.base_state));

    const startedGames = startedGamesByPlayer.get(playerId) ?? new Set<string>();
    const br = baserunningByPlayerId[playerId] ?? { sb: 0, cs: 0 };

    let overall = battingStatsFromPAs(list);
    if (!overall) {
      overall = {
        avg: 0,
        obp: 0,
        slg: 0,
        ops: 0,
        opsPlus: 100,
        woba: 0,
        pa: 0,
        ab: 0,
        r: runsByPlayer[playerId] ?? 0,
        gp: 0,
        gs: startedGames.size,
      };
    }
    overall.r = runsByPlayer[playerId] ?? 0;
    if (br.sb > 0 || br.cs > 0) mergeBaserunningIntoBattingStats(overall, br);
    overall.gp = distinctGameCount(list);
    overall.gs = startedGames.size;
    mergeContactProfileIntoBattingStats(overall, list, eventsByPaId);
    const eN = eByPlayer[playerId] ?? 0;
    overall.e = eN;

    const vsLStats = pasVsL.length > 0 ? battingStatsFromPAs(pasVsL) : null;
    if (vsLStats) {
      vsLStats.r = runsVsL[playerId] ?? 0;
      vsLStats.gp = distinctGameCount(pasVsL);
      vsLStats.gs = gamesStartedInSplit(startedGames, pasVsL);
      mergeContactProfileIntoBattingStats(vsLStats, pasVsL, eventsByPaId);
      vsLStats.e = eN;
    }

    const vsRStats = pasVsR.length > 0 ? battingStatsFromPAs(pasVsR) : null;
    if (vsRStats) {
      vsRStats.r = runsVsR[playerId] ?? 0;
      vsRStats.gp = distinctGameCount(pasVsR);
      vsRStats.gs = gamesStartedInSplit(startedGames, pasVsR);
      mergeContactProfileIntoBattingStats(vsRStats, pasVsR, eventsByPaId);
      vsRStats.e = eN;
    }

    const runnerSituations = {
      basesEmpty: buildBattingRunnerSituationSplit(
        list,
        (pa) => isBasesEmpty(pa.base_state),
        playerId,
        startedGames,
        eventsByPaId,
        eN
      ),
      runnersOn: buildBattingRunnerSituationSplit(
        list,
        (pa) => isRunnersOn(pa.base_state),
        playerId,
        startedGames,
        eventsByPaId,
        eN
      ),
      risp: buildBattingRunnerSituationSplit(
        list,
        (pa) => isRisp(pa.base_state),
        playerId,
        startedGames,
        eventsByPaId,
        eN
      ),
      basesLoaded: buildBattingRunnerSituationSplit(
        list,
        (pa) => isBasesLoaded(pa.base_state),
        playerId,
        startedGames,
        eventsByPaId,
        eN
      ),
    };

    const rispStats = runnerSituations.risp.combined;

    result[playerId] = {
      overall,
      vsL: vsLStats,
      vsR: vsRStats,
      risp: rispStats,
      runnerSituations,
      statsByFinalCount: buildStatsByFinalCountForSplits(
        list,
        pasVsL,
        pasVsR,
        pasRisp,
        playerId,
        startedGames,
        eventsByPaId
      ),
    };
  }
  return result;
}
