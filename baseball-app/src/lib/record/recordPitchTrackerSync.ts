import { isDemoId } from "@/lib/db/mockData";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export async function persistPitchTrackerGroupToGame(gameId: string, groupId: string) {
  if (isDemoId(gameId)) return;
  const sb = getSupabaseBrowserClient();
  if (!sb) return;
  await sb.from("games").update({ pitch_tracker_group_id: groupId }).eq("id", gameId);
}

export async function persistPitchTrackerBatterToGame(
  gameId: string,
  batterId: string | null,
  batterSlot: number | null
) {
  if (isDemoId(gameId)) return;
  const sb = getSupabaseBrowserClient();
  if (!sb) return;
  const slot =
    batterId != null &&
    typeof batterSlot === "number" &&
    Number.isFinite(batterSlot) &&
    batterSlot >= 1 &&
    batterSlot <= 9
      ? Math.trunc(batterSlot)
      : null;
  await sb
    .from("games")
    .update({ pitch_tracker_batter_id: batterId, pitch_tracker_batter_slot: slot })
    .eq("id", gameId);
}

export async function persistPitchTrackerOutsToGame(gameId: string, outs: number) {
  if (isDemoId(gameId)) return;
  const sb = getSupabaseBrowserClient();
  if (!sb) return;
  const o = Math.max(0, Math.min(2, Math.trunc(outs)));
  await sb.from("games").update({ pitch_tracker_outs: o }).eq("id", gameId);
}

export async function persistPitchTrackerCountToGame(gameId: string, balls: number, strikes: number) {
  if (isDemoId(gameId)) return;
  const sb = getSupabaseBrowserClient();
  if (!sb) return;
  const b = Math.max(0, Math.min(3, Math.trunc(balls)));
  const s = Math.max(0, Math.min(3, Math.trunc(strikes)));
  const { error } = await sb
    .from("games")
    .update({ pitch_tracker_balls: b, pitch_tracker_strikes: s })
    .eq("id", gameId);
  if (error) {
    console.warn("[Record] Could not sync pitch_tracker count:", error.message);
  }
}

export async function persistPitchTrackerPitcherToGame(gameId: string, pitcherId: string | null) {
  if (isDemoId(gameId)) return;
  const sb = getSupabaseBrowserClient();
  if (!sb) return;
  const { error } = await sb.from("games").update({ pitch_tracker_pitcher_id: pitcherId }).eq("id", gameId);
  if (error) {
    console.warn("[Record] Could not sync pitch_tracker_pitcher_id:", error.message);
  }
}
