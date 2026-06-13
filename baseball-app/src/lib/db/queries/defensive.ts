import { isDemoId } from "../mockData";
import type { DefensiveEvent } from "@/lib/types";
import { DEFENSIVE_EVENT_COLUMNS } from "./columns";
import { getSupabase } from "./client";

export async function getDefensiveEventsByGame(gameId: string): Promise<DefensiveEvent[]> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(gameId)) return [];
  const { data } = await supabase
    .from("defensive_events")
    .select(DEFENSIVE_EVENT_COLUMNS)
    .eq("game_id", gameId)
    .order("created_at");
  return (data ?? []) as DefensiveEvent[];
}

