"use server";

import type {
  BaserunningEvent,
  BaserunningEventInsert,
  LineupSide,
  PitchEvent,
  PitchEventDraft,
  PlateAppearance,
} from "@/lib/types";
import {
  getPlateAppearancesByGame,
  getGameLineup,
  insertPlateAppearance,
  insertPlateAppearanceWithPitchLog,
  getPitchEventsForGame,
  deletePlateAppearance as deletePlateAppearanceQuery,
  getBaserunningEventsForGame,
  insertBaserunningEvent,
  deleteBaserunningEvent,
  replaceGameLineup,
  updateGame,
  linkPitchTrackerGroupToPlateAppearance,
} from "@/lib/db/queries";
import { isDemoId } from "@/lib/db/mockData";

export async function fetchPAsForGame(gameId: string): Promise<{
  pas: PlateAppearance[];
  pitchEvents: PitchEvent[];
}> {
  const [pas, pitchEvents] = await Promise.all([
    getPlateAppearancesByGame(gameId),
    getPitchEventsForGame(gameId),
  ]);
  return { pas, pitchEvents };
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
  pa: Omit<PlateAppearance, "id" | "created_at">,
  pitchLog?: PitchEventDraft[]
): Promise<{ ok: boolean; error?: string; pa?: PlateAppearance }> {
  try {
    const log = pitchLog?.filter(Boolean) ?? [];
    const inserted =
      log.length > 0
        ? await insertPlateAppearanceWithPitchLog(pa, log)
        : await insertPlateAppearance(pa);
    return { ok: !!inserted, pa: inserted ?? undefined };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message || "Failed to save" };
  }
}

/** Attach live pitch-tracker rows to a saved plate appearance. */
export async function linkPitchTrackerGroupToPaAction(
  trackerGroupId: string,
  paId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!trackerGroupId?.trim() || !paId?.trim()) {
    return { ok: false, error: "Missing tracker group or PA id" };
  }
  if (isDemoId(paId)) return { ok: true };
  try {
    await linkPitchTrackerGroupToPlateAppearance(trackerGroupId, paId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to link pitches" };
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

/** Replace one side's lineup while recording PAs (pinch subs, defensive switches). */
export async function saveRecordGameLineupAction(
  gameId: string,
  side: LineupSide,
  slots: { player_id: string; position?: string | null }[]
): Promise<{ ok: boolean; error?: string }> {
  if (isDemoId(gameId)) return { ok: false, error: "Cannot edit demo game." };
  try {
    await replaceGameLineup(gameId, side, slots);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save lineup" };
  }
}

/** Set final score snapshot for a game ("Finalize game"). */
export async function finalizeGameScoreAction(
  gameId: string,
  finalHome: number,
  finalAway: number
): Promise<{ ok: boolean; error?: string }> {
  if (isDemoId(gameId)) return { ok: false, error: "Cannot finalize demo game." };
  try {
    await updateGame(gameId, {
      final_score_home: Math.max(0, finalHome),
      final_score_away: Math.max(0, finalAway),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to finalize game" };
  }
}
