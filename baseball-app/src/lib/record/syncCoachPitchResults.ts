import type { SupabaseClient } from "@supabase/supabase-js";
import {
  nextOpenPitchNumberInGroup,
  sortCoachPitchRowsForAb,
} from "@/lib/compute/pitchTrackerCount";
import { pitchOutcomeToTrackerLogResult } from "@/lib/pitchTrackerUi";
import type { PitchSequenceEntry } from "@/lib/compute/pitchSequence";
import type { PitchTrackerPitch } from "@/lib/types";

export function isDuplicatePitchNumberError(message: string): boolean {
  return (
    message.includes("pitches_tracker_group_id_pitch_number_key") ||
    message.includes("duplicate key value violates unique constraint")
  );
}

export type CoachPitchRowAbMatch = {
  batterId: string | null;
  pitcherId: string | null;
  offenseAb: boolean;
};

/** While we hit, coach rows may use a different/null `pitcher_id` than Record's mound pitcher. */
export function coachPitchRowMatchesAbContext(
  row: { batter_id?: string | null; pitcher_id?: string | null },
  ctx: CoachPitchRowAbMatch
): boolean {
  if (ctx.batterId && row.batter_id && row.batter_id !== ctx.batterId) return false;
  return ctx.offenseAb || !row.pitcher_id || !ctx.pitcherId || row.pitcher_id === ctx.pitcherId;
}

/** Push analyst pitch-log outcomes onto coach `pitches` rows (fresh fetch, conflict-safe). */
export async function syncCoachPitchResultsToDb(
  sb: SupabaseClient,
  args: {
    groupId: string;
    gameId: string;
    draftLog: PitchSequenceEntry[];
    batterId: string | null;
    pitcherId: string | null;
    abMatch: CoachPitchRowAbMatch;
    isAborted: () => boolean;
    onWarn: (label: string, message: string) => void;
  }
): Promise<void> {
  const { groupId, gameId, draftLog, batterId, pitcherId, abMatch, isAborted, onWarn } = args;

  const { data: freshRows, error: fetchErr } = await sb
    .from("pitches")
    .select("*")
    .eq("tracker_group_id", groupId)
    .order("pitch_number", { ascending: true });

  if (isAborted()) return;
  if (fetchErr) {
    onWarn("Fetch coach pitches for sync", fetchErr.message);
    return;
  }

  const coachPitchRows = (freshRows ?? []) as PitchTrackerPitch[];
  const n = draftLog.length;

  if (n === 0) {
    const { error } = await sb.from("pitches").update({ result: null }).eq("tracker_group_id", groupId);
    if (error) onWarn("Clear coach pitch results", error.message);
    if (isAborted()) return;
    const { error: delStubErr } = await sb
      .from("pitches")
      .delete()
      .eq("tracker_group_id", groupId)
      .is("pitch_type", null);
    if (delStubErr) onWarn("Remove PA-only pitch rows", delStubErr.message);
    return;
  }

  if (!batterId) return;

  const coachRowsForAb = sortCoachPitchRowsForAb(
    coachPitchRows.filter((r) => coachPitchRowMatchesAbContext(r, abMatch))
  );
  const occupiedPitchNumbers = new Set(coachPitchRows.map((r) => r.pitch_number));

  for (let i = 0; i < n; i++) {
    if (isAborted()) return;
    const trackerResult = pitchOutcomeToTrackerLogResult(draftLog[i]!.outcome);
    const coachRow = coachRowsForAb[i];
    if (coachRow?.id) {
      if (coachRow.result === trackerResult) continue;
      const { error } = await sb.from("pitches").update({ result: trackerResult }).eq("id", coachRow.id);
      if (error) onWarn("Sync coach pitch result", error.message);
      continue;
    }

    const pitch_number = nextOpenPitchNumberInGroup(
      [...occupiedPitchNumbers].map((pn) => ({ pitch_number: pn }))
    );
    occupiedPitchNumbers.add(pitch_number);

    const { error: insErr } = await sb.from("pitches").insert({
      game_id: gameId,
      at_bat_id: null,
      tracker_group_id: groupId,
      pitch_number,
      pitch_type: null,
      result: trackerResult,
      batter_id: batterId,
      pitcher_id: pitcherId,
    });

    if (!insErr) continue;

    if (isDuplicatePitchNumberError(insErr.message)) {
      const { data: existing, error: readErr } = await sb
        .from("pitches")
        .select("id, batter_id")
        .eq("tracker_group_id", groupId)
        .eq("pitch_number", pitch_number)
        .maybeSingle();
      if (isAborted()) return;
      if (readErr) {
        onWarn("Read coach pitch row after conflict", readErr.message);
        continue;
      }
      const row = existing as { id: string; batter_id: string | null } | null;
      if (row?.id && (!row.batter_id || row.batter_id === batterId)) {
        const { error: upErr } = await sb
          .from("pitches")
          .update({
            result: trackerResult,
            batter_id: batterId,
            pitcher_id: pitcherId,
          })
          .eq("id", row.id);
        if (upErr) onWarn("Update coach pitch row after conflict", upErr.message);
      } else {
        onWarn("Insert PA-only coach pitch row", insErr.message);
      }
      continue;
    }

    onWarn("Insert PA-only coach pitch row", insErr.message);
  }

  for (let i = n; i < coachRowsForAb.length; i++) {
    if (isAborted()) return;
    const tail = coachRowsForAb[i]!;
    if (tail.result != null) {
      const { error: clearErr } = await sb.from("pitches").update({ result: null }).eq("id", tail.id);
      if (clearErr) onWarn("Clear trailing coach pitch results", clearErr.message);
    }
    if (tail.pitch_type == null) {
      const { error: delTailErr } = await sb.from("pitches").delete().eq("id", tail.id);
      if (delTailErr) onWarn("Remove trailing PA-only rows", delTailErr.message);
    }
  }
}
