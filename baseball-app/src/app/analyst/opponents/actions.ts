"use server";

import { getCachedGames } from "@/lib/db/cachedQueries";
import {
  deleteTrackedOpponent,
  insertTrackedOpponent,
  updateTrackedOpponent,
} from "@/lib/db/queries";
import { revalidateTrackedOpponentsCache } from "@/lib/db/revalidateLists";
import { opponentNameKey, uniqueOpponentNames } from "@/lib/opponentUtils";

export async function addTrackedOpponentAction(name: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return { ok: false, error: "Enter a team name." };

  const games = await getCachedGames();
  const fromGames = uniqueOpponentNames(games);
  if (fromGames.some((n) => opponentNameKey(n) === opponentNameKey(trimmed))) {
    return { ok: false, error: "That team is already listed from your games." };
  }

  const result = await insertTrackedOpponent(trimmed);
  if (result.ok) revalidateTrackedOpponentsCache();
  return result;
}

export async function updateTrackedOpponentAction(
  id: string,
  newName: string
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = newName.trim().replace(/\s+/g, " ");
  if (!trimmed) return { ok: false, error: "Enter a team name." };

  const games = await getCachedGames();
  const fromGames = uniqueOpponentNames(games);
  if (fromGames.some((n) => opponentNameKey(n) === opponentNameKey(trimmed))) {
    return { ok: false, error: "That team is already listed from your games." };
  }

  const result = await updateTrackedOpponent(id, trimmed);
  if (result.ok) revalidateTrackedOpponentsCache();
  return result;
}

export async function deleteTrackedOpponentAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const result = await deleteTrackedOpponent(id);
  if (result.ok) revalidateTrackedOpponentsCache();
  return result;
}
