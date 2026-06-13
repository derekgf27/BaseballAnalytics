import { groupPitchEventsByPaId } from "@/lib/compute/contactProfileFromPas";
import {

  buildPitchingRunnerSituationsForPitcher,
  buildPitchingStatsByFinalCountForSplits,
  inheritedRunnersBequeathedTeamTotal,
  inheritedRunnersScoredInPasList,
  pitchingStatsFromPAs,
  platoonPitchingPasSplits,
} from "@/lib/compute/pitchingStats";
import { buildPitchingStatsForVenue, gameOurSideByIdFromGames } from "@/lib/compute/gameVenueSplits";
import { isGameFinalized } from "@/lib/gameRecord";
import { isDemoId } from "../../mockData";
import type { Bats, Game, PitchingRateLine, PitchingStats, PitchingStatsWithSplits, PitchingRunnerSituationSplit, PlateAppearance } from "@/lib/types";
import { GAME_COLUMNS, PLATE_APPEARANCE_COLUMNS } from "../columns";
import { getSupabase, fetchFieldingErrorCountsForPlayers } from "../client";
import { getPitchEventsForPaIds } from "../pitchEvents";
import { getPlateAppearancesByGame } from "../plateAppearances";
import type { PitcherOfficialTotals } from "../types";

export async function getPitcherOfficialTotalsForPlayers(
  playerIds: string[],
  options?: { calendarYear?: number | null }
): Promise<Record<string, PitcherOfficialTotals>> {
  const blank = (): PitcherOfficialTotals => ({ wins: 0, losses: 0, saves: 0 });
  const clean = [
    ...new Set(
      playerIds
        .filter((id) => typeof id === "string" && id.trim() && !isDemoId(id.trim()))
        .map((id) => id.trim())
    ),
  ];
  const out: Record<string, PitcherOfficialTotals> = {};
  for (const id of clean) out[id] = blank();

  const supabase = await getSupabase();
  if (!supabase || clean.length === 0) return out;

  let q = supabase
    .from("games")
    .select("id, date, winning_pitcher_id, losing_pitcher_id, save_pitcher_id, final_score_home, final_score_away")
    .not("final_score_home", "is", null)
    .not("final_score_away", "is", null);

  const y = options?.calendarYear;
  if (y != null && Number.isFinite(y)) {
    q = q.gte("date", `${y}-01-01`).lte("date", `${y}-12-31`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const g = row as Game;
    if (isDemoId(g.id)) continue;
    const wId = g.winning_pitcher_id?.trim() || null;
    const lId = g.losing_pitcher_id?.trim() || null;
    const sId = g.save_pitcher_id?.trim() || null;
    if (wId && out[wId] != null) out[wId].wins += 1;
    if (lId && out[lId] != null) out[lId].losses += 1;
    if (sId && out[sId] != null) out[sId].saves += 1;
  }

  return out;
}

/** Pitching stats: PAs where `pitcher_id` matches; GS = listed SP on `games` only when ≥1 PA exists for that game. */

export async function getPitchingStatsForPlayers(
  playerIds: string[],
  options?: { excludeGameId?: string | null }
): Promise<Record<string, PitchingStatsWithSplits>> {
  const supabase = await getSupabase();
  if (!supabase || playerIds.length === 0) return {};
  const clean = playerIds.filter((id) => !isDemoId(id));
  if (clean.length === 0) return {};

  const excludeGid = options?.excludeGameId?.trim() || null;

  const { data: pasRows } = await supabase.from("plate_appearances").select(PLATE_APPEARANCE_COLUMNS).in("pitcher_id", clean);
  const byPitcher = new Map<string, PlateAppearance[]>();
  const batterIds = new Set<string>();
  for (const pa of pasRows ?? []) {
    const p = pa as PlateAppearance;
    if (!p.pitcher_id) continue;
    if (excludeGid && p.game_id === excludeGid) continue;
    const list = byPitcher.get(p.pitcher_id) ?? [];
    list.push(p);
    byPitcher.set(p.pitcher_id, list);
    if (p.batter_id) batterIds.add(p.batter_id);
  }

  const gameIds = [
    ...new Set(
      (pasRows ?? [])
        .map((row) => (row as PlateAppearance).game_id)
        .filter((gid): gid is string => typeof gid === "string" && gid.length > 0)
    ),
  ];
  let allPasForGames: PlateAppearance[] = (pasRows ?? []) as PlateAppearance[];
  if (gameIds.length > 0) {
    const { data: gamePas } = await supabase.from("plate_appearances").select(PLATE_APPEARANCE_COLUMNS).in("game_id", gameIds);
    allPasForGames = (gamePas ?? []) as PlateAppearance[];
  }
  if (excludeGid) {
    allPasForGames = allPasForGames.filter((p) => p.game_id !== excludeGid);
  }

  const batterBatsById = new Map<string, Bats | null>();
  if (batterIds.size > 0) {
    const { data: batterRows } = await supabase.from("players").select("id, bats").in("id", [...batterIds]);
    for (const row of batterRows ?? []) {
      const r = row as { id: string; bats: string | null };
      batterBatsById.set(r.id, (r.bats as Bats | null) ?? null);
    }
  }

  const [homeStarters, awayStarters] = await Promise.all([
    supabase.from("games").select("id, starting_pitcher_home_id").in("starting_pitcher_home_id", clean),
    supabase.from("games").select("id, starting_pitcher_away_id").in("starting_pitcher_away_id", clean),
  ]);

  const starterGames = new Map<string, Set<string>>();
  for (const id of clean) starterGames.set(id, new Set<string>());
  for (const row of homeStarters.data ?? []) {
    const r = row as { id: string; starting_pitcher_home_id: string | null };
    if (r.starting_pitcher_home_id) {
      starterGames.get(r.starting_pitcher_home_id)?.add(r.id);
    }
  }
  for (const row of awayStarters.data ?? []) {
    const r = row as { id: string; starting_pitcher_away_id: string | null };
    if (r.starting_pitcher_away_id) {
      starterGames.get(r.starting_pitcher_away_id)?.add(r.id);
    }
  }

  const { data: savePitcherRows } = await supabase
    .from("games")
    .select("id, save_pitcher_id")
    .in("save_pitcher_id", clean)
    .not("final_score_home", "is", null)
    .not("final_score_away", "is", null);
  const officialSavesByPlayer = new Map<string, number>();
  for (const id of clean) officialSavesByPlayer.set(id, 0);
  for (const row of savePitcherRows ?? []) {
    const r = row as { id: string; save_pitcher_id: string | null };
    if (excludeGid && r.id === excludeGid) continue;
    const pid = r.save_pitcher_id;
    if (!pid) continue;
    officialSavesByPlayer.set(pid, (officialSavesByPlayer.get(pid) ?? 0) + 1);
  }

  const { data: winPitcherRows } = await supabase
    .from("games")
    .select("id, winning_pitcher_id")
    .in("winning_pitcher_id", clean)
    .not("final_score_home", "is", null)
    .not("final_score_away", "is", null);
  const officialWinsByPlayer = new Map<string, number>();
  for (const id of clean) officialWinsByPlayer.set(id, 0);
  for (const row of winPitcherRows ?? []) {
    const r = row as { id: string; winning_pitcher_id: string | null };
    if (excludeGid && r.id === excludeGid) continue;
    const pid = r.winning_pitcher_id;
    if (!pid) continue;
    officialWinsByPlayer.set(pid, (officialWinsByPlayer.get(pid) ?? 0) + 1);
  }

  const { data: lossPitcherRows } = await supabase
    .from("games")
    .select("id, losing_pitcher_id")
    .in("losing_pitcher_id", clean)
    .not("final_score_home", "is", null)
    .not("final_score_away", "is", null);
  const officialLossesByPlayer = new Map<string, number>();
  for (const id of clean) officialLossesByPlayer.set(id, 0);
  for (const row of lossPitcherRows ?? []) {
    const r = row as { id: string; losing_pitcher_id: string | null };
    if (excludeGid && r.id === excludeGid) continue;
    const pid = r.losing_pitcher_id;
    if (!pid) continue;
    officialLossesByPlayer.set(pid, (officialLossesByPlayer.get(pid) ?? 0) + 1);
  }

  const result: Record<string, PitchingStatsWithSplits> = {};
  const paPitchIds = (pasRows ?? [])
    .map((row) => (row as PlateAppearance).id)
    .filter(Boolean) as string[];
  const pitchEventsPitching =
    paPitchIds.length > 0 ? await getPitchEventsForPaIds(paPitchIds) : [];
  const eventsByPaIdPitching = groupPitchEventsByPaId(pitchEventsPitching);
  const eCountsPitch = await fetchFieldingErrorCountsForPlayers(supabase, clean);

  const { data: gameSideRows } =
    gameIds.length > 0
      ? await supabase
          .from("games")
          .select(
            "id, our_side, winning_pitcher_id, losing_pitcher_id, save_pitcher_id, final_score_home, final_score_away"
          )
          .in("id", gameIds)
      : { data: [] };
  const gameOurSideById = gameOurSideByIdFromGames((gameSideRows ?? []) as Pick<Game, "id" | "our_side">[]);
  const gamesForVenueDecisions = (gameSideRows ?? []) as Game[];

  for (const playerId of clean) {
    const pas = byPitcher.get(playerId) ?? [];
    const starters = starterGames.get(playerId) ?? new Set<string>();
    const { pasL, pasR } = platoonPitchingPasSplits(pas, batterBatsById);
    const stats = pitchingStatsFromPAs(pas, starters, batterBatsById, eventsByPaIdPitching, {
      allPasForRunCharges: allPasForGames,
      officialSaves: officialSavesByPlayer.get(playerId) ?? 0,
      officialWins: officialWinsByPlayer.get(playerId) ?? 0,
      officialLosses: officialLossesByPlayer.get(playerId) ?? 0,
    });
    const base = stats ?? EMPTY_PITCHING_STATS_WITH_SPLITS();
    const eN = eCountsPitch[playerId] ?? 0;
    base.overall.e = eN;
    if (base.vsLHB) base.vsLHB.e = eN;
    if (base.vsRHB) base.vsRHB.e = eN;
    const home =
      gameOurSideById.size > 0
        ? buildPitchingStatsForVenue(
            pas,
            "home",
            gameOurSideById,
            playerId,
            starters,
            batterBatsById,
            eventsByPaIdPitching,
            allPasForGames,
            gamesForVenueDecisions
          )
        : null;
    const away =
      gameOurSideById.size > 0
        ? buildPitchingStatsForVenue(
            pas,
            "away",
            gameOurSideById,
            playerId,
            starters,
            batterBatsById,
            eventsByPaIdPitching,
            allPasForGames,
            gamesForVenueDecisions
          )
        : null;
    if (home) home.e = eN;
    if (away) away.e = eN;
    result[playerId] = {
      ...base,
      home,
      away,
      runnerSituations: buildPitchingRunnerSituationsForPitcher(
        pas,
        starters,
        batterBatsById,
        eventsByPaIdPitching,
        playerId,
        allPasForGames
      ),
      statsByFinalCount: buildPitchingStatsByFinalCountForSplits(
        pas,
        pasL,
        pasR,
        starters,
        batterBatsById,
        eventsByPaIdPitching,
        { allPasForRunCharges: allPasForGames }
      ),
    };
  }
  return result;
}

/**
 * Pitching line for this pitcher on PAs where the batter was on our club’s side in that game
 * (`game_lineups.side === games.our_side`). Games without a saved lineup for our side contribute no PAs.
 */

export async function getPitchingStatsForPitcherVsOurClub(
  pitcherId: string
): Promise<PitchingStats | null> {
  const supabase = await getSupabase();
  if (!supabase || !pitcherId || isDemoId(pitcherId)) return null;

  const { data: pasRows } = await supabase
    .from("plate_appearances")
    .select(PLATE_APPEARANCE_COLUMNS)
    .eq("pitcher_id", pitcherId);
  const allPitcherPas = (pasRows ?? []) as PlateAppearance[];
  if (allPitcherPas.length === 0) return null;

  const gameIds = [...new Set(allPitcherPas.map((p) => p.game_id).filter(Boolean))] as string[];
  const [gamesRes, lineupRes] = await Promise.all([
    supabase.from("games").select("id, our_side").in("id", gameIds),
    supabase.from("game_lineups").select("game_id, player_id, side").in("game_id", gameIds),
  ]);

  const gameOurSide = new Map<string, "home" | "away">();
  for (const row of gamesRes.data ?? []) {
    const g = row as Game;
    gameOurSide.set(g.id, g.our_side);
  }

  const ourBattersByGame = new Map<string, Set<string>>();
  for (const row of lineupRes.data ?? []) {
    const r = row as { game_id: string; player_id: string; side: string };
    const ourSide = gameOurSide.get(r.game_id);
    if (!ourSide || r.side !== ourSide) continue;
    const set = ourBattersByGame.get(r.game_id) ?? new Set<string>();
    set.add(r.player_id);
    ourBattersByGame.set(r.game_id, set);
  }

  const filteredPas = allPitcherPas.filter((pa) => ourBattersByGame.get(pa.game_id)?.has(pa.batter_id) ?? false);
  if (filteredPas.length === 0) return null;

  const filteredGameIds = [...new Set(filteredPas.map((p) => p.game_id))];
  const { data: gamePas } = await supabase.from("plate_appearances").select(PLATE_APPEARANCE_COLUMNS).in("game_id", filteredGameIds);
  const allPasForGames = (gamePas ?? []) as PlateAppearance[];

  const batterIds = new Set<string>();
  for (const pa of filteredPas) {
    if (pa.batter_id) batterIds.add(pa.batter_id);
  }
  const batterBatsById = new Map<string, Bats | null>();
  if (batterIds.size > 0) {
    const { data: batterRows } = await supabase.from("players").select("id, bats").in("id", [...batterIds]);
    for (const row of batterRows ?? []) {
      const r = row as { id: string; bats: string | null };
      batterBatsById.set(r.id, (r.bats as Bats | null) ?? null);
    }
  }

  const [homeStarters, awayStarters] = await Promise.all([
    supabase.from("games").select("id").eq("starting_pitcher_home_id", pitcherId),
    supabase.from("games").select("id").eq("starting_pitcher_away_id", pitcherId),
  ]);
  const starterGameIds = new Set<string>();
  for (const row of homeStarters.data ?? []) {
    starterGameIds.add((row as { id: string }).id);
  }
  for (const row of awayStarters.data ?? []) {
    starterGameIds.add((row as { id: string }).id);
  }
  const fgSet = new Set(filteredGameIds);
  const startersForSample = new Set([...starterGameIds].filter((id) => fgSet.has(id)));

  const paPitchIds = filteredPas.map((p) => p.id).filter(Boolean) as string[];
  const pitchEventsPitching =
    paPitchIds.length > 0 ? await getPitchEventsForPaIds(paPitchIds) : [];
  const eventsByPaIdPitching = groupPitchEventsByPaId(pitchEventsPitching);

  const { data: saveRowsVsOur } = await supabase
    .from("games")
    .select("id, save_pitcher_id, final_score_home, final_score_away")
    .in("id", filteredGameIds)
    .eq("save_pitcher_id", pitcherId);
  let savesVsOur = 0;
  for (const row of saveRowsVsOur ?? []) {
    const g = row as Game;
    const fh = g.final_score_home;
    const fa = g.final_score_away;
    if (fh == null || fa == null || Number.isNaN(Number(fh)) || Number.isNaN(Number(fa))) continue;
    savesVsOur += 1;
  }

  const { data: decisionRowsVsOur } = await supabase
    .from("games")
    .select("id, winning_pitcher_id, losing_pitcher_id, final_score_home, final_score_away")
    .in("id", filteredGameIds);
  let winsVsOur = 0;
  let lossesVsOur = 0;
  for (const row of decisionRowsVsOur ?? []) {
    const g = row as Game;
    const fh = g.final_score_home;
    const fa = g.final_score_away;
    if (fh == null || fa == null || Number.isNaN(Number(fh)) || Number.isNaN(Number(fa))) continue;
    if (g.winning_pitcher_id === pitcherId) winsVsOur += 1;
    if (g.losing_pitcher_id === pitcherId) lossesVsOur += 1;
  }

  const withSplits = pitchingStatsFromPAs(
    filteredPas,
    startersForSample,
    batterBatsById,
    eventsByPaIdPitching,
    {
      allPasForRunCharges: allPasForGames,
      officialSaves: savesVsOur,
      officialWins: winsVsOur,
      officialLosses: lossesVsOur,
    }
  );
  if (!withSplits) return null;
  const eCountsPitch = await fetchFieldingErrorCountsForPlayers(supabase, [pitcherId]);
  const eN = eCountsPitch[pitcherId] ?? 0;
  withSplits.overall.e = eN;
  return withSplits.overall;
}

/**
 * Most recent game strictly before `beforeDate` (YYYY-MM-DD) where the pitcher has ≥1 PA on the mound.
 * Line is built only from that game’s PAs for this pitcher.
 */

export async function getPitcherLastOutingBefore(
  pitcherId: string,
  beforeDate: string,
  excludeGameId?: string | null
): Promise<{ game: Game; overall: PitchingStats } | null> {
  const supabase = await getSupabase();
  if (!supabase || !pitcherId?.trim() || isDemoId(pitcherId)) return null;

  const { data: rows } = await supabase.from("plate_appearances").select("game_id").eq("pitcher_id", pitcherId);
  const gameIds = [
    ...new Set(
      (rows ?? [])
        .map((r) => (r as { game_id: string }).game_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0 && !isDemoId(id))
    ),
  ];
  if (gameIds.length === 0) return null;

  const { data: gameRows } = await supabase.from("games").select(GAME_COLUMNS).in("id", gameIds);
  let candidates = (gameRows ?? []) as Game[];
  candidates = candidates.filter(
    (g) =>
      !isDemoId(g.id) &&
      g.date < beforeDate &&
      (!excludeGameId || g.id !== excludeGameId)
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const g = candidates[0]!;

  const allPas = await getPlateAppearancesByGame(g.id);
  const pasP = allPas.filter((p) => p.pitcher_id === pitcherId);
  if (pasP.length === 0) return null;

  const batterIds = [...new Set(pasP.map((p) => p.batter_id).filter(Boolean))];
  const batterBatsById = new Map<string, Bats | null>();
  if (batterIds.length > 0) {
    const { data: batterRows } = await supabase.from("players").select("id, bats").in("id", batterIds);
    for (const row of batterRows ?? []) {
      const r = row as { id: string; bats: string | null };
      batterBatsById.set(r.id, (r.bats as Bats | null) ?? null);
    }
  }

  const started = new Set<string>();
  if (g.starting_pitcher_home_id === pitcherId || g.starting_pitcher_away_id === pitcherId) started.add(g.id);

  const paIds = pasP.map((p) => p.id).filter(Boolean) as string[];
  const pitchEvents = paIds.length > 0 ? await getPitchEventsForPaIds(paIds) : [];
  const eventsByPaId = groupPitchEventsByPaId(pitchEvents);

  const fin = isGameFinalized(g);
  const merged = pitchingStatsFromPAs(pasP, started, batterBatsById, eventsByPaId, {
    pitcherIdForRunCharge: pitcherId,
    allPasForRunCharges: allPas,
    officialSaves: fin && g.save_pitcher_id === pitcherId ? 1 : 0,
    officialWins: fin && g.winning_pitcher_id === pitcherId ? 1 : 0,
    officialLosses: fin && g.losing_pitcher_id === pitcherId ? 1 : 0,
  });
  if (!merged?.overall) return null;
  return { game: g, overall: merged.overall };
}

/** Team-level batting stats: all PAs for the given roster, single aggregate (AVG, OBP, SLG, OPS, HR, RBI, R, etc.). */

export async function getTeamPitchingStats(
  playerIds: string[]
): Promise<(PitchingStats & { pitchesTotal: number }) | null> {
  const supabase = await getSupabase();
  if (!supabase || playerIds.length === 0) return null;
  const ids = playerIds.filter((id) => !isDemoId(id));
  if (ids.length === 0) return null;

  const { data } = await supabase
    .from("plate_appearances")
    .select(PLATE_APPEARANCE_COLUMNS)
    .in("pitcher_id", ids);
  const pas = (data ?? []) as PlateAppearance[];
  if (pas.length === 0) return null;

  const gameIds = [...new Set(pas.map((p) => p.game_id).filter((g): g is string => Boolean(g)))];
  let allPasForGames: PlateAppearance[] = pas;
  if (gameIds.length > 0) {
    const { data: gamePas } = await supabase.from("plate_appearances").select(PLATE_APPEARANCE_COLUMNS).in("game_id", gameIds);
    allPasForGames = (gamePas ?? []) as PlateAppearance[];
  }

  const batterIds = new Set<string>();
  for (const pa of pas) {
    if (pa.batter_id) batterIds.add(pa.batter_id);
  }
  const batterBatsById = new Map<string, Bats | null>();
  if (batterIds.size > 0) {
    const { data: batterRows } = await supabase.from("players").select("id, bats").in("id", [...batterIds]);
    for (const row of batterRows ?? []) {
      const r = row as { id: string; bats: string | null };
      batterBatsById.set(r.id, (r.bats as Bats | null) ?? null);
    }
  }

  const paTeamPitchIds = pas.map((p) => p.id).filter(Boolean) as string[];
  const pitchEventsTeam =
    paTeamPitchIds.length > 0 ? await getPitchEventsForPaIds(paTeamPitchIds) : [];
  const eventsByPaIdTeam = groupPitchEventsByPaId(pitchEventsTeam);

  const { data: teamSaveGames } = await supabase.from("games").select("id").in("save_pitcher_id", ids);
  const teamOfficialSaves = (teamSaveGames ?? []).length;

  const merged = pitchingStatsFromPAs(pas, new Set(), batterBatsById, eventsByPaIdTeam, {
    pitcherIdForRunCharge: null,
    officialSaves: teamOfficialSaves,
  });
  if (!merged?.overall) return null;

  const eTeamPitch = await fetchFieldingErrorCountsForPlayers(supabase, ids);
  const teamE = ids.reduce((s, id) => s + (eTeamPitch[id] ?? 0), 0);

  const pitchesTotal = pas.reduce((sum, p) => {
    const v = p.pitches_seen;
    return sum + (v != null && !Number.isNaN(v) ? v : 0);
  }, 0);

  const overall = {
    ...merged.overall,
    ir: inheritedRunnersBequeathedTeamTotal(ids, allPasForGames),
    irs: inheritedRunnersScoredInPasList(pas),
    e: teamE,
  };

  return { ...overall, pitchesTotal };
}

/** Same as getBattingStatsForPlayers but also returns vs LHP / vs RHP splits (by pitcher_hand on PAs). */

const EMPTY_RATE_LINE = (): PitchingRateLine => ({
  pa: 0,
  ip: 0,
  k7: 0,
  bb7: 0,
  h7: 0,
  hr7: 0,
  kPct: 0,
  bbPct: 0,
  pPa: null,
  strikePct: null,
  fpsPct: null,
});

const EMPTY_PITCHING_STATS = (): PitchingStats => ({
  g: 0,
  gs: 0,
  ip: 0,
  ipDisplay: "0",
  h: 0,
  abAgainst: 0,
  r: 0,
  ir: 0,
  irs: 0,
  er: 0,
  era: 0,
  hr: 0,
  so: 0,
  w: 0,
  l: 0,
  sv: 0,
  bb: 0,
  hbp: 0,
  fip: 0,
  whip: 0,
  e: 0,
  rates: EMPTY_RATE_LINE(),
});

const EMPTY_PITCHING_RUNNER_SPLIT = (): PitchingRunnerSituationSplit => ({
  combined: null,
  vsLHB: null,
  vsRHB: null,
});

const EMPTY_PITCHING_STATS_WITH_SPLITS = (): PitchingStatsWithSplits => ({
  overall: EMPTY_PITCHING_STATS(),
  vsLHB: null,
  vsRHB: null,
  home: null,
  away: null,
  runnerSituations: {
    basesEmpty: EMPTY_PITCHING_RUNNER_SPLIT(),
    runnersOn: EMPTY_PITCHING_RUNNER_SPLIT(),
    risp: EMPTY_PITCHING_RUNNER_SPLIT(),
    basesLoaded: EMPTY_PITCHING_RUNNER_SPLIT(),
  },
});

