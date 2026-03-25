"use server";

import type { BaserunningEvent, BaserunningEventInsert, PlateAppearance } from "@/lib/types";
import {
  getPlateAppearancesByGame,
  getGameLineup,
  insertPlateAppearance,
  deletePlateAppearance as deletePlateAppearanceQuery,
  getBaserunningEventsForGame,
  insertBaserunningEvent,
  deleteBaserunningEvent,
} from "@/lib/db/queries";

export async function fetchPAsForGame(gameId: string): Promise<PlateAppearance[]> {
  return getPlateAppearancesByGame(gameId);
}

function lineupSlotsToOrder(
  slots: Awaited<ReturnType<typeof getGameLineup>>
): { order: string[]; positionByPlayerId: Record<string, string> } {
  const sorted = [...slots].sort((a, b) => a.slot - b.slot);
  const order = sorted.map((s) => s.player_id);
  const positionByPlayerId: Record<string, string> = {};
  for (const s of sorted) {
    if (s.position?.trim()) positionByPlayerId[s.player_id] = s.position.trim();
  }
  return { order, positionByPlayerId };
}

/** Home and away lineups for the game (used by Record PAs for both teams). */
export async function fetchGameLineupOrder(gameId: string): Promise<{
  away: { order: string[]; positionByPlayerId: Record<string, string> };
  home: { order: string[]; positionByPlayerId: Record<string, string> };
}> {
  const slots = await getGameLineup(gameId);
  return {
    away: lineupSlotsToOrder(slots.filter((s) => s.side === "away")),
    home: lineupSlotsToOrder(slots.filter((s) => s.side === "home")),
  };
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

export async function fetchBaserunningEventsForGame(gameId: string): Promise<BaserunningEvent[]> {
  return getBaserunningEventsForGame(gameId);
}

export async function saveBaserunningEventAction(
  row: BaserunningEventInsert
): Promise<{ ok: boolean; error?: string; event?: BaserunningEvent }> {
  try {
    const event = await insertBaserunningEvent(row);
    return { ok: !!event, event: event ?? undefined };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message || "Failed to save" };
  }
}

export async function deleteBaserunningEventAction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const ok = await deleteBaserunningEvent(id);
    return { ok };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete" };
  }
}
