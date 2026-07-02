"use server";

import { deletePlayer, getPlayerDeletionPreview, insertPlayer, updatePlayer } from "@/lib/db/queries";
import { revalidatePlayersListCache } from "@/lib/db/revalidateLists";
import type { Player, PlayerDeletionPreview } from "@/lib/types";
import { requireAnalystAccess } from "@/lib/auth/requireRole";

export async function insertPlayerAction(player: Omit<Player, "id" | "created_at">): Promise<Player | null> {
  await requireAnalystAccess();
  const created = await insertPlayer(player);
  if (created) revalidatePlayersListCache();
  return created;
}

export async function updatePlayerAction(
  id: string,
  updates: Partial<Omit<Player, "id" | "created_at">>
): Promise<Player | null> {
  await requireAnalystAccess();
  const updated = await updatePlayer(id, updates);
  if (updated) revalidatePlayersListCache();
  return updated;
}

export async function getPlayerDeletionPreviewAction(playerId: string): Promise<PlayerDeletionPreview | null> {
  return getPlayerDeletionPreview(playerId);
}

export async function deletePlayerAction(playerId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAnalystAccess();
  const result = await deletePlayer(playerId);
  if (result.ok) revalidatePlayersListCache();
  return result;
}

export async function getBulkPlayerDeletionPreviewAction(
  playerIds: string[]
): Promise<{ id: string; preview: PlayerDeletionPreview | null }[]> {
  await requireAnalystAccess();
  const unique = [...new Set(playerIds.filter((id) => id?.trim()))];
  return Promise.all(
    unique.map(async (id) => ({ id, preview: await getPlayerDeletionPreview(id) }))
  );
}

export async function deletePlayersAction(playerIds: string[]): Promise<{
  deleted: number;
  archived: number;
  failed: { id: string; error: string }[];
}> {
  await requireAnalystAccess();
  const unique = [...new Set(playerIds.filter((id) => id?.trim()))];
  let deleted = 0;
  let archived = 0;
  const failed: { id: string; error: string }[] = [];

  for (const id of unique) {
    const preview = await getPlayerDeletionPreview(id);
    const result = await deletePlayer(id);
    if (result.ok) {
      if (preview && preview.batterPlateAppearances > 0) archived += 1;
      else deleted += 1;
    } else {
      failed.push({ id, error: result.error });
    }
  }

  if (deleted + archived > 0) revalidatePlayersListCache();
  return { deleted, archived, failed };
}
