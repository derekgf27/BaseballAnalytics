import { getSupabase } from "./client";

export async function linkPitchTrackerGroupToPlateAppearance(
  trackerGroupId: string,
  paId: string
): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) throw new Error("Database unavailable");
  const { error } = await supabase
    .from("pitches")
    .update({ at_bat_id: paId })
    .eq("tracker_group_id", trackerGroupId)
    .is("at_bat_id", null);
  if (error) throw new Error(error.message);
}

/** SB/CS counts per player from baserunning_events (all games). */

