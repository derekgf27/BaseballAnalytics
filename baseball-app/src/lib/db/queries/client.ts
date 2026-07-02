import { createSupabaseServerClient } from "@/lib/supabase/server";
import { paErrorFielderIds } from "@/lib/record/recordPaFielding";
import type { PlateAppearance } from "@/lib/types";
import { isDemoId } from "../mockData";

export async function getSupabase() {
  return createSupabaseServerClient();
}

/** Defensive errors charged per player (any PA with charged fielding errors). */
export async function fetchFieldingErrorCountsForPlayers(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabase>>>,
  playerIds: string[]
): Promise<Record<string, number>> {
  const clean = [...new Set(playerIds.filter((id) => !isDemoId(id)))];
  if (clean.length === 0) return {};
  const cleanSet = new Set(clean);
  const orFilter = clean
    .flatMap((id) => [`error_fielder_id.eq.${id}`, `error_fielder_ids.cs.{${id}}`])
    .join(",");
  const { data } = await supabase
    .from("plate_appearances")
    .select("error_fielder_id, error_fielder_ids")
    .or(orFilter);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    for (const id of paErrorFielderIds(
      row as Pick<PlateAppearance, "error_fielder_id" | "error_fielder_ids">
    )) {
      if (cleanSet.has(id)) counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  return counts;
}
