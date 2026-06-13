import {
  getGames,
  getPlateAppearancesForGames,
  getPitchEventsForPaIds,
  getPlayers,
} from "@/lib/db/queries";
import { buildInsightsContext, type InsightsContext } from "./context";
import { runInsightsDashboard } from "./dashboard";
import { runInsightsEngine } from "./engine";
import type { InsightsDashboard } from "./dashboard";
import type { InsightsProfile, InsightsBundle } from "./types";

export async function loadInsightsContext(options?: {
  focusGameId?: string | null;
  playerIds?: string[];
  maxGames?: number;
}): Promise<InsightsContext> {
  const maxGames = options?.maxGames ?? 30;
  const [games, players] = await Promise.all([getGames(), getPlayers()]);
  const finalized = games.slice(0, maxGames);
  const gameIds = finalized.map((g) => g.id);
  const allPas = gameIds.length > 0 ? await getPlateAppearancesForGames(gameIds) : [];
  const paIds = allPas.map((p) => p.id).filter(Boolean) as string[];
  const pitchEvents = paIds.length > 0 ? await getPitchEventsForPaIds(paIds) : [];

  return buildInsightsContext({
    games: finalized,
    allPas,
    pitchEvents,
    players,
    focusGameId: options?.focusGameId,
    playerIds: options?.playerIds,
  });
}

export async function fetchInsightsBundle(
  profile: InsightsProfile,
  options?: {
    focusGameId?: string | null;
    playerIds?: string[];
    maxGames?: number;
  }
): Promise<InsightsBundle> {
  const ctx = await loadInsightsContext(options);
  return runInsightsEngine(ctx, profile);
}

export async function fetchInsightsDashboard(options?: {
  focusGameId?: string | null;
  playerIds?: string[];
  maxGames?: number;
}): Promise<InsightsDashboard> {
  const ctx = await loadInsightsContext(options);
  return runInsightsDashboard(ctx);
}
