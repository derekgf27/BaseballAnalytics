"use server";

import {
  createGameWithLineup,
  updateGame,
  replaceGameLineup,
  getGameLineup,
  getSavedLineups,
  getSavedLineupWithSlots,
  getPlayers,
  deleteGame as deleteGameQuery,
} from "@/lib/db/queries";
import { isDemoId } from "@/lib/db/mockData";
import type { Game } from "@/lib/types";

export async function createGameWithLineupAction(
  game: Omit<Game, "id" | "created_at">,
  savedLineupId?: string | null
): Promise<Game | null> {
  return createGameWithLineup(game, savedLineupId);
}

/** Update game and optionally replace its lineup. lineupId: "__keep__" = no change, "__default__" = first 9, or saved template id. */
export async function updateGameWithLineupAction(
  gameId: string,
  game: Omit<Game, "id" | "created_at">,
  lineupId: string | null
): Promise<Game | null> {
  const updated = await updateGame(gameId, game);
  if (!updated) return null;
  if (lineupId === "__keep__" || lineupId === "" || lineupId == null) return updated;
  let slots: { player_id: string; position?: string | null }[] = [];
  if (lineupId === "__default__") {
    const players = await getPlayers();
    slots = players
      .slice(0, 9)
      .filter((p) => !isDemoId(p.id))
      .map((p) => ({ player_id: p.id, position: null }));
  } else if (lineupId && !isDemoId(lineupId)) {
    const saved = await getSavedLineupWithSlots(lineupId);
    if (saved?.slots?.length) {
      const ordered = [...saved.slots].sort((a, b) => a.slot - b.slot);
      slots = ordered
        .filter((s) => !isDemoId(s.player_id))
        .map((s) => ({ player_id: s.player_id, position: s.position ?? null }));
    }
  }
  if (slots.length > 0) await replaceGameLineup(gameId, slots);
  return updated;
}

export async function deleteGameAction(gameId: string): Promise<boolean> {
  return deleteGameQuery(gameId);
}

/** Resolve the game's current lineup to a display name (matched saved template name or "Current lineup"). */
export async function fetchCurrentGameLineupName(gameId: string): Promise<string> {
  const gameSlots = await getGameLineup(gameId);
  const gameOrder = gameSlots.sort((a, b) => a.slot - b.slot).map((s) => s.player_id);
  if (gameOrder.length === 0) return "Current lineup";
  const saved = await getSavedLineups();
  for (const lineup of saved) {
    const withSlots = await getSavedLineupWithSlots(lineup.id);
    if (!withSlots?.slots?.length) continue;
    const savedOrder = [...withSlots.slots].sort((a, b) => a.slot - b.slot).map((s) => s.player_id);
    if (savedOrder.length === gameOrder.length && savedOrder.every((id, i) => id === gameOrder[i]))
      return lineup.name;
  }
  return "Current lineup";
}

/** Fetch game's current lineup slots for the review modal (when "Keep" is selected). */
export async function fetchGameLineupSlots(
  gameId: string
): Promise<{ slot: number; player_id: string; position?: string | null }[]> {
  const slots = await getGameLineup(gameId);
  return [...slots].sort((a, b) => a.slot - b.slot).map((s) => ({
    slot: s.slot,
    player_id: s.player_id,
    position: s.position ?? null,
  }));
}
