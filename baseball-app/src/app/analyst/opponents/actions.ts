"use server";

import { getCachedGames } from "@/lib/db/cachedQueries";
import {
  deleteTrackedOpponent,
  insertTrackedOpponent,
  renameOpponentAcrossData,
  updateTrackedOpponent,
} from "@/lib/db/queries";
import {
  revalidateGamesListCache,
  revalidatePlayersListCache,
  revalidateTrackedOpponentsCache,
} from "@/lib/db/revalidateLists";
import { opponentNameKey, uniqueOpponentNames } from "@/lib/opponentUtils";
import { requireWritableAnalystAccess } from "@/lib/auth/requireRole";

export async function addTrackedOpponentAction(name: string): Promise<{ ok: boolean; error?: string }> {
  await requireWritableAnalystAccess();
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
  await requireWritableAnalystAccess();
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
  await requireWritableAnalystAccess();
  const result = await deleteTrackedOpponent(id);
  if (result.ok) revalidateTrackedOpponentsCache();
  return result;
}

export async function renameOpponentAction(
  originalName: string,
  newName: string
): Promise<{ ok: boolean; error?: string }> {
  await requireWritableAnalystAccess();
  const result = await renameOpponentAcrossData(originalName, newName);
  if (result.ok) {
    revalidateGamesListCache();
    revalidatePlayersListCache();
    revalidateTrackedOpponentsCache();
  }
  return result;
}
