"use server";

import { deletePlayer, getPlayerDeletionPreview, insertPlayer, updatePlayer } from "@/lib/db/queries";
import { revalidatePlayersListCache } from "@/lib/db/revalidateLists";
import type { Player, PlayerDeletionPreview } from "@/lib/types";

export async function insertPlayerAction(player: Omit<Player, "id" | "created_at">): Promise<Player | null> {
  const created = await insertPlayer(player);
  if (created) revalidatePlayersListCache();
  return created;
}

export async function updatePlayerAction(
  id: string,
  updates: Partial<Omit<Player, "id" | "created_at">>
): Promise<Player | null> {
  const updated = await updatePlayer(id, updates);
  if (updated) revalidatePlayersListCache();
  return updated;
}

export async function getPlayerDeletionPreviewAction(playerId: string): Promise<PlayerDeletionPreview | null> {
  return getPlayerDeletionPreview(playerId);
}

export async function deletePlayerAction(playerId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await deletePlayer(playerId);
  if (result.ok) revalidatePlayersListCache();
  return result;
}
