import { cache } from "react";
import { getGames, getPlayers, getTrackedOpponents } from "@/lib/db/queries";

/** Tag names kept for documentation; list invalidation uses `revalidatePath` in `revalidateLists.ts`. */
export const PLAYERS_CACHE_TAG = "players";
export const GAMES_CACHE_TAG = "games";
export const TRACKED_OPPONENTS_CACHE_TAG = "tracked-opponents";

/**
 * Per-request dedupe for games list (safe with cookie-based Supabase).
 * `unstable_cache` cannot call `cookies()` — do not wrap `getGames()` there.
 */
export const getCachedGames = cache(async () => getGames());

/**
 * Per-request dedupe for full roster reads.
 */
export const getCachedPlayers = cache(async () => getPlayers());

export const getCachedTrackedOpponents = cache(async () => getTrackedOpponents());
