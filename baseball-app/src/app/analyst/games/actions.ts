"use server";

import {
  createGameWithLineup,
  updateGame,
  replaceGameLineup,
  getGameLineup,
  getGame,
  getSavedLineups,
  getSavedLineupWithSlots,
  getPlayers,
  deleteGame as deleteGameQuery,
  deletePlateAppearancesByGame,
  deleteAllPlateAppearances,
  getPlateAppearanceById,
  updatePlateAppearanceRow,
} from "@/lib/db/queries";
import { normBaseState } from "@/lib/compute/battingStats";
import { isDemoId } from "@/lib/db/mockData";
import { RESULT_ALLOWS_HIT_DIRECTION } from "@/lib/paResultSets";
import type {
  BaseState,
  BattedBallType,
  Game,
  HitDirection,
  LineupSide,
  PAResult,
  PlateAppearance,
} from "@/lib/types";

const VALID_BASE_STATES = new Set<BaseState>([
  "000",
  "100",
  "010",
  "001",
  "110",
  "101",
  "011",
  "111",
]);

const VALID_HIT_DIRECTIONS = new Set<HitDirection>(["pulled", "up_the_middle", "opposite_field"]);

export async function createGameWithLineupAction(
  game: Omit<Game, "id" | "created_at">,
  savedLineupId?: string | null,
  opponentSlots?: { player_id: string; position?: string | null }[] | null,
  ourSlotsOverride?: { player_id: string; position?: string | null }[] | null
): Promise<Game> {
  return createGameWithLineup(game, savedLineupId, opponentSlots, ourSlotsOverride);
}

/** Replace our club’s lineup for an existing game (e.g. after editing in the lineup modal). */
export async function replaceOurGameLineupAction(
  gameId: string,
  slots: { player_id: string; position?: string | null }[]
): Promise<boolean> {
  const game = await getGame(gameId);
  if (!game || !slots.length) return false;
  await replaceGameLineup(gameId, game.our_side as LineupSide, slots);
  return true;
}

/** Update game metadata only (no lineup change). Used from games table UI. */
export async function updateGameOnlyAction(
  id: string,
  updates: Partial<Omit<Game, "id" | "created_at">>
): Promise<Game | null> {
  return updateGame(id, updates);
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
  if (slots.length > 0) await replaceGameLineup(gameId, game.our_side as "home" | "away", slots);
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
  const game = await getGame(gameId);
  const slots = (await getGameLineup(gameId)).filter((s) => s.side === game?.our_side);
  return [...slots].sort((a, b) => a.slot - b.slot).map((s) => ({
    slot: s.slot,
    player_id: s.player_id,
    position: s.position ?? null,
  }));
}

/** Clear all plate appearances for one game. Returns count deleted. */
export async function clearPAsForGameAction(gameId: string): Promise<{ ok: boolean; count: number; error?: string }> {
  if (isDemoId(gameId)) return { ok: false, count: 0, error: "Cannot clear demo game." };
  try {
    const count = await deletePlateAppearancesByGame(gameId);
    return { ok: true, count };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to clear PAs";
    return { ok: false, count: 0, error: message };
  }
}

/** Clear all plate appearances (all stats). Returns count deleted. */
export async function clearAllStatsAction(): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const count = await deleteAllPlateAppearances();
    return { ok: true, count };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to clear stats";
    return { ok: false, count: 0, error: message };
  }
}

/** Correct result / batted-ball / bases / spray direction from Game log without opening Record. */
export async function updateGameLogPlateAppearanceAction(
  gameId: string,
  paId: string,
  patch: {
    result?: PAResult;
    batted_ball_type?: BattedBallType | null;
    base_state?: BaseState;
    hit_direction?: HitDirection | null;
  }
): Promise<{ ok: boolean; error?: string; pa?: PlateAppearance }> {
  if (isDemoId(gameId) || isDemoId(paId)) {
    return { ok: false, error: "Cannot edit demo game plate appearances." };
  }
  if (
    patch.result === undefined &&
    patch.batted_ball_type === undefined &&
    patch.base_state === undefined &&
    patch.hit_direction === undefined
  ) {
    return { ok: true };
  }
  try {
    const row = await getPlateAppearanceById(paId);
    if (!row || row.game_id !== gameId) {
      return { ok: false, error: "Plate appearance not found for this game." };
    }

    let effectiveResult: PAResult = row.result;
    const updates: Partial<
      Pick<
        PlateAppearance,
        "result" | "batted_ball_type" | "hit_direction" | "error_fielder_id" | "base_state"
      >
    > = {};

    if (patch.result !== undefined) {
      effectiveResult = patch.result;
      updates.result = patch.result;
      if (!RESULT_ALLOWS_HIT_DIRECTION.has(patch.result)) {
        updates.batted_ball_type = null;
        updates.hit_direction = null;
        if (patch.result !== "reached_on_error") {
          updates.error_fielder_id = null;
        }
      }
    }

    if (patch.batted_ball_type !== undefined) {
      if (!RESULT_ALLOWS_HIT_DIRECTION.has(effectiveResult)) {
        return {
          ok: false,
          error: "Batted ball type only applies to balls-in-play results for this row.",
        };
      }
      updates.batted_ball_type = patch.batted_ball_type;
    }

    if (patch.base_state !== undefined) {
      const normalized = normBaseState(patch.base_state);
      if (!VALID_BASE_STATES.has(normalized)) {
        return { ok: false, error: "Invalid base state." };
      }
      updates.base_state = normalized;
    }

    if (patch.hit_direction !== undefined) {
      if (!RESULT_ALLOWS_HIT_DIRECTION.has(effectiveResult)) {
        return {
          ok: false,
          error: "Hit direction only applies to balls-in-play results for this row.",
        };
      }
      if (
        patch.hit_direction !== null &&
        !VALID_HIT_DIRECTIONS.has(patch.hit_direction)
      ) {
        return { ok: false, error: "Invalid hit direction." };
      }
      updates.hit_direction = patch.hit_direction;
    }

    if (Object.keys(updates).length === 0) return { ok: true };

    const updated = await updatePlateAppearanceRow(paId, updates);
    return { ok: true, pa: updated ?? undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed" };
  }
}
