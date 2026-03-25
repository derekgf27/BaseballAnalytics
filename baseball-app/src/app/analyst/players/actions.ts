"use server";

import { insertPlayer, updatePlayer } from "@/lib/db/queries";
import type { Player } from "@/lib/types";

export async function insertPlayerAction(player: Omit<Player, "id" | "created_at">): Promise<Player | null> {
  return insertPlayer(player);
}

export async function updatePlayerAction(
  id: string,
  updates: Partial<Omit<Player, "id" | "created_at">>
): Promise<Player | null> {
  return updatePlayer(id, updates);
}
