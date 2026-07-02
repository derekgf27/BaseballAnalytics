import {
  opponentLineupSide,
  opponentNameKey,
  opponentTeamName,
  uniqueOpponentNames,
} from "@/lib/opponentUtils";
import { getSupabase } from "./client";
import { getGames, updateGame } from "./games";
import { getPlayers, updatePlayer } from "./players";
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

/**
 * Rename an opponent everywhere it appears: games (opponent slot), player tags, and tracked_opponents.
 */
export async function renameOpponentAcrossData(
  oldName: string,
  newName: string
): Promise<{ ok: boolean; error?: string }> {
  const oldTrim = oldName.trim().replace(/\s+/g, " ");
  const newTrim = newName.trim().replace(/\s+/g, " ");
  if (!newTrim) return { ok: false, error: "Enter a team name." };

  const oldKey = opponentNameKey(oldTrim);
  const newKey = opponentNameKey(newTrim);
  if (oldKey === newKey) return { ok: true };

  const [games, players, tracked] = await Promise.all([
    getGames(),
    getPlayers(),
    getTrackedOpponents(),
  ]);

  const gameNames = uniqueOpponentNames(games);
  const hasOldInGames = gameNames.some((n) => opponentNameKey(n) === oldKey);
  const hasNewInGames = gameNames.some((n) => opponentNameKey(n) === newKey);
  if (hasNewInGames && !hasOldInGames) {
    return {
      ok: false,
      error: "That name is already used by another opponent on your schedule.",
    };
  }

  const trackedWithNew = tracked.find((t) => opponentNameKey(t.name) === newKey);
  const trackedWithOld = tracked.find((t) => opponentNameKey(t.name) === oldKey);
  if (
    trackedWithNew &&
    trackedWithOld &&
    trackedWithNew.id !== trackedWithOld.id
  ) {
    const drop = await deleteTrackedOpponent(trackedWithOld.id);
    if (!drop.ok) return drop;
  } else if (trackedWithNew && !trackedWithOld && !hasOldInGames) {
    return { ok: false, error: "That opponent name is already saved." };
  }

  for (const game of games) {
    if (opponentNameKey(opponentTeamName(game)) !== oldKey) continue;
    const side = opponentLineupSide(game);
    const updates = side === "away" ? { away_team: newTrim } : { home_team: newTrim };
    await updateGame(game.id, updates);
  }

  for (const player of players) {
    const tag = player.opponent_team?.trim();
    if (!tag || opponentNameKey(tag) !== oldKey) continue;
    await updatePlayer(player.id, { opponent_team: newTrim });
  }

  const trackedAfter = await getTrackedOpponents();
  for (const row of trackedAfter) {
    if (opponentNameKey(row.name) !== oldKey) continue;
    const clash = trackedAfter.find(
      (t) => t.id !== row.id && opponentNameKey(t.name) === newKey
    );
    if (clash) {
      const drop = await deleteTrackedOpponent(row.id);
      if (!drop.ok) return drop;
    } else {
      const updated = await updateTrackedOpponent(row.id, newTrim);
      if (!updated.ok) return updated;
    }
  }

  return { ok: true };
}

