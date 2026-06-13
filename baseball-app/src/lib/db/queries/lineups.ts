import { isDemoId } from "../mockData";
import type { GameLineupSlot, LineupSide, SavedLineup, SavedLineupWithSlots } from "@/lib/types";
import { getSupabase } from "./client";

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
  const { error } = await supabase.from("game_lineups").insert(rows);
  if (error) throw new Error(`Game lineup insert failed: ${error.message}`);
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
    .select("id, name, created_at")
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

