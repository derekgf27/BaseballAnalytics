import { isDemoId } from "../mockData";
import type { PlateAppearance, PitchEventDraft } from "@/lib/types";
import { PLATE_APPEARANCE_COLUMNS } from "./columns";
import { getSupabase } from "./client";
import { deleteAllBaserunningEvents, deleteBaserunningEventsByGame } from "./baserunning";
import { insertPitchEventsForPa } from "./pitchEvents";

export async function getPlateAppearancesByGame(gameId: string): Promise<PlateAppearance[]> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(gameId)) return [];
  const { data } = await supabase
    .from("plate_appearances")
    .select(PLATE_APPEARANCE_COLUMNS)
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
  const { data } = await supabase.from("plate_appearances").select(PLATE_APPEARANCE_COLUMNS).in("game_id", clean);
  const rows = (data ?? []) as PlateAppearance[];
  return rows.sort((a, b) => {
    if (a.game_id !== b.game_id) return a.game_id.localeCompare(b.game_id);
    if (a.inning !== b.inning) return a.inning - b.inning;
    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  });
}

/** All lineup rows for many games at once. */

export async function getPlateAppearancesByBatter(batterId: string): Promise<PlateAppearance[]> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(batterId)) return [];
  const { data } = await supabase
    .from("plate_appearances")
    .select(PLATE_APPEARANCE_COLUMNS)
    .eq("batter_id", batterId)
    .order("created_at", { ascending: false });
  return (data ?? []) as PlateAppearance[];
}

export async function getPlateAppearancesByPitcher(pitcherId: string): Promise<PlateAppearance[]> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(pitcherId)) return [];
  const { data } = await supabase
    .from("plate_appearances")
    .select(PLATE_APPEARANCE_COLUMNS)
    .eq("pitcher_id", pitcherId)
    .order("created_at", { ascending: false });
  return (data ?? []) as PlateAppearance[];
}

/** All logged PAs for one batter vs one pitcher (career / prior matchups). */
export async function getPlateAppearancesForBatterVsPitcher(
  batterId: string,
  pitcherId: string
): Promise<PlateAppearance[]> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(batterId) || isDemoId(pitcherId)) return [];
  const { data } = await supabase
    .from("plate_appearances")
    .select(PLATE_APPEARANCE_COLUMNS)
    .eq("batter_id", batterId)
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
    .select(PLATE_APPEARANCE_COLUMNS)
    .in("batter_id", ids)
    .order("created_at", { ascending: false });
  return (data ?? []) as PlateAppearance[];
}

/** Batch fetch PAs where any of the given pitchers were on the mound. */
export async function getPlateAppearancesByPitchers(pitcherIds: string[]): Promise<PlateAppearance[]> {
  const supabase = await getSupabase();
  if (!supabase || pitcherIds.length === 0) return [];
  const ids = pitcherIds.filter((id) => !isDemoId(id));
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("plate_appearances")
    .select(PLATE_APPEARANCE_COLUMNS)
    .in("pitcher_id", ids)
    .order("created_at", { ascending: false });
  return (data ?? []) as PlateAppearance[];
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
  const { data, error } = await supabase
    .from("plate_appearances")
    .insert(payload)
    .select(PLATE_APPEARANCE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as PlateAppearance | null;
}

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
  const { data, error } = await supabase.from("plate_appearances").select(PLATE_APPEARANCE_COLUMNS).eq("id", paId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as PlateAppearance | null;
}

export async function updatePlateAppearanceRow(
  paId: string,
  updates: Partial<
    Pick<
      PlateAppearance,
      | "result"
      | "batted_ball_type"
      | "hit_direction"
      | "error_fielder_id"
      | "base_state"
      | "unearned_runs_scored_player_ids"
    >
  >
): Promise<PlateAppearance | null> {
  const supabase = await getSupabase();
  if (!supabase || !paId || isDemoId(paId)) return null;
  const { data, error } = await supabase
    .from("plate_appearances")
    .update(updates)
    .eq("id", paId)
    .select(PLATE_APPEARANCE_COLUMNS)
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
