import {

  battingStatsFromPAs,
  isBasesEmpty,
  isBasesLoaded,
  isRisp,
  isRunnersOn,
} from "@/lib/compute/battingStats";
import {
  buildBattingRunnerSituationSplit,
  buildStatsByFinalCountForSplits,
  mergeBaserunningIntoBattingStats,
  distinctGameCount,
  gamesStartedInSplit,
} from "@/lib/compute/battingStatsWithSplitsFromPas";
import { buildBattingStatsForVenue, gameOurSideByIdFromGames } from "@/lib/compute/gameVenueSplits";
import { groupPitchEventsByPaId, mergeContactProfileIntoBattingStats } from "@/lib/compute/contactProfileFromPas";
import { isDemoId } from "../../mockData";
import type { BattingStats, BattingStatsWithSplits, Game, PlateAppearance } from "@/lib/types";
import { PLATE_APPEARANCE_COLUMNS } from "../columns";
import { getSupabase, fetchFieldingErrorCountsForPlayers } from "../client";
import { getBaserunningTotalsForPlayerIds } from "../baserunning";
import { getPitchEventsForPaIds } from "../pitchEvents";

export async function getBattingStatsForPlayers(
  playerIds: string[]
): Promise<Record<string, BattingStats>> {
  const supabase = await getSupabase();
  if (!supabase || playerIds.length === 0) return {};
  const { data } = await supabase
    .from("plate_appearances")
    .select(PLATE_APPEARANCE_COLUMNS)
    .in("batter_id", playerIds);
  const allPAs = (data ?? []) as PlateAppearance[];
  const byBatter = new Map<string, PlateAppearance[]>();
  for (const pa of allPAs) {
    if (!isDemoId(pa.batter_id)) {
      const list = byBatter.get(pa.batter_id) ?? [];
      list.push(pa);
      byBatter.set(pa.batter_id, list);
    }
  }

  // Runs scored: fetch PAs where any of our players scored (in runs_scored_player_ids).
  let runsByPlayer: Record<string, number> = {};
  if (playerIds.length > 0) {
    const { data: pasWithRuns } = await supabase
      .from("plate_appearances")
      .select("runs_scored_player_ids")
      .overlaps("runs_scored_player_ids", playerIds);
    const list = (pasWithRuns ?? []) as { runs_scored_player_ids: string[] | null }[];
    for (const playerId of playerIds) {
      runsByPlayer[playerId] = list.reduce(
        (sum, pa) => sum + (pa.runs_scored_player_ids ?? []).filter((id) => id === playerId).length,
        0
      );
    }
  }

  const brTotals = await getBaserunningTotalsForPlayerIds(playerIds);

  const cleanIds = playerIds.filter((id) => !isDemoId(id));
  const eCounts = await fetchFieldingErrorCountsForPlayers(supabase, cleanIds);
  const { data: lineupRows } = await supabase
    .from("game_lineups")
    .select("game_id, player_id")
    .in("player_id", cleanIds);

  const startedByPlayer = new Map<string, Set<string>>();
  for (const row of lineupRows ?? []) {
    const r = row as { game_id: string; player_id: string };
    const set = startedByPlayer.get(r.player_id) ?? new Set<string>();
    set.add(r.game_id);
    startedByPlayer.set(r.player_id, set);
  }

  const emptyShell = (playerId: string, startedGames: Set<string>): BattingStats => ({
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
    gs: 0,
    e: eCounts[playerId] ?? 0,
  });

  const result: Record<string, BattingStats> = {};
  for (const playerId of playerIds) {
    if (isDemoId(playerId)) continue;
    const pas = byBatter.get(playerId) ?? [];
    const startedGames = startedByPlayer.get(playerId) ?? new Set<string>();
    let stats = battingStatsFromPAs(pas);
    const br = brTotals[playerId] ?? { sb: 0, cs: 0 };
    if (!stats && (br.sb > 0 || br.cs > 0)) stats = emptyShell(playerId, startedGames);
    if (stats) {
      stats.r = runsByPlayer[playerId] ?? 0;
      if (br.sb > 0 || br.cs > 0) mergeBaserunningIntoBattingStats(stats, br);
      stats.gp = distinctGameCount(pas);
      stats.gs = gamesStartedInSplit(startedGames, pas);
      stats.e = eCounts[playerId] ?? 0;
      result[playerId] = stats;
    }
  }
  return result;
}

export async function getTeamBattingStats(
  playerIds: string[]
): Promise<BattingStats | null> {
  const supabase = await getSupabase();
  if (!supabase || playerIds.length === 0) return null;
  const ids = playerIds.filter((id) => !isDemoId(id));
  if (ids.length === 0) return null;
  const { data } = await supabase
    .from("plate_appearances")
    .select(PLATE_APPEARANCE_COLUMNS)
    .in("batter_id", ids);
  const allPAs = (data ?? []) as PlateAppearance[];
  const brTotals = await getBaserunningTotalsForPlayerIds(ids);
  let teamSb = 0;
  let teamCs = 0;
  for (const id of ids) {
    teamSb += brTotals[id]?.sb ?? 0;
    teamCs += brTotals[id]?.cs ?? 0;
  }

  const eCountsTeam = await fetchFieldingErrorCountsForPlayers(supabase, ids);
  const teamFieldingE = ids.reduce((s, id) => s + (eCountsTeam[id] ?? 0), 0);

  if (allPAs.length === 0) {
    if (teamSb === 0 && teamCs === 0) return null;
    const shell: BattingStats = {
      avg: 0,
      obp: 0,
      slg: 0,
      ops: 0,
      opsPlus: 100,
      woba: 0,
      pa: 0,
      ab: 0,
      r: 0,
      e: teamFieldingE,
    };
    mergeBaserunningIntoBattingStats(shell, { sb: teamSb, cs: teamCs });
    return shell;
  }

  const teamRuns = allPAs.reduce(
    (sum, pa) => sum + (pa.runs_scored_player_ids?.length ?? 0),
    0
  );
  const stats = battingStatsFromPAs(allPAs);
  if (!stats) return null;
  stats.r = teamRuns;
  stats.e = teamFieldingE;
  if (teamSb > 0 || teamCs > 0) mergeBaserunningIntoBattingStats(stats, { sb: teamSb, cs: teamCs });
  return stats;
}

/** Team batting in RISP situations only (runners on 2nd and/or 3rd). P/PA uses pitch counts on those PAs. */

export async function getTeamBattingStatsRisp(
  playerIds: string[]
): Promise<BattingStats | null> {
  const supabase = await getSupabase();
  if (!supabase || playerIds.length === 0) return null;
  const ids = playerIds.filter((id) => !isDemoId(id));
  if (ids.length === 0) return null;
  const { data } = await supabase
    .from("plate_appearances")
    .select(PLATE_APPEARANCE_COLUMNS)
    .in("batter_id", ids);
  const allPAs = (data ?? []) as PlateAppearance[];
  const rispPAs = allPAs.filter((pa) => isRisp(pa.base_state));
  if (rispPAs.length === 0) return null;
  const teamRuns = rispPAs.reduce(
    (sum, pa) => sum + (pa.runs_scored_player_ids?.length ?? 0),
    0
  );
  const stats = battingStatsFromPAs(rispPAs);
  if (!stats) return null;
  stats.r = teamRuns;
  return stats;
}

/** Team-level pitching: all PAs where `pitcher_id` is on the roster; one aggregate line + total pitch count. */

export async function getBattingStatsWithSplitsForPlayers(
  playerIds: string[]
): Promise<Record<string, BattingStatsWithSplits>> {
  const supabase = await getSupabase();
  if (!supabase || playerIds.length === 0) return {};
  const { data } = await supabase
    .from("plate_appearances")
    .select(PLATE_APPEARANCE_COLUMNS)
    .in("batter_id", playerIds);
  const allPAs = (data ?? []) as PlateAppearance[];
  const byBatter = new Map<string, PlateAppearance[]>();
  for (const pa of allPAs) {
    if (!isDemoId(pa.batter_id)) {
      const list = byBatter.get(pa.batter_id) ?? [];
      list.push(pa);
      byBatter.set(pa.batter_id, list);
    }
  }

  // Runs overall
  let runsByPlayer: Record<string, number> = {};
  let runsVsL: Record<string, number> = {};
  let runsVsR: Record<string, number> = {};
  if (playerIds.length > 0) {
    const { data: pasWithRuns } = await supabase
      .from("plate_appearances")
      .select("pitcher_hand, runs_scored_player_ids")
      .overlaps("runs_scored_player_ids", playerIds);
    const list = (pasWithRuns ?? []) as { pitcher_hand: string | null; runs_scored_player_ids: string[] | null }[];
    for (const playerId of playerIds) {
      runsByPlayer[playerId] = 0;
      runsVsL[playerId] = 0;
      runsVsR[playerId] = 0;
    }
    for (const pa of list) {
      const ids = pa.runs_scored_player_ids ?? [];
      const hand = pa.pitcher_hand;
      for (const playerId of playerIds) {
        const count = ids.filter((id) => id === playerId).length;
        if (count === 0) continue;
        runsByPlayer[playerId] += count;
        if (hand === "L") runsVsL[playerId] += count;
        else if (hand === "R") runsVsR[playerId] += count;
      }
    }
  }

  const brTotals = await getBaserunningTotalsForPlayerIds(playerIds);

  const cleanIds = playerIds.filter((id) => !isDemoId(id));
  const { data: lineupRows } = await supabase
    .from("game_lineups")
    .select("game_id, player_id")
    .in("player_id", cleanIds);

  const startedByPlayer = new Map<string, Set<string>>();
  for (const row of lineupRows ?? []) {
    const r = row as { game_id: string; player_id: string };
    const set = startedByPlayer.get(r.player_id) ?? new Set<string>();
    set.add(r.game_id);
    startedByPlayer.set(r.player_id, set);
  }

  const eCountsSplits = await fetchFieldingErrorCountsForPlayers(supabase, cleanIds);

  const paStatIds = allPAs.map((p) => p.id).filter(Boolean) as string[];
  const pitchEventsAll = paStatIds.length > 0 ? await getPitchEventsForPaIds(paStatIds) : [];
  const eventsByPaId = groupPitchEventsByPaId(pitchEventsAll);

  const gameIds = [...new Set(allPAs.map((p) => p.game_id).filter(Boolean))] as string[];
  let gameOurSideById = new Map<string, "home" | "away">();
  if (gameIds.length > 0) {
    const { data: gameRows } = await supabase.from("games").select("id, our_side").in("id", gameIds);
    gameOurSideById = gameOurSideByIdFromGames((gameRows ?? []) as Pick<Game, "id" | "our_side">[]);
  }

  const result: Record<string, BattingStatsWithSplits> = {};
  for (const playerId of playerIds) {
    if (isDemoId(playerId)) continue;
    const eN = eCountsSplits[playerId] ?? 0;
    const pas = byBatter.get(playerId) ?? [];
    const pasVsL = pas.filter((pa) => pa.pitcher_hand === "L");
    const pasVsR = pas.filter((pa) => pa.pitcher_hand === "R");
    const pasRisp = pas.filter((pa) => isRisp(pa.base_state));

    const startedGames = startedByPlayer.get(playerId) ?? new Set<string>();

    const br = brTotals[playerId] ?? { sb: 0, cs: 0 };
    let overall = battingStatsFromPAs(pas);
    if (!overall && (br.sb > 0 || br.cs > 0)) {
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
        gs: 0,
        e: eN,
      };
    }
    if (!overall) continue;
    overall.r = runsByPlayer[playerId] ?? 0;
    if (br.sb > 0 || br.cs > 0) mergeBaserunningIntoBattingStats(overall, br);

    overall.gp = distinctGameCount(pas);
    overall.gs = gamesStartedInSplit(startedGames, pas);
    mergeContactProfileIntoBattingStats(overall, pas, eventsByPaId);
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
        pas,
        (pa) => isBasesEmpty(pa.base_state),
        playerId,
        startedGames,
        eventsByPaId,
        eN
      ),
      runnersOn: buildBattingRunnerSituationSplit(
        pas,
        (pa) => isRunnersOn(pa.base_state),
        playerId,
        startedGames,
        eventsByPaId,
        eN
      ),
      risp: buildBattingRunnerSituationSplit(
        pas,
        (pa) => isRisp(pa.base_state),
        playerId,
        startedGames,
        eventsByPaId,
        eN
      ),
      basesLoaded: buildBattingRunnerSituationSplit(
        pas,
        (pa) => isBasesLoaded(pa.base_state),
        playerId,
        startedGames,
        eventsByPaId,
        eN
      ),
    };
    const rispStats = runnerSituations.risp.combined;

    const homeStats =
      gameOurSideById.size > 0
        ? buildBattingStatsForVenue(pas, "home", gameOurSideById, playerId, startedGames, eventsByPaId, eN)
        : null;
    const awayStats =
      gameOurSideById.size > 0
        ? buildBattingStatsForVenue(pas, "away", gameOurSideById, playerId, startedGames, eventsByPaId, eN)
        : null;

    result[playerId] = {
      overall,
      vsL: vsLStats,
      vsR: vsRStats,
      home: homeStats,
      away: awayStats,
      risp: rispStats,
      runnerSituations,
      statsByFinalCount: buildStatsByFinalCountForSplits(
        pas,
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

