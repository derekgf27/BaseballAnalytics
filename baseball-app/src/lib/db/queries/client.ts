import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDemoId } from "../mockData";

export async function getSupabase() {
  return createSupabaseServerClient();
}

/** Defensive errors charged per player (any PA with `error_fielder_id`). */
export async function fetchFieldingErrorCountsForPlayers(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabase>>>,
  playerIds: string[]
): Promise<Record<string, number>> {
  const clean = [...new Set(playerIds.filter((id) => !isDemoId(id)))];
  if (clean.length === 0) return {};
  const { data } = await supabase
    .from("plate_appearances")
    .select("error_fielder_id")
    .in("error_fielder_id", clean)
    .not("error_fielder_id", "is", null);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = (row as { error_fielder_id: string }).error_fielder_id;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}
