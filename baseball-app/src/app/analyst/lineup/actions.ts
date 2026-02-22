"use server";

import {
  getSavedLineups,
  getSavedLineupWithSlots,
  insertSavedLineup,
  updateSavedLineup,
  deleteSavedLineup as deleteSavedLineupQuery,
} from "@/lib/db/queries";
import type { SavedLineup, SavedLineupWithSlots } from "@/lib/types";

export async function fetchSavedLineups(): Promise<SavedLineup[]> {
  return getSavedLineups();
}

export async function fetchSavedLineupWithSlots(id: string): Promise<SavedLineupWithSlots | null> {
  return getSavedLineupWithSlots(id);
}

export async function saveLineupTemplate(
  name: string,
  slots: { slot: number; player_id: string; position: string | null }[]
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const lineup = await insertSavedLineup(name, slots);
    return { ok: !!lineup, id: lineup?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save" };
  }
}

export async function deleteSavedLineup(id: string): Promise<{ ok: boolean }> {
  try {
    await deleteSavedLineupQuery(id);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
