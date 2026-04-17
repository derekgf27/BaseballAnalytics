"use server";

import { deletePlayer, getPlayerDeletionPreview, insertPlayer, updatePlayer } from "@/lib/db/queries";
import type { Player, PlayerDeletionPreview } from "@/lib/types";

export async function insertPlayerAction(player: Omit<Player, "id" | "created_at">): Promise<Player | null> {
  return insertPlayer(player);
}

export async function updatePlayerAction(
  id: string,
  updates: Partial<Omit<Player, "id" | "created_at">>
): Promise<Player | null> {
  return updatePlayer(id, updates);
}

export async function getPlayerDeletionPreviewAction(playerId: string): Promise<PlayerDeletionPreview | null> {
  return getPlayerDeletionPreview(playerId);
}

export async function deletePlayerAction(playerId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return deletePlayer(playerId);
}
