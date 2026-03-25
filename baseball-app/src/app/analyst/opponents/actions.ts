"use server";

import {
  deleteTrackedOpponent,
  getGames,
  insertTrackedOpponent,
  updateTrackedOpponent,
} from "@/lib/db/queries";
import { opponentNameKey, uniqueOpponentNames } from "@/lib/opponentUtils";

export async function addTrackedOpponentAction(name: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return { ok: false, error: "Enter a team name." };

  const games = await getGames();
  const fromGames = uniqueOpponentNames(games);
  if (fromGames.some((n) => opponentNameKey(n) === opponentNameKey(trimmed))) {
    return { ok: false, error: "That team is already listed from your games." };
  }

  return insertTrackedOpponent(trimmed);
}

export async function updateTrackedOpponentAction(
  id: string,
  newName: string
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = newName.trim().replace(/\s+/g, " ");
  if (!trimmed) return { ok: false, error: "Enter a team name." };

  const games = await getGames();
  const fromGames = uniqueOpponentNames(games);
  if (fromGames.some((n) => opponentNameKey(n) === opponentNameKey(trimmed))) {
    return { ok: false, error: "That team is already listed from your games." };
  }

  return updateTrackedOpponent(id, trimmed);
}

export async function deleteTrackedOpponentAction(id: string): Promise<{ ok: boolean; error?: string }> {
  return deleteTrackedOpponent(id);
}
