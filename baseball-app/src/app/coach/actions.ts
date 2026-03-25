"use server";

import { getPlateAppearancesByGame } from "@/lib/db/queries";

/** Coach dashboard: refresh linescore without full page reload. */
export async function fetchCoachGamePasAction(gameId: string) {
  return getPlateAppearancesByGame(gameId);
}
