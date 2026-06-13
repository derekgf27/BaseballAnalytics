import { getSupabase } from "./client";
import { isDemoId } from "../mockData";
import { BASERUNNING_EVENT_COLUMNS } from "./columns";
import type { BaserunningEvent, BaserunningEventInsert } from "@/lib/types";

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
    .select(BASERUNNING_EVENT_COLUMNS)
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
  const { data, error } = await supabase
    .from("baserunning_events")
    .insert(payload)
    .select(BASERUNNING_EVENT_COLUMNS)
    .single();
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

export async function getBaserunningEventsForGames(gameIds: string[]): Promise<BaserunningEvent[]> {
  const supabase = await getSupabase();
  if (!supabase || gameIds.length === 0) return [];
  const clean = gameIds.filter((id) => !isDemoId(id));
  if (clean.length === 0) return [];
  const { data } = await supabase.from("baserunning_events").select(BASERUNNING_EVENT_COLUMNS).in("game_id", clean);
  const rows = (data ?? []) as BaserunningEvent[];
  return rows.sort((a, b) => {
    if (a.game_id !== b.game_id) return a.game_id.localeCompare(b.game_id);
    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  });
}

/** Spray-chart rows for games (includes inning_half for filtering to one team's PAs; pitcher_id for opponent pitching spray). */

