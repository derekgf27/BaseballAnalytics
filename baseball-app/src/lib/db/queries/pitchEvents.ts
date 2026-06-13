import { clampPitchCountBefore } from "@/lib/compute/pitchSequence";
import { isDemoId } from "../mockData";
import type { PitchEvent, PitchEventDraft, PitchTrackerPitch } from "@/lib/types";
import { PITCH_EVENT_COLUMNS, PITCH_TRACKER_COLUMNS } from "./columns";
import { getSupabase } from "./client";
import { getPlateAppearancesByGame } from "./plateAppearances";

export async function getPitchEventsForPaIds(paIds: string[]): Promise<PitchEvent[]> {
  const supabase = await getSupabase();
  if (!supabase || paIds.length === 0) return [];
  const clean = [...new Set(paIds.filter(Boolean))];
  const out: PitchEvent[] = [];
  for (let i = 0; i < clean.length; i += PITCH_EVENTS_PA_ID_CHUNK) {
    const chunk = clean.slice(i, i + PITCH_EVENTS_PA_ID_CHUNK);
    const { data, error } = await supabase.from("pitch_events").select(PITCH_EVENT_COLUMNS).in("pa_id", chunk);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as PitchEvent[]));
  }
  out.sort((a, b) => {
    const cmp = a.pa_id.localeCompare(b.pa_id);
    if (cmp !== 0) return cmp;
    return a.pitch_index - b.pitch_index;
  });
  return out;
}

/** Pitch log rows for all PAs in a game (same PA order as {@link getPlateAppearancesByGame}, then pitch_index). */

export async function getPitchEventsForGame(gameId: string): Promise<PitchEvent[]> {
  const pasOrdered = await getPlateAppearancesByGame(gameId);
  if (pasOrdered.length === 0) return [];
  const supabase = await getSupabase();
  if (!supabase || isDemoId(gameId)) return [];
  const paIds = pasOrdered.map((p) => p.id);
  const paOrder = new Map<string, number>();
  pasOrdered.forEach((p, i) => paOrder.set(p.id, i));
  const { data: events, error } = await supabase.from("pitch_events").select(PITCH_EVENT_COLUMNS).in("pa_id", paIds);
  if (error) throw new Error(error.message);
  const rows = (events ?? []) as PitchEvent[];
  rows.sort((a, b) => {
    const oa = paOrder.get(a.pa_id) ?? 0;
    const ob = paOrder.get(b.pa_id) ?? 0;
    if (oa !== ob) return oa - ob;
    return a.pitch_index - b.pitch_index;
  });
  return rows;
}

/** All coach pitch-tracker rows linked to PAs in a game (for pitch-type mix on Record). */

export async function getPitchTrackerPitchesForGame(gameId: string): Promise<PitchTrackerPitch[]> {
  const supabase = await getSupabase();
  if (!supabase || isDemoId(gameId)) return [];
  const { data, error } = await supabase
    .from("pitches")
    .select(PITCH_TRACKER_COLUMNS)
    .eq("game_id", gameId)
    .not("at_bat_id", "is", null)
    .order("pitch_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PitchTrackerPitch[];
}

export async function insertPitchEventsForPa(paId: string, rows: PitchEventDraft[]): Promise<void> {
  if (rows.length === 0) return;
  const supabase = await getSupabase();
  if (!supabase || isDemoId(paId)) return;
  const payload = rows.map((r) => {
    const { balls, strikes } = clampPitchCountBefore(r.balls_before, r.strikes_before);
    return {
      pa_id: paId,
      pitch_index: r.pitch_index,
      balls_before: balls,
      strikes_before: strikes,
      outcome: r.outcome,
      pitch_type: r.pitch_type ?? null,
    };
  });
  const { error } = await supabase.from("pitch_events").insert(payload);
  if (error) throw new Error(error.message);
}

/** Insert PA then optional pitch log (same transaction not guaranteed; pitch rows deleted if second insert fails — rare). */

const PITCH_EVENTS_PA_ID_CHUNK = 200;

