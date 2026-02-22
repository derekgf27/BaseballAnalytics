/**
 * Data access: fetch events, players, games, ratings. Write PAs and overrides.
 * No mock data — uses only Supabase.
 */

import { battingStatsFromPAs } from "@/lib/compute/battingStats";
import { supabase } from "./client";
import { isDemoId } from "./mockData";
import type { BattingStats, BattingStatsWithSplits, PlateAppearance, Player, Game, PlayerRating, DefensiveEvent, GameLineupSlot, SavedLineup, SavedLineupWithSlots } from "@/lib/types";

export async function getGames(): Promise<Game[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("games").select("*").order("date", { ascending: false });
  return (data ?? []) as Game[];
}

export async function getPlayers(): Promise<Player[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("players").select("*").order("name");
  return (data ?? []) as Player[];
}

export async function getPlayersByIds(ids: string[]): Promise<Player[]> {
  if (!supabase || ids.length === 0) return [];
  const { data } = await supabase
    .from("players")
    .select("*")
    .in("id", ids);
  return (data ?? []) as Player[];
}

export async function getGameLineup(gameId: string): Promise<GameLineupSlot[]> {
  if (!supabase || isDemoId(gameId)) return [];
  const { data } = await supabase
    .from("game_lineups")
    .select("game_id, slot, player_id, position")
    .eq("game_id", gameId)
    .order("slot", { ascending: true });
  return (data ?? []) as GameLineupSlot[];
}

/** Insert lineup for a game. slots: in order (slot 1, 2, …); each may have position for this game. */
export async function insertGameLineup(
  gameId: string,
  slots: { player_id: string; position?: string | null }[]
): Promise<void> {
  if (!supabase || isDemoId(gameId) || slots.length === 0) return;
  const rows = slots.map((s, i) => ({
    game_id: gameId,
    slot: i + 1,
    player_id: s.player_id,
    position: s.position ?? null,
  }));
  await supabase.from("game_lineups").insert(rows);
}

export async function getSavedLineups(): Promise<SavedLineup[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("saved_lineups")
    .select("id, name, created_at")
    .order("name");
  return (data ?? []) as SavedLineup[];
}

export async function getSavedLineupWithSlots(id: string): Promise<SavedLineupWithSlots | null> {
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
  if (!supabase) return;
  await supabase.from("saved_lineup_slots").delete().eq("lineup_id", id);
  await supabase.from("saved_lineups").delete().eq("id", id);
}

export async function getPlateAppearancesByGame(gameId: string): Promise<PlateAppearance[]> {
  if (!supabase || isDemoId(gameId)) return [];
  const { data } = await supabase
    .from("plate_appearances")
    .select("*")
    .eq("game_id", gameId)
    .order("inning")
    .order("created_at");
  return (data ?? []) as PlateAppearance[];
}

export async function getPlateAppearancesByBatter(batterId: string): Promise<PlateAppearance[]> {
  if (!supabase || isDemoId(batterId)) return [];
  const { data } = await supabase
    .from("plate_appearances")
    .select("*")
    .eq("batter_id", batterId)
    .order("created_at", { ascending: false });
  return (data ?? []) as PlateAppearance[];
}

/** Fetch all PAs for the given batters (for trend: group by batter_id, take last N per player). */
export async function getPlateAppearancesByBatters(batterIds: string[]): Promise<PlateAppearance[]> {
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
  if (!supabase || isDemoId(gameId)) return [];
  const { data } = await supabase
    .from("defensive_events")
    .select("*")
    .eq("game_id", gameId)
    .order("created_at");
  return (data ?? []) as DefensiveEvent[];
}

export async function getPlayerRating(playerId: string): Promise<PlayerRating | null> {
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

  const result: Record<string, BattingStats> = {};
  for (const playerId of playerIds) {
    const pas = byBatter.get(playerId) ?? [];
    const stats = battingStatsFromPAs(pas);
    if (stats) {
      stats.r = runsByPlayer[playerId] ?? 0;
      result[playerId] = stats;
    }
  }
  return result;
}

/** Same as getBattingStatsForPlayers but also returns vs LHP / vs RHP splits (by pitcher_hand on PAs). */
export async function getBattingStatsWithSplitsForPlayers(
  playerIds: string[]
): Promise<Record<string, BattingStatsWithSplits>> {
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

  const result: Record<string, BattingStatsWithSplits> = {};
  for (const playerId of playerIds) {
    const pas = byBatter.get(playerId) ?? [];
    const pasVsL = pas.filter((pa) => pa.pitcher_hand === "L");
    const pasVsR = pas.filter((pa) => pa.pitcher_hand === "R");

    const overall = battingStatsFromPAs(pas);
    if (!overall) continue;
    overall.r = runsByPlayer[playerId] ?? 0;

    const vsLStats = pasVsL.length > 0 ? battingStatsFromPAs(pasVsL) : null;
    if (vsLStats) vsLStats.r = runsVsL[playerId] ?? 0;

    const vsRStats = pasVsR.length > 0 ? battingStatsFromPAs(pasVsR) : null;
    if (vsRStats) vsRStats.r = runsVsR[playerId] ?? 0;

    result[playerId] = { overall, vsL: vsLStats, vsR: vsRStats };
  }
  return result;
}

export async function upsertPlayerRating(
  playerId: string,
  ratings: { contact_reliability: number; damage_potential: number; decision_quality: number; defense_trust: number },
  overriddenBy: string
): Promise<void> {
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
  if (!supabase) return null;
  const payload = { ...pa };
  for (const key of Object.keys(payload) as (keyof typeof payload)[]) {
    if (payload[key] === undefined) delete payload[key];
  }
  const { data, error } = await supabase.from("plate_appearances").insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data as PlateAppearance | null;
}

export async function deletePlateAppearance(paId: string): Promise<boolean> {
  if (!supabase || !paId) return false;
  const { error } = await supabase.from("plate_appearances").delete().eq("id", paId);
  return !error;
}

export async function getGame(id: string): Promise<Game | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("games").select("*").eq("id", id).single();
  return data as Game | null;
}

export async function insertGame(
  game: Omit<Game, "id" | "created_at">
): Promise<Game | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("games").insert(game).select().single();
  return data as Game | null;
}

/** Create a game and assign a lineup. If savedLineupId is provided, use that template; else use first 9 players. */
export async function createGameWithLineup(
  game: Omit<Game, "id" | "created_at">,
  savedLineupId?: string | null
): Promise<Game | null> {
  const created = await insertGame(game);
  if (!created) return null;
  let slots: { player_id: string; position?: string | null }[] = [];
  if (savedLineupId && !isDemoId(savedLineupId)) {
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
    slots = players
      .slice(0, 9)
      .filter((p) => !isDemoId(p.id))
      .map((p) => ({ player_id: p.id, position: null }));
  }
  if (slots.length > 0) await insertGameLineup(created.id, slots);
  return created;
}

export async function updateGame(
  id: string,
  updates: Partial<Omit<Game, "id" | "created_at">>
): Promise<Game | null> {
  if (!supabase || isDemoId(id)) return null;
  const { data } = await supabase.from("games").update(updates).eq("id", id).select().single();
  return data as Game | null;
}

/** Replace the game's lineup. slots: in order (slot 1, 2, …); each may have position for this game. */
export async function replaceGameLineup(
  gameId: string,
  slots: { player_id: string; position?: string | null }[]
): Promise<void> {
  if (!supabase || isDemoId(gameId)) return;
  await supabase.from("game_lineups").delete().eq("game_id", gameId);
  if (slots.length > 0) await insertGameLineup(gameId, slots);
}

export async function deleteGame(id: string): Promise<boolean> {
  if (!supabase || isDemoId(id)) return false;
  const { error } = await supabase.from("games").delete().eq("id", id);
  return !error;
}

export async function insertPlayer(
  player: Omit<Player, "id" | "created_at">
): Promise<Player | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("players").insert(player).select().single();
  if (error) throw new Error(error.message);
  return data as Player | null;
}

export async function updatePlayer(
  id: string,
  updates: Partial<Omit<Player, "id" | "created_at">>
): Promise<Player | null> {
  if (!supabase || isDemoId(id)) return null;
  const { data, error } = await supabase.from("players").update(updates).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as Player | null;
}
