"use server";

import { getGameLineup, getSavedLineupWithSlots, replaceGameLineup, deleteSavedLineup } from "@/lib/db/queries";
import { isDemoId } from "@/lib/db/mockData";
import type { LineupSide } from "@/lib/types";

/** Fetch one side's lineup for a game (coach edit view). */
export async function fetchGameLineupForCoach(
  gameId: string,
  side: LineupSide
): Promise<{ slot: number; player_id: string; position: string | null }[]> {
  if (isDemoId(gameId)) return [];
  const rows = (await getGameLineup(gameId)).filter((s) => s.side === side);
  const bySlot = new Map<number, (typeof rows)[0]>();
  for (const s of rows) {
    bySlot.set(s.slot, s);
  }
  return [...bySlot.values()]
    .sort((a, b) => a.slot - b.slot)
    .map((s) => ({
      slot: s.slot,
      player_id: s.player_id,
      position: s.position ?? null,
    }));
}

/** Save one side's lineup for a game from coach page. */
export async function saveGameLineupForCoachAction(
  gameId: string,
  side: LineupSide,
  slots: { player_id: string; position?: string | null }[]
): Promise<{ ok: boolean; error?: string }> {
  if (isDemoId(gameId)) return { ok: false, error: "Cannot edit demo game." };
  try {
    await replaceGameLineup(gameId, side, slots);
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save lineup";
    return { ok: false, error: message };
  }
}

/** Load a saved template's slots (for coach to apply to current game). */
export async function fetchSavedLineupSlotsForCoach(
  lineupId: string
): Promise<{ slot: number; player_id: string; position: string | null }[]> {
  if (isDemoId(lineupId)) return [];
  const saved = await getSavedLineupWithSlots(lineupId);
  if (!saved?.slots?.length) return [];
  return [...saved.slots].sort((a, b) => a.slot - b.slot).map((s) => ({
    slot: s.slot,
    player_id: s.player_id,
    position: s.position ?? null,
  }));
}

/** Delete a saved lineup template (from coach page). */
export async function deleteSavedLineupForCoach(id: string): Promise<void> {
  if (isDemoId(id)) return;
  await deleteSavedLineup(id);
}
