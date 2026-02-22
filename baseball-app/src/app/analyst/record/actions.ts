"use server";

import type { PlateAppearance } from "@/lib/types";
import {
  getPlateAppearancesByGame,
  getGameLineup,
  getPlayers,
  insertPlateAppearance,
  deletePlateAppearance as deletePlateAppearanceQuery,
} from "@/lib/db/queries";

export async function fetchPAsForGame(gameId: string): Promise<PlateAppearance[]> {
  return getPlateAppearancesByGame(gameId);
}

export async function fetchGameLineupOrder(
  gameId: string
): Promise<{ order: string[]; positionByPlayerId: Record<string, string> }> {
  const slots = await getGameLineup(gameId);
  const sorted = slots.sort((a, b) => a.slot - b.slot);
  const order = sorted.map((s) => s.player_id);
  const positionByPlayerId: Record<string, string> = {};
  for (const s of sorted) {
    if (s.position?.trim()) positionByPlayerId[s.player_id] = s.position.trim();
  }
  return { order, positionByPlayerId };
}

export async function savePlateAppearance(
  pa: Omit<PlateAppearance, "id" | "created_at">
): Promise<{ ok: boolean; error?: string }> {
  try {
    const inserted = await insertPlateAppearance(pa);
    return { ok: !!inserted };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message || "Failed to save" };
  }
}

export async function deletePlateAppearanceAction(
  paId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const ok = await deletePlateAppearanceQuery(paId);
    return { ok };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete" };
  }
}
