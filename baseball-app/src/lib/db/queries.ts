/**
 * Data access: fetch events, players, games, ratings. Write PAs and overrides.
 * No mock data — uses only Supabase.
 */

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
import { groupPitchEventsByPaId, mergeContactProfileIntoBattingStats } from "@/lib/compute/contactProfileFromPas";
import {
  buildPitchingRunnerSituationsForPitcher,
  buildPitchingStatsByFinalCountForSplits,
  inheritedRunnersBequeathedTeamTotal,
  inheritedRunnersScoredInPasList,
  pitchingStatsFromPAs,
  platoonPitchingPasSplits,
} from "@/lib/compute/pitchingStats";
import { kPctToKRate, type PlayerStatsForWatch } from "@/lib/playersToWatch";
import { isSprayChartBipResult } from "@/lib/sprayChartFilters";
import { isClubRosterPlayer, isPitcherPlayer } from "@/lib/opponentUtils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDemoId } from "./mockData";
import type {
  BattingStats,
  BattingStatsWithSplits,
  Bats,
  PitchingRateLine,
  PitchingStats,
  PitchingRunnerSituationSplit,
  PitchingStatsWithSplits,
  BaserunningEvent,
  BaserunningEventInsert,
  PlateAppearance,
  Player,
  Game,
  PlayerRating,
  PlayerDeletionPreview,
  DefensiveEvent,
  GameLineupSlot,
  LineupSide,
  SavedLineup,
  SavedLineupWithSlots,
  ClubBattingMatchupPayload,
  ClubPitchingMatchupPayload,
  PitchEvent,
  PitchEventDraft,
} from "@/lib/types";

export async function linkPitchTrackerGroupToPlateAppearance(
  trackerGroupId: string,
  paId: string
): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) throw new Error("Database unavailable");
  const { error } = await supabase
    .from("pitches")
    .update({ at_bat_id: paId })
    .eq("tracker_group_id", trackerGroupId)
    .is("at_bat_id", null);
  if (error) throw new Error(error.message);
}

async function getSupabase() {
  return createSupabaseServerClient();
}

/** Defensive errors charged per player (any PA with `error_fielder_id`). */
async function fetchFieldingErrorCountsForPlayers(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabase>>>,
  playerIds: string[]
): Promise<Record<string, number>> {
  const clean = [...new Set(playerIds.filter((id) => !isDemoId(id)))];
  if (clean.length === 0) return {};
  const { data } = await supabase
    .from("plate_appearances")
    .select("error_fielder_id")
    .in("error_fielder_id", clean)
    .not("error_fielder_id", "is", null);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = (row as { error_fielder_id: string }).error_fielder_id;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

/** SB/CS counts per player from baserunning_events (all games). */
export async function getBaserunningTotalsForPlayerIds(
  playerIds: string[]
): Promise<Record<string, { sb: number; cs: number }>> {
  const supabase = await getSupabase();
  if (!supabase || playerIds.length === 0) return {};
  const { data } = await supabase
    .from("baserunning_events")
    .select("runner_id, event_type")
    .in("runner_id", playerIds);
  const map: Record<string, { sb: number; cs: number }> = {};
  for (const id of playerIds) {
    if (!isDemoId(id)) map[id] = { sb: 0, cs: 0 };
  }
  for (const row of data ?? []) {
    const r = row as { runner_id: string; event_type: string };
    const m = map[r.runner_id];
    if (!m) continue;
    if (r.event_type === "sb") m.sb++;
    else if (r.event_type === "cs") m.cs++;
  }
  return map;
}

/** SB/CS per runner for one game (for box score). */
export async function getBaserunningTotalsForGame(
  gameId: string
): Promise<Record<string, { sb: number; cs: number }>> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(gameId)) return {};
  const { data } = await supabase
    .from("baserunning_events")
    .select("runner_id, event_type")
    .eq("game_id", gameId);
  const map: Record<string, { sb: number; cs: number }> = {};
  for (const row of data ?? []) {
    const r = row as { runner_id: string; event_type: string };
    if (!map[r.runner_id]) map[r.runner_id] = { sb: 0, cs: 0 };
    if (r.event_type === "sb") map[r.runner_id].sb++;
    else if (r.event_type === "cs") map[r.runner_id].cs++;
  }
  return map;
}

export async function getBaserunningEventsForGame(gameId: string): Promise<BaserunningEvent[]> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(gameId)) return [];
  const { data } = await supabase
    .from("baserunning_events")
    .select("*")
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });
  return (data ?? []) as BaserunningEvent[];
}

export async function insertBaserunningEvent(
  row: BaserunningEventInsert
): Promise<BaserunningEvent | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const payload = { ...row } as Record<string, unknown>;
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) delete payload[key];
  }
  const { data, error } = await supabase.from("baserunning_events").insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data as BaserunningEvent;
}

export async function deleteBaserunningEvent(id: string): Promise<boolean> {
  const supabase = await getSupabase();
  if (!supabase || !id) return false;
  const { error } = await supabase.from("baserunning_events").delete().eq("id", id);
  return !error;
}

/** Delete all baserunning events for a game (e.g. when clearing game stats). */
export async function deleteBaserunningEventsByGame(gameId: string): Promise<number> {
  const supabase = await getSupabase();
  if (!supabase || !gameId) return 0;
  const { data, error } = await supabase
    .from("baserunning_events")
    .delete()
    .eq("game_id", gameId)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

/** Delete all baserunning events (clear all stats). */
export async function deleteAllBaserunningEvents(): Promise<number> {
  const supabase = await getSupabase();
  if (!supabase) return 0;
  const { data, error } = await supabase.from("baserunning_events").delete().gte("inning", 1).select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function getGames(): Promise<Game[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data } = await supabase.from("games").select("*").order("date", { ascending: false });
  return (data ?? []) as Game[];
}

/** Coach dashboard: prefer the game row most recently created (matches “just added this game”). */
export async function getGamesForCoachDashboard(): Promise<Game[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("games")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as Game[];
}

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

  const [paResult, gamesRes, brTotals, lineupRes] = await Promise.all([
    supabase.from("plate_appearances").select("*").in("batter_id", cleanIds),
    supabase.from("games").select("*").order("date", { ascending: false }),
    getBaserunningTotalsForPlayerIds(playerIds),
    supabase.from("game_lineups").select("game_id, player_id").in("player_id", cleanIds),
  ]);

  const pas = ((paResult.data ?? []) as PlateAppearance[]).filter((p) => !isDemoId(p.batter_id));
  const games = (gamesRes.data ?? []) as Game[];

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

  return { pas, games, baserunningByPlayerId: brTotals, startedGameIdsByPlayer, pitchEvents };
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

  const [paResult, gamesRes, homeStarters, awayStarters] = await Promise.all([
    supabase.from("plate_appearances").select("*").in("pitcher_id", clean),
    supabase.from("games").select("*").order("date", { ascending: false }),
    supabase.from("games").select("id, starting_pitcher_home_id").in("starting_pitcher_home_id", clean),
    supabase.from("games").select("id, starting_pitcher_away_id").in("starting_pitcher_away_id", clean),
  ]);

  const pas = ((paResult.data ?? []) as PlateAppearance[]).filter((p) => p.pitcher_id && !isDemoId(p.pitcher_id));
  const games = (gamesRes.data ?? []) as Game[];

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

  return { pas, games, starterGameIdsByPlayer, batterBatsById, pitchEvents };
}

export interface TrackedOpponentRow {
  id: string;
  name: string;
}

/** Rows from Analyst → Opponents (manually added; editable / deletable). */
export async function getTrackedOpponents(): Promise<TrackedOpponentRow[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("tracked_opponents")
    .select("id, name")
    .order("created_at", { ascending: false });
  return (data ?? [])
    .map((r: { id: string; name: string }) => ({
      id: r.id,
      name: r.name.trim().replace(/\s+/g, " "),
    }))
    .filter((r) => Boolean(r.name));
}

/** Names added from Analyst → Opponents (no game required). */
export async function getTrackedOpponentNames(): Promise<string[]> {
  const rows = await getTrackedOpponents();
  return rows.map((r) => r.name);
}

export async function insertTrackedOpponent(name: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getSupabase();
  if (!supabase) return { ok: false, error: "Database not connected." };
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return { ok: false, error: "Enter a team name." };
  const { error } = await supabase.from("tracked_opponents").insert({ name: trimmed });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "That opponent is already saved." };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function updateTrackedOpponent(
  id: string,
  newName: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getSupabase();
  if (!supabase) return { ok: false, error: "Database not connected." };
  const trimmed = newName.trim().replace(/\s+/g, " ");
  if (!trimmed) return { ok: false, error: "Enter a team name." };
  const { error } = await supabase.from("tracked_opponents").update({ name: trimmed }).eq("id", id);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "That opponent name is already saved." };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteTrackedOpponent(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getSupabase();
  if (!supabase) return { ok: false, error: "Database not connected." };
  const { error } = await supabase.from("tracked_opponents").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getPlayers(): Promise<Player[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data } = await supabase.from("players").select("*").order("name");
  return (data ?? []) as Player[];
}

export async function getPlayersByIds(ids: string[]): Promise<Player[]> {
  const supabase = await getSupabase();
  if (!supabase || ids.length === 0) return [];
  const { data } = await supabase
    .from("players")
    .select("*")
    .in("id", ids);
  return (data ?? []) as Player[];
}

export async function getGameLineup(gameId: string): Promise<GameLineupSlot[]> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(gameId)) return [];
  const { data } = await supabase
    .from("game_lineups")
    .select("game_id, side, slot, player_id, position")
    .eq("game_id", gameId)
    .order("side", { ascending: true })
    .order("slot", { ascending: true });
  return (data ?? []) as GameLineupSlot[];
}

/** Insert one side's lineup for a game. slots: in order (slot 1, 2, …); each may have position for this game. */
export async function insertGameLineup(
  gameId: string,
  side: LineupSide,
  slots: { player_id: string; position?: string | null }[]
): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(gameId) || slots.length === 0) return;
  const rows = slots.map((s, i) => ({
    game_id: gameId,
    side,
    slot: i + 1,
    player_id: s.player_id,
    position: s.position ?? null,
  }));
  await supabase.from("game_lineups").insert(rows);
}

export async function getSavedLineups(): Promise<SavedLineup[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("saved_lineups")
    .select("id, name, created_at")
    .order("name");
  return (data ?? []) as SavedLineup[];
}

export async function getSavedLineupWithSlots(id: string): Promise<SavedLineupWithSlots | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data: lineup } = await supabase
    .from("saved_lineups")
    .select("id, name, created_at")
    .eq("id", id)
    .single();
  if (!lineup) return null;
  const { data: slots } = await supabase
    .from("saved_lineup_slots")
    .select("slot, player_id, position")
    .eq("lineup_id", id)
    .order("slot");
  const list = (slots ?? []) as { slot: number; player_id: string; position: string | null }[];
  return { ...(lineup as SavedLineup), slots: list };
}

export async function insertSavedLineup(
  name: string,
  slots: { slot: number; player_id: string; position: string | null }[]
): Promise<SavedLineup | null> {
  const supabase = await getSupabase();
  if (!supabase) throw new Error("Database not connected.");
  if (slots.length === 0) throw new Error("Lineup must have at least one player.");
  const { data: lineup, error: lineupError } = await supabase
    .from("saved_lineups")
    .insert({ name: name.trim() })
    .select()
    .single();
  if (lineupError) throw new Error(lineupError.message);
  if (!lineup) return null;
  const lineupId = (lineup as SavedLineup).id;
  const { error: slotsError } = await supabase.from("saved_lineup_slots").insert(
    slots.map((s) => ({ lineup_id: lineupId, slot: s.slot, player_id: s.player_id, position: s.position ?? null }))
  );
  if (slotsError) throw new Error(slotsError.message);
  return lineup as SavedLineup;
}

export async function updateSavedLineup(
  id: string,
  name: string,
  slots: { slot: number; player_id: string; position: string | null }[]
): Promise<SavedLineup | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  await supabase.from("saved_lineup_slots").delete().eq("lineup_id", id);
  await supabase.from("saved_lineups").update({ name: name.trim() }).eq("id", id);
  if (slots.length > 0) {
    await supabase.from("saved_lineup_slots").insert(
      slots.map((s) => ({ lineup_id: id, slot: s.slot, player_id: s.player_id, position: s.position ?? null }))
    );
  }
  return getSavedLineupWithSlots(id).then((l) => (l ? { id: l.id, name: l.name, created_at: l.created_at } : null));
}

export async function deleteSavedLineup(id: string): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;
  await supabase.from("saved_lineup_slots").delete().eq("lineup_id", id);
  await supabase.from("saved_lineups").delete().eq("id", id);
}

export async function getPlateAppearancesByGame(gameId: string): Promise<PlateAppearance[]> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(gameId)) return [];
  const { data } = await supabase
    .from("plate_appearances")
    .select("*")
    .eq("game_id", gameId)
    .order("inning")
    .order("created_at");
  return (data ?? []) as PlateAppearance[];
}

/** All PAs for a set of games (e.g. vs one opponent). Excludes demo games. */
export async function getPlateAppearancesForGames(gameIds: string[]): Promise<PlateAppearance[]> {
  const supabase = await getSupabase();
  if (!supabase || gameIds.length === 0) return [];
  const clean = gameIds.filter((id) => !isDemoId(id));
  if (clean.length === 0) return [];
  const { data } = await supabase.from("plate_appearances").select("*").in("game_id", clean);
  const rows = (data ?? []) as PlateAppearance[];
  return rows.sort((a, b) => {
    if (a.game_id !== b.game_id) return a.game_id.localeCompare(b.game_id);
    if (a.inning !== b.inning) return a.inning - b.inning;
    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  });
}

/** All lineup rows for many games at once. */
export async function getGameLineupsForGames(gameIds: string[]): Promise<GameLineupSlot[]> {
  const supabase = await getSupabase();
  if (!supabase || gameIds.length === 0) return [];
  const clean = gameIds.filter((id) => !isDemoId(id));
  if (clean.length === 0) return [];
  const { data } = await supabase
    .from("game_lineups")
    .select("game_id, side, slot, player_id, position")
    .in("game_id", clean);
  const rows = (data ?? []) as GameLineupSlot[];
  return rows.sort((a, b) => {
    if (a.game_id !== b.game_id) return a.game_id.localeCompare(b.game_id);
    if (a.side !== b.side) return a.side.localeCompare(b.side);
    return a.slot - b.slot;
  });
}

/** Baserunning events for multiple games. */
export async function getBaserunningEventsForGames(gameIds: string[]): Promise<BaserunningEvent[]> {
  const supabase = await getSupabase();
  if (!supabase || gameIds.length === 0) return [];
  const clean = gameIds.filter((id) => !isDemoId(id));
  if (clean.length === 0) return [];
  const { data } = await supabase.from("baserunning_events").select("*").in("game_id", clean);
  const rows = (data ?? []) as BaserunningEvent[];
  return rows.sort((a, b) => {
    if (a.game_id !== b.game_id) return a.game_id.localeCompare(b.game_id);
    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  });
}

/** Spray-chart rows for games (includes inning_half for filtering to one team's PAs; pitcher_id for opponent pitching spray). */
export async function getSprayChartRowsForGames(gameIds: string[]): Promise<
  {
    game_id: string;
    batter_id: string;
    pitcher_id: string | null;
    hit_direction: string;
    result: string;
    pitcher_hand: "L" | "R" | null;
    inning_half: string | null;
  }[]
> {
  const supabase = await getSupabase();
  if (!supabase || gameIds.length === 0) return [];
  const clean = gameIds.filter((id) => !isDemoId(id));
  if (clean.length === 0) return [];
  const { data } = await supabase
    .from("plate_appearances")
    .select("game_id, batter_id, pitcher_id, hit_direction, result, pitcher_hand, inning_half")
    .in("game_id", clean);
  const rows = (data ?? []) as {
    game_id: string;
    batter_id: string;
    pitcher_id: string | null;
    hit_direction: string | null;
    result: string;
    pitcher_hand: string | null;
    inning_half: string | null;
  }[];
  return rows
    .filter(
      (r) =>
        !isDemoId(r.game_id) &&
        r.hit_direction != null &&
        r.hit_direction !== "" &&
        r.batter_id &&
        !isDemoId(r.batter_id)
    )
    .map((r) => ({
      game_id: r.game_id,
      batter_id: r.batter_id,
      pitcher_id: r.pitcher_id && !isDemoId(r.pitcher_id) ? r.pitcher_id : null,
      hit_direction: r.hit_direction!,
      result: r.result,
      pitcher_hand: r.pitcher_hand === "L" || r.pitcher_hand === "R" ? r.pitcher_hand : null,
      inning_half: r.inning_half,
    }));
}

/** Base-hit PAs with hit_direction when a club pitcher is on the mound — team pitching spray (vs LHB / vs RHB). */
export async function getTeamPlateAppearancesForPitchingSpray(): Promise<
  { game_id: string; batter_id: string; hit_direction: string; result: string; pitcher_hand: "L" | "R" | null }[]
> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const roster = await getPlayers();
  const clubPitcherIds = new Set(
    roster.filter((p) => !isDemoId(p.id) && isClubRosterPlayer(p) && isPitcherPlayer(p)).map((p) => p.id)
  );
  if (clubPitcherIds.size === 0) return [];
  const { data } = await supabase
    .from("plate_appearances")
    .select("game_id, batter_id, pitcher_id, hit_direction, result, pitcher_hand");
  const rows = (data ?? []) as {
    game_id: string;
    batter_id: string;
    pitcher_id: string | null;
    hit_direction: string | null;
    result: string;
    pitcher_hand: string | null;
  }[];
  return rows
    .filter(
      (r) =>
        !isDemoId(r.game_id) &&
        r.pitcher_id &&
        clubPitcherIds.has(r.pitcher_id) &&
        isSprayChartBipResult(r.result) &&
        r.hit_direction != null &&
        r.hit_direction !== "" &&
        r.batter_id &&
        !isDemoId(r.batter_id)
    )
    .map((r) => ({
      game_id: r.game_id,
      batter_id: r.batter_id,
      hit_direction: r.hit_direction!,
      result: r.result,
      pitcher_hand: r.pitcher_hand === "L" || r.pitcher_hand === "R" ? r.pitcher_hand : null,
    }));
}

/** All PAs for run expectancy: game, inning, half, base_state, outs, rbi, created_at. Excludes demo games. */
export async function getAllPlateAppearancesForRunExpectancy(): Promise<
  Pick<PlateAppearance, "game_id" | "inning" | "inning_half" | "base_state" | "outs" | "rbi" | "created_at">[]
> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const clubBatterIds = new Set(
    (await getPlayers())
      .filter((p) => isClubRosterPlayer(p))
      .map((p) => p.id)
      .filter((id) => !isDemoId(id))
  );
  if (clubBatterIds.size === 0) return [];
  const { data } = await supabase
    .from("plate_appearances")
    .select("game_id, batter_id, inning, inning_half, base_state, outs, rbi, created_at")
    .order("game_id")
    .order("inning")
    .order("created_at");
  const rows = (data ?? []) as Array<
    Pick<PlateAppearance, "game_id" | "batter_id" | "inning" | "inning_half" | "base_state" | "outs" | "rbi" | "created_at">
  >;
  return rows
    .filter((r) => !isDemoId(r.game_id) && !!r.batter_id && clubBatterIds.has(r.batter_id))
    .map(({ game_id, inning, inning_half, base_state, outs, rbi, created_at }) => ({
      game_id,
      inning,
      inning_half,
      base_state,
      outs,
      rbi,
      created_at,
    }));
}

/** PAs with hit_direction for team spray chart (hits and BIP outs). Excludes demo games.
 *  Includes batter_id and pitcher_hand for RHB/LHB split (switch hitters inferred: vs LHP → R, vs RHP → L).
 */
export async function getTeamPlateAppearancesForSpray(): Promise<
  { game_id: string; batter_id: string; hit_direction: string; result: string; pitcher_hand: "L" | "R" | null }[]
> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("plate_appearances")
    .select("game_id, batter_id, hit_direction, result, pitcher_hand");
  const rows = (data ?? []) as { game_id: string; batter_id: string; hit_direction: string | null; result: string; pitcher_hand: string | null }[];
  return rows.filter(
    (r) =>
      !isDemoId(r.game_id) &&
      isSprayChartBipResult(r.result) &&
      r.hit_direction != null &&
      r.hit_direction !== "" &&
      r.batter_id &&
      !isDemoId(r.batter_id)
  ).map((r) => ({ ...r, hit_direction: r.hit_direction!, pitcher_hand: r.pitcher_hand === "L" || r.pitcher_hand === "R" ? r.pitcher_hand : null })) as { game_id: string; batter_id: string; hit_direction: string; result: string; pitcher_hand: "L" | "R" | null }[];
}

export async function getPlateAppearancesByBatter(batterId: string): Promise<PlateAppearance[]> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(batterId)) return [];
  const { data } = await supabase
    .from("plate_appearances")
    .select("*")
    .eq("batter_id", batterId)
    .order("created_at", { ascending: false });
  return (data ?? []) as PlateAppearance[];
}

export async function getPlateAppearancesByPitcher(pitcherId: string): Promise<PlateAppearance[]> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(pitcherId)) return [];
  const { data } = await supabase
    .from("plate_appearances")
    .select("*")
    .eq("pitcher_id", pitcherId)
    .order("created_at", { ascending: false });
  return (data ?? []) as PlateAppearance[];
}

/** Fetch all PAs for the given batters (for trend: group by batter_id, take last N per player). */
export async function getPlateAppearancesByBatters(batterIds: string[]): Promise<PlateAppearance[]> {
  const supabase = await getSupabase();
  if (!supabase || batterIds.length === 0) return [];
  const ids = batterIds.filter((id) => !isDemoId(id));
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("plate_appearances")
    .select("*")
    .in("batter_id", ids)
    .order("created_at", { ascending: false });
  return (data ?? []) as PlateAppearance[];
}

export async function getDefensiveEventsByGame(gameId: string): Promise<DefensiveEvent[]> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(gameId)) return [];
  const { data } = await supabase
    .from("defensive_events")
    .select("*")
    .eq("game_id", gameId)
    .order("created_at");
  return (data ?? []) as DefensiveEvent[];
}

export async function getPlayerRating(playerId: string): Promise<PlayerRating | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("player_ratings")
    .select("*")
    .eq("player_id", playerId)
    .single();
  return data as PlayerRating | null;
}

/** Returns a map of player_id -> rating for all given ids that have a stored rating. */
export async function getPlayerRatingsBatch(
  playerIds: string[]
): Promise<Record<string, Pick<PlayerRating, "contact_reliability" | "damage_potential" | "decision_quality" | "defense_trust">>> {
  const supabase = await getSupabase();
  if (!supabase || playerIds.length === 0) return {};
  const { data } = await supabase
    .from("player_ratings")
    .select("player_id, contact_reliability, damage_potential, decision_quality, defense_trust")
    .in("player_id", playerIds);
  const list = (data ?? []) as Array<PlayerRating & { player_id: string }>;
  const map: Record<string, Pick<PlayerRating, "contact_reliability" | "damage_potential" | "decision_quality" | "defense_trust">> = {};
  for (const row of list) {
    map[row.player_id] = {
      contact_reliability: row.contact_reliability,
      damage_potential: row.damage_potential,
      decision_quality: row.decision_quality,
      defense_trust: row.defense_trust,
    };
  }
  return map;
}

/** Compute AVG, OBP, SLG, OPS, OPS+, R, SB from plate appearances for the given players. */
export async function getBattingStatsForPlayers(
  playerIds: string[]
): Promise<Record<string, BattingStats>> {
  const supabase = await getSupabase();
  if (!supabase || playerIds.length === 0) return {};
  const { data } = await supabase
    .from("plate_appearances")
    .select("*")
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
    gs: startedGames.size,
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
      stats.gs = startedGames.size;
      stats.e = eCounts[playerId] ?? 0;
      result[playerId] = stats;
    }
  }
  return result;
}

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
  runnerSituations: {
    basesEmpty: EMPTY_PITCHING_RUNNER_SPLIT(),
    runnersOn: EMPTY_PITCHING_RUNNER_SPLIT(),
    risp: EMPTY_PITCHING_RUNNER_SPLIT(),
    basesLoaded: EMPTY_PITCHING_RUNNER_SPLIT(),
  },
});

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

  const { data: pasRows } = await supabase.from("plate_appearances").select("*").in("pitcher_id", clean);
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
    const { data: gamePas } = await supabase.from("plate_appearances").select("*").in("game_id", gameIds);
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

  const result: Record<string, PitchingStatsWithSplits> = {};
  const paPitchIds = (pasRows ?? [])
    .map((row) => (row as PlateAppearance).id)
    .filter(Boolean) as string[];
  const pitchEventsPitching =
    paPitchIds.length > 0 ? await getPitchEventsForPaIds(paPitchIds) : [];
  const eventsByPaIdPitching = groupPitchEventsByPaId(pitchEventsPitching);
  const eCountsPitch = await fetchFieldingErrorCountsForPlayers(supabase, clean);

  for (const playerId of clean) {
    const pas = byPitcher.get(playerId) ?? [];
    const starters = starterGames.get(playerId) ?? new Set<string>();
    const { pasL, pasR } = platoonPitchingPasSplits(pas, batterBatsById);
    const stats = pitchingStatsFromPAs(pas, starters, batterBatsById, eventsByPaIdPitching, {
      allPasForRunCharges: allPasForGames,
    });
    const base = stats ?? EMPTY_PITCHING_STATS_WITH_SPLITS();
    const eN = eCountsPitch[playerId] ?? 0;
    base.overall.e = eN;
    if (base.vsLHB) base.vsLHB.e = eN;
    if (base.vsRHB) base.vsRHB.e = eN;
    result[playerId] = {
      ...base,
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

  const { data: gameRows } = await supabase.from("games").select("*").in("id", gameIds);
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

  const merged = pitchingStatsFromPAs(pasP, started, batterBatsById, eventsByPaId, {
    pitcherIdForRunCharge: pitcherId,
    allPasForRunCharges: allPas,
  });
  if (!merged?.overall) return null;
  return { game: g, overall: merged.overall };
}

/** Team-level batting stats: all PAs for the given roster, single aggregate (AVG, OBP, SLG, OPS, HR, RBI, R, etc.). */
export async function getTeamBattingStats(
  playerIds: string[]
): Promise<BattingStats | null> {
  const supabase = await getSupabase();
  if (!supabase || playerIds.length === 0) return null;
  const ids = playerIds.filter((id) => !isDemoId(id));
  if (ids.length === 0) return null;
  const { data } = await supabase
    .from("plate_appearances")
    .select("*")
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
    .select("*")
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
export async function getTeamPitchingStats(
  playerIds: string[]
): Promise<(PitchingStats & { pitchesTotal: number }) | null> {
  const supabase = await getSupabase();
  if (!supabase || playerIds.length === 0) return null;
  const ids = playerIds.filter((id) => !isDemoId(id));
  if (ids.length === 0) return null;

  const { data } = await supabase
    .from("plate_appearances")
    .select("*")
    .in("pitcher_id", ids);
  const pas = (data ?? []) as PlateAppearance[];
  if (pas.length === 0) return null;

  const gameIds = [...new Set(pas.map((p) => p.game_id).filter((g): g is string => Boolean(g)))];
  let allPasForGames: PlateAppearance[] = pas;
  if (gameIds.length > 0) {
    const { data: gamePas } = await supabase.from("plate_appearances").select("*").in("game_id", gameIds);
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

  const merged = pitchingStatsFromPAs(pas, new Set(), batterBatsById, eventsByPaIdTeam, {
    pitcherIdForRunCharge: null,
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
export async function getBattingStatsWithSplitsForPlayers(
  playerIds: string[]
): Promise<Record<string, BattingStatsWithSplits>> {
  const supabase = await getSupabase();
  if (!supabase || playerIds.length === 0) return {};
  const { data } = await supabase
    .from("plate_appearances")
    .select("*")
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
        gs: startedGames.size,
        e: eN,
      };
    }
    if (!overall) continue;
    overall.r = runsByPlayer[playerId] ?? 0;
    if (br.sb > 0 || br.cs > 0) mergeBaserunningIntoBattingStats(overall, br);

    overall.gp = distinctGameCount(pas);
    overall.gs = startedGames.size;
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

    result[playerId] = {
      overall,
      vsL: vsLStats,
      vsR: vsRStats,
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

export async function upsertPlayerRating(
  playerId: string,
  ratings: { contact_reliability: number; damage_potential: number; decision_quality: number; defense_trust: number },
  overriddenBy: string
): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;
  await supabase.from("player_ratings").upsert({
    player_id: playerId,
    ...ratings,
    overridden_at: new Date().toISOString(),
    overridden_by: overriddenBy,
    updated_at: new Date().toISOString(),
  });
}

export async function insertPlateAppearance(
  pa: Omit<PlateAppearance, "id" | "created_at">
): Promise<PlateAppearance | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const payload = { ...pa };
  for (const key of Object.keys(payload) as (keyof typeof payload)[]) {
    if (payload[key] === undefined) delete payload[key];
  }
  const { data, error } = await supabase.from("plate_appearances").insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data as PlateAppearance | null;
}

const PITCH_EVENTS_PA_ID_CHUNK = 200;

/** All pitch log rows for the given plate appearance ids (chunked for large rosters). */
export async function getPitchEventsForPaIds(paIds: string[]): Promise<PitchEvent[]> {
  const supabase = await getSupabase();
  if (!supabase || paIds.length === 0) return [];
  const clean = [...new Set(paIds.filter(Boolean))];
  const out: PitchEvent[] = [];
  for (let i = 0; i < clean.length; i += PITCH_EVENTS_PA_ID_CHUNK) {
    const chunk = clean.slice(i, i + PITCH_EVENTS_PA_ID_CHUNK);
    const { data, error } = await supabase.from("pitch_events").select("*").in("pa_id", chunk);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as PitchEvent[]));
  }
  out.sort((a, b) => {
    const cmp = a.pa_id.localeCompare(b.pa_id);
    if (cmp !== 0) return cmp;
    return a.pitch_index - b.pitch_index;
  });
  return out;
}

/** Pitch log rows for all PAs in a game (same PA order as {@link getPlateAppearancesByGame}, then pitch_index). */
export async function getPitchEventsForGame(gameId: string): Promise<PitchEvent[]> {
  const pasOrdered = await getPlateAppearancesByGame(gameId);
  if (pasOrdered.length === 0) return [];
  const supabase = await getSupabase();
  if (!supabase || isDemoId(gameId)) return [];
  const paIds = pasOrdered.map((p) => p.id);
  const paOrder = new Map<string, number>();
  pasOrdered.forEach((p, i) => paOrder.set(p.id, i));
  const { data: events, error } = await supabase.from("pitch_events").select("*").in("pa_id", paIds);
  if (error) throw new Error(error.message);
  const rows = (events ?? []) as PitchEvent[];
  rows.sort((a, b) => {
    const oa = paOrder.get(a.pa_id) ?? 0;
    const ob = paOrder.get(b.pa_id) ?? 0;
    if (oa !== ob) return oa - ob;
    return a.pitch_index - b.pitch_index;
  });
  return rows;
}

export async function insertPitchEventsForPa(paId: string, rows: PitchEventDraft[]): Promise<void> {
  if (rows.length === 0) return;
  const supabase = await getSupabase();
  if (!supabase || isDemoId(paId)) return;
  const payload = rows.map((r) => ({
    pa_id: paId,
    pitch_index: r.pitch_index,
    balls_before: r.balls_before,
    strikes_before: r.strikes_before,
    outcome: r.outcome,
    pitch_type: r.pitch_type ?? null,
  }));
  const { error } = await supabase.from("pitch_events").insert(payload);
  if (error) throw new Error(error.message);
}

/** Insert PA then optional pitch log (same transaction not guaranteed; pitch rows deleted if second insert fails — rare). */
export async function insertPlateAppearanceWithPitchLog(
  pa: Omit<PlateAppearance, "id" | "created_at">,
  pitchLog: PitchEventDraft[]
): Promise<PlateAppearance | null> {
  const inserted = await insertPlateAppearance(pa);
  if (!inserted?.id) return inserted;
  try {
    await insertPitchEventsForPa(inserted.id, pitchLog);
  } catch (e) {
    await supabaseDeletePaById(inserted.id);
    throw e;
  }
  return inserted;
}

async function supabaseDeletePaById(paId: string): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;
  await supabase.from("plate_appearances").delete().eq("id", paId);
}

export async function deletePlateAppearance(paId: string): Promise<boolean> {
  const supabase = await getSupabase();
  if (!supabase || !paId) return false;
  const { error } = await supabase.from("plate_appearances").delete().eq("id", paId);
  return !error;
}

export async function getPlateAppearanceById(paId: string): Promise<PlateAppearance | null> {
  const supabase = await getSupabase();
  if (!supabase || !paId || isDemoId(paId)) return null;
  const { data, error } = await supabase.from("plate_appearances").select("*").eq("id", paId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as PlateAppearance | null;
}

export async function updatePlateAppearanceRow(
  paId: string,
  updates: Partial<
    Pick<
      PlateAppearance,
      "result" | "batted_ball_type" | "hit_direction" | "error_fielder_id" | "base_state"
    >
  >
): Promise<PlateAppearance | null> {
  const supabase = await getSupabase();
  if (!supabase || !paId || isDemoId(paId)) return null;
  const { data, error } = await supabase
    .from("plate_appearances")
    .update(updates)
    .eq("id", paId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as PlateAppearance | null;
}

/** Delete all plate appearances for a single game. Returns number deleted. */
export async function deletePlateAppearancesByGame(gameId: string): Promise<number> {
  const supabase = await getSupabase();
  if (!supabase || !gameId) return 0;
  await deleteBaserunningEventsByGame(gameId);
  const { data, error } = await supabase
    .from("plate_appearances")
    .delete()
    .eq("game_id", gameId)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

/** Delete all plate appearances (clears all stats). Returns number deleted. */
export async function deleteAllPlateAppearances(): Promise<number> {
  const supabase = await getSupabase();
  if (!supabase) return 0;
  await deleteAllBaserunningEvents();
  const { data, error } = await supabase
    .from("plate_appearances")
    .delete()
    .gte("inning", 1)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function getGame(id: string): Promise<Game | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.from("games").select("*").eq("id", id).single();
  return data as Game | null;
}

export async function insertGame(game: Omit<Game, "id" | "created_at">): Promise<Game> {
  const supabase = await getSupabase();
  if (!supabase) throw new Error("Database unavailable");
  const { data, error } = await supabase.from("games").insert(game).select().single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Insert returned no row");
  return data as Game;
}

/** Create a game and assign our lineup; optionally assign opponent lineup (same transaction of inserts). */
export async function createGameWithLineup(
  game: Omit<Game, "id" | "created_at">,
  savedLineupId?: string | null,
  opponentSlots?: { player_id: string; position?: string | null }[] | null,
  /** When set (e.g. from the lineup modal), overrides saved template / default. */
  ourSlotsOverride?: { player_id: string; position?: string | null }[] | null
): Promise<Game> {
  const created = await insertGame(game);
  let slots: { player_id: string; position?: string | null }[] = [];
  const ourOverride = ourSlotsOverride?.filter((s) => s.player_id && !isDemoId(s.player_id)) ?? [];
  if (ourOverride.length > 0) {
    slots = ourOverride.map((s) => ({ player_id: s.player_id, position: s.position ?? null }));
  } else if (savedLineupId && !isDemoId(savedLineupId)) {
    const saved = await getSavedLineupWithSlots(savedLineupId);
    if (saved?.slots?.length) {
      const ordered = [...saved.slots].sort((a, b) => a.slot - b.slot);
      slots = ordered
        .filter((s) => !isDemoId(s.player_id))
        .map((s) => ({ player_id: s.player_id, position: s.position ?? null }));
    }
  }
  if (slots.length === 0) {
    const players = await getPlayers();
    const club = players.filter((p) => !isDemoId(p.id) && isClubRosterPlayer(p));
    slots = club.slice(0, 9).map((p) => ({ player_id: p.id, position: null }));
  }
  if (slots.length > 0) await insertGameLineup(created.id, created.our_side as LineupSide, slots);

  const opp = opponentSlots?.filter((s) => s.player_id && !isDemoId(s.player_id)) ?? [];
  if (opp.length > 0) {
    const opponentSide: LineupSide = created.our_side === "home" ? "away" : "home";
    await insertGameLineup(created.id, opponentSide, opp);
  }
  return created;
}

export async function updateGame(
  id: string,
  updates: Partial<Omit<Game, "id" | "created_at">>
): Promise<Game | null> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(id)) return null;
  const { data } = await supabase.from("games").update(updates).eq("id", id).select().single();
  return data as Game | null;
}

/** Replace one side's lineup for a game. Does not touch the other side. */
export async function replaceGameLineup(
  gameId: string,
  side: LineupSide,
  slots: { player_id: string; position?: string | null }[]
): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(gameId)) return;
  await supabase.from("game_lineups").delete().eq("game_id", gameId).eq("side", side);
  if (slots.length > 0) await insertGameLineup(gameId, side, slots);
}

export async function deleteGame(id: string): Promise<boolean> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(id)) return false;
  const { error } = await supabase.from("games").delete().eq("id", id);
  return !error;
}

export async function insertPlayer(
  player: Omit<Player, "id" | "created_at">
): Promise<Player | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("players").insert(player).select().single();
  if (error) throw new Error(error.message);
  return data as Player | null;
}

export async function updatePlayer(
  id: string,
  updates: Partial<Omit<Player, "id" | "created_at">>
): Promise<Player | null> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(id)) return null;
  const { data, error } = await supabase.from("players").update(updates).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as Player | null;
}

export async function getPlayerDeletionPreview(playerId: string): Promise<PlayerDeletionPreview | null> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(playerId)) return null;
  const [pa, gl, sl] = await Promise.all([
    supabase.from("plate_appearances").select("id", { count: "exact", head: true }).eq("batter_id", playerId),
    supabase.from("game_lineups").select("id", { count: "exact", head: true }).eq("player_id", playerId),
    supabase.from("saved_lineup_slots").select("id", { count: "exact", head: true }).eq("player_id", playerId),
  ]);
  return {
    batterPlateAppearances: pa.count ?? 0,
    gameLineups: gl.count ?? 0,
    savedLineupSlots: sl.count ?? 0,
  };
}

/**
 * Deletes a player when they have no plate appearances as batter.
 * Clears `game_lineups` and `saved_lineup_slots` rows for this player first.
 * Pitching-only PAs (`pitcher_id`) null out automatically; baserunning as runner cascades.
 */
export async function deletePlayer(playerId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(playerId)) return { ok: false, error: "Cannot delete this player." };

  const preview = await getPlayerDeletionPreview(playerId);
  if (!preview) return { ok: false, error: "Could not verify player data." };

  if (preview.batterPlateAppearances > 0) {
    return {
      ok: false,
      error: `This player has ${preview.batterPlateAppearances} plate appearance(s) as batter. Remove or change those PAs in game logs before deleting.`,
    };
  }

  if (preview.gameLineups > 0) {
    const { error: e1 } = await supabase.from("game_lineups").delete().eq("player_id", playerId);
    if (e1) return { ok: false, error: e1.message };
  }
  if (preview.savedLineupSlots > 0) {
    const { error: e2 } = await supabase.from("saved_lineup_slots").delete().eq("player_id", playerId);
    if (e2) return { ok: false, error: e2.message };
  }

  const { error } = await supabase.from("players").delete().eq("id", playerId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Roster batting + last 10 PAs (by `created_at`) for the Players to Watch dashboard card. */
export async function getPlayersToWatchInput(): Promise<PlayerStatsForWatch[]> {
  const supabase = await getSupabase();
  const players = await getPlayers();
  const list = players
    .filter((p) => !isDemoId(p.id))
    .filter((p) => isClubRosterPlayer(p))
    .filter((p) => !isPitcherPlayer(p));
  if (list.length === 0 || !supabase) return [];

  const ids = list.map((p) => p.id);
  const { data } = await supabase
    .from("plate_appearances")
    .select("*")
    .in("batter_id", ids);

  const allPAs = (data ?? []) as PlateAppearance[];
  const byBatter = new Map<string, PlateAppearance[]>();
  for (const pa of allPAs) {
    if (isDemoId(pa.batter_id)) continue;
    const arr = byBatter.get(pa.batter_id) ?? [];
    arr.push(pa);
    byBatter.set(pa.batter_id, arr);
  }
  for (const [bid, arr] of byBatter) {
    arr.sort((a, b) => {
      const ta = a.created_at ?? "";
      const tb = b.created_at ?? "";
      return tb.localeCompare(ta);
    });
    byBatter.set(bid, arr);
  }

  const batting = await getBattingStatsForPlayers(ids);
  const out: PlayerStatsForWatch[] = [];

  for (const p of list) {
    const pas = byBatter.get(p.id) ?? [];
    const season = batting[p.id];
    const recent = pas.slice(0, 10);
    const last10Stats = recent.length > 0 ? battingStatsFromPAs(recent) : null;

    const last10Runs =
      recent.length > 0
        ? recent.reduce((sum, pa) => {
            const ids = pa.runs_scored_player_ids ?? [];
            return sum + ids.filter((id) => id === p.id).length;
          }, 0)
        : 0;

    const last10PA =
      last10Stats && recent.length > 0
        ? {
            avg: last10Stats.avg,
            obp: last10Stats.obp,
            slg: last10Stats.slg,
            ops: last10Stats.ops,
            hits: last10Stats.h ?? 0,
            ab: last10Stats.ab ?? 0,
            hr: last10Stats.hr ?? 0,
            double: last10Stats.double ?? 0,
            triple: last10Stats.triple ?? 0,
            rbi: last10Stats.rbi ?? 0,
            r: last10Runs,
            sb: last10Stats.sb ?? 0,
            strikeouts: last10Stats.so ?? 0,
            paCount: recent.length,
            kRate: kPctToKRate(last10Stats.kPct),
            bbRate: (last10Stats.bbPct ?? 0) * 100,
          }
        : undefined;

    out.push({
      id: p.id,
      name: p.name,
      position: p.positions?.[0] ?? "—",
      pa: season?.pa ?? 0,
      avg: season?.avg ?? 0,
      obp: season?.obp ?? 0,
      slg: season?.slg ?? 0,
      ops: season?.ops ?? 0,
      kRate: kPctToKRate(season?.kPct),
      bbRate: (season?.bbPct ?? 0) * 100,
      last10PA,
    });
  }

  return out;
}
