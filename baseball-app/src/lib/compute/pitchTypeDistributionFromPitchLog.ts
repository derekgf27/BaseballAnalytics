import { PITCH_TRACKER_TYPES } from "@/lib/pitchTrackerUi";
import type { PitchEvent, PitchTrackerPitchType, PlateAppearance } from "@/lib/types";

export type PitchTypeDistributionEntry = {
  type: PitchTrackerPitchType;
  count: number;
  /** Share among pitches with a known type (0–1). */
  pct: number;
};

export type PitchTypeDistributionResult = {
  /** Pitches in the log with a recognized `pitch_type`. */
  typedTotal: number;
  /** Non-zero types only, descending by count. */
  entries: PitchTypeDistributionEntry[];
};

function normalizeCoachPitchType(raw: string | null | undefined): PitchTrackerPitchType | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase();
  return (PITCH_TRACKER_TYPES as readonly string[]).includes(t) ? (t as PitchTrackerPitchType) : null;
}

/**
 * Counts each coach pitch type from pitch log rows on the given PAs.
 * Unknown or null `pitch_type` values are ignored (not counted in `typedTotal`).
 */
export function pitchTypeDistributionFromPitchLog(
  pas: PlateAppearance[],
  eventsByPaId: Map<string, PitchEvent[]>
): PitchTypeDistributionResult {
  const counts = new Map<PitchTrackerPitchType, number>();
  for (const ty of PITCH_TRACKER_TYPES) counts.set(ty, 0);

  let typedTotal = 0;
  for (const pa of pas) {
    const evs = eventsByPaId.get(pa.id) ?? [];
    for (const e of evs) {
      const nt = normalizeCoachPitchType(e.pitch_type);
      if (nt == null) continue;
      typedTotal += 1;
      counts.set(nt, (counts.get(nt) ?? 0) + 1);
    }
  }

  const entries: PitchTypeDistributionEntry[] = [];
  for (const ty of PITCH_TRACKER_TYPES) {
    const count = counts.get(ty) ?? 0;
    if (count <= 0) continue;
    entries.push({
      type: ty,
      count,
      pct: typedTotal > 0 ? count / typedTotal : 0,
    });
  }
  entries.sort((a, b) => b.count - a.count);

  return { typedTotal, entries };
}
