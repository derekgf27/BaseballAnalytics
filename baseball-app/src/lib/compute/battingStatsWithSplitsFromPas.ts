/**
 * Pure batting split aggregation from in-memory PAs (no DB / no next/headers).
 * Shared by server pages and client filters (e.g. Analyst → Stats matchup toolbar).
 */

import { isDemoId } from "@/lib/db/mockData";
import type { BattingStats, BattingStatsWithSplits, PlateAppearance } from "@/lib/types";
import { battingStatsFromPAs, isRisp } from "./battingStats";

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

/**
 * Compute batting stats with splits from an in-memory PA list (e.g. only opponent PAs vs your club).
 * Used for the Opponents detail stat sheet and Stats page matchup filters.
 */
export function computeBattingStatsWithSplitsFromPas(
  playerIds: string[],
  pas: PlateAppearance[],
  baserunningByPlayerId: Record<string, { sb: number; cs: number }>,
  startedGamesByPlayer: Map<string, Set<string>>
): Record<string, BattingStatsWithSplits> {
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

    const vsLStats = pasVsL.length > 0 ? battingStatsFromPAs(pasVsL) : null;
    if (vsLStats) {
      vsLStats.r = runsVsL[playerId] ?? 0;
      vsLStats.gp = distinctGameCount(pasVsL);
      vsLStats.gs = gamesStartedInSplit(startedGames, pasVsL);
    }

    const vsRStats = pasVsR.length > 0 ? battingStatsFromPAs(pasVsR) : null;
    if (vsRStats) {
      vsRStats.r = runsVsR[playerId] ?? 0;
      vsRStats.gp = distinctGameCount(pasVsR);
      vsRStats.gs = gamesStartedInSplit(startedGames, pasVsR);
    }

    const rispStats = pasRisp.length > 0 ? battingStatsFromPAs(pasRisp) : null;
    if (rispStats) {
      let runsRisp = 0;
      for (const pa of pasRisp) {
        runsRisp += (pa.runs_scored_player_ids ?? []).filter((id) => id === playerId).length;
      }
      rispStats.r = runsRisp;
      rispStats.gp = distinctGameCount(pasRisp);
      rispStats.gs = gamesStartedInSplit(startedGames, pasRisp);
    }

    result[playerId] = { overall, vsL: vsLStats, vsR: vsRStats, risp: rispStats };
  }
  return result;
}
