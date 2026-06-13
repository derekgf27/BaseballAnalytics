import type { PlayerRating } from "@/lib/types";
import { PLAYER_RATING_COLUMNS } from "./columns";
import { getSupabase } from "./client";

export async function getPlayerRating(playerId: string): Promise<PlayerRating | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("player_ratings")
    .select(PLAYER_RATING_COLUMNS)
    .eq("player_id", playerId)
    .single();
  return data as PlayerRating | null;
}

/** Returns a map of player_id -> rating for all given ids that have a stored rating. */

export async function getPlayerRatingsBatch(
  playerIds: string[]
): Promise<Record<string, Pick<PlayerRating, "contact_reliability" | "damage_potential" | "decision_quality" | "defense_trust">>> {
  const supabase = await getSupabase();
  if (!supabase || playerIds.length === 0) return {};
  const { data } = await supabase
    .from("player_ratings")
    .select("player_id, contact_reliability, damage_potential, decision_quality, defense_trust")
    .in("player_id", playerIds);
  const list = (data ?? []) as Array<PlayerRating & { player_id: string }>;
  const map: Record<string, Pick<PlayerRating, "contact_reliability" | "damage_potential" | "decision_quality" | "defense_trust">> = {};
  for (const row of list) {
    map[row.player_id] = {
      contact_reliability: row.contact_reliability,
      damage_potential: row.damage_potential,
      decision_quality: row.decision_quality,
      defense_trust: row.defense_trust,
    };
  }
  return map;
}

/** Compute AVG, OBP, SLG, OPS, OPS+, R, SB from plate appearances for the given players. */

export async function upsertPlayerRating(
  playerId: string,
  ratings: { contact_reliability: number; damage_potential: number; decision_quality: number; defense_trust: number },
  overriddenBy: string
): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;
  await supabase.from("player_ratings").upsert({
    player_id: playerId,
    ...ratings,
    overridden_at: new Date().toISOString(),
    overridden_by: overriddenBy,
    updated_at: new Date().toISOString(),
  });
}

