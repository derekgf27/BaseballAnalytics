import { gamesReferencedByPas } from "@/lib/opponentUtils";
import { isDemoId } from "../mockData";
import type { ClubBattingMatchupPayload, ClubPitchingMatchupPayload, Game, PlateAppearance } from "@/lib/types";
import { PLATE_APPEARANCE_COLUMNS } from "./columns";
import { getSupabase } from "./client";
import { getBaserunningTotalsForPlayerIds } from "./baserunning";
import { getGamesByIds } from "./games";
import { getPitchEventsForPaIds } from "./pitchEvents";

export async function getClubBattingMatchupPayload(playerIds: string[]): Promise<ClubBattingMatchupPayload> {
  const supabase = await getSupabase();
  const empty: ClubBattingMatchupPayload = {
    pas: [],
    games: [],
    baserunningByPlayerId: {},
    startedGameIdsByPlayer: {},
    pitchEvents: [],
  };
  if (!supabase || playerIds.length === 0) return empty;

  const cleanIds = playerIds.filter((id) => !isDemoId(id));
  if (cleanIds.length === 0) return empty;

  const [paResult, brTotals, lineupRes] = await Promise.all([
    supabase.from("plate_appearances").select(PLATE_APPEARANCE_COLUMNS).in("batter_id", cleanIds),
    getBaserunningTotalsForPlayerIds(playerIds),
    supabase.from("game_lineups").select("game_id, player_id").in("player_id", cleanIds),
  ]);

  const pas = ((paResult.data ?? []) as PlateAppearance[]).filter((p) => !isDemoId(p.batter_id));
  const gameIds = [...new Set(pas.map((p) => p.game_id).filter(Boolean))] as string[];
  const games = await getGamesByIds(gameIds);

  const startedByPlayer = new Map<string, Set<string>>();
  for (const row of lineupRes.data ?? []) {
    const r = row as { game_id: string; player_id: string };
    const set = startedByPlayer.get(r.player_id) ?? new Set<string>();
    set.add(r.game_id);
    startedByPlayer.set(r.player_id, set);
  }
  const startedGameIdsByPlayer: Record<string, string[]> = {};
  for (const [pid, set] of startedByPlayer) {
    startedGameIdsByPlayer[pid] = [...set];
  }

  const paIds = pas.map((p) => p.id).filter(Boolean) as string[];
  const pitchEvents = paIds.length > 0 ? await getPitchEventsForPaIds(paIds) : [];
  const gamesInSample = gamesReferencedByPas(pas, games);

  return {
    pas,
    games: gamesInSample,
    baserunningByPlayerId: brTotals,
    startedGameIdsByPlayer,
    pitchEvents,
  };
}

export async function getClubPitchingMatchupPayload(pitcherIds: string[]): Promise<ClubPitchingMatchupPayload> {
  const supabase = await getSupabase();
  const empty: ClubPitchingMatchupPayload = {
    pas: [],
    games: [],
    starterGameIdsByPlayer: {},
    batterBatsById: {},
    pitchEvents: [],
  };
  if (!supabase || pitcherIds.length === 0) return empty;

  const clean = pitcherIds.filter((id) => !isDemoId(id));
  if (clean.length === 0) return empty;

  const [paResult, homeStarters, awayStarters] = await Promise.all([
    supabase.from("plate_appearances").select(PLATE_APPEARANCE_COLUMNS).in("pitcher_id", clean),
    supabase.from("games").select("id, starting_pitcher_home_id").in("starting_pitcher_home_id", clean),
    supabase.from("games").select("id, starting_pitcher_away_id").in("starting_pitcher_away_id", clean),
  ]);

  const pas = ((paResult.data ?? []) as PlateAppearance[]).filter((p) => p.pitcher_id && !isDemoId(p.pitcher_id));
  const gameIds = [...new Set(pas.map((p) => p.game_id).filter(Boolean))] as string[];
  const games = await getGamesByIds(gameIds);

  const starterGames = new Map<string, Set<string>>();
  for (const id of clean) starterGames.set(id, new Set<string>());
  for (const row of homeStarters.data ?? []) {
    const r = row as { id: string; starting_pitcher_home_id: string | null };
    if (r.starting_pitcher_home_id) starterGames.get(r.starting_pitcher_home_id)?.add(r.id);
  }
  for (const row of awayStarters.data ?? []) {
    const r = row as { id: string; starting_pitcher_away_id: string | null };
    if (r.starting_pitcher_away_id) starterGames.get(r.starting_pitcher_away_id)?.add(r.id);
  }
  const starterGameIdsByPlayer: Record<string, string[]> = {};
  for (const [pid, set] of starterGames) {
    starterGameIdsByPlayer[pid] = [...set];
  }

  const batterIds = new Set<string>();
  for (const pa of pas) {
    if (pa.batter_id && !isDemoId(pa.batter_id)) batterIds.add(pa.batter_id);
  }
  const batterBatsById: Record<string, string | null> = {};
  if (batterIds.size > 0) {
    const { data: batterRows } = await supabase.from("players").select("id, bats").in("id", [...batterIds]);
    for (const row of batterRows ?? []) {
      const r = row as { id: string; bats: string | null };
      batterBatsById[r.id] = r.bats;
    }
  }

  const paIds = pas.map((p) => p.id).filter(Boolean) as string[];
  const pitchEvents = paIds.length > 0 ? await getPitchEventsForPaIds(paIds) : [];
  const gamesInSample = gamesReferencedByPas(pas, games);

  return { pas, games: gamesInSample, starterGameIdsByPlayer, batterBatsById, pitchEvents };
}

