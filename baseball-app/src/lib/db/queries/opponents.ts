import { getSupabase } from "./client";
import type { TrackedOpponentRow } from "./types";

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

