import { isDemoId } from "../mockData";
import type { PitchEvent, PlateAppearance } from "@/lib/types";
import { getPitchEventsForPaIds } from "./pitchEvents";
import { getPlateAppearancesByBatters, getPlateAppearancesByPitchers } from "./plateAppearances";

export type HitterReportSprayData = {
  pasByBatter: Record<string, PlateAppearance[]>;
  pasByPitcher: Record<string, PlateAppearance[]>;
  pitchEventsByBatter: Record<string, PitchEvent[]>;
};

/** Batched PA + pitch-event loads for multi-player hitter PDF reports (replaces per-player N+1). */
export async function getHitterReportSprayData(playerIds: string[]): Promise<HitterReportSprayData> {
  const ids = [...new Set(playerIds.filter((id) => id && !isDemoId(id)))];
  const empty = (): HitterReportSprayData => ({
    pasByBatter: {},
    pasByPitcher: {},
    pitchEventsByBatter: {},
  });
  if (ids.length === 0) return empty();

  const [pasAsBatter, pasAsPitcher] = await Promise.all([
    getPlateAppearancesByBatters(ids),
    getPlateAppearancesByPitchers(ids),
  ]);

  const pasByBatter: Record<string, PlateAppearance[]> = {};
  const pasByPitcher: Record<string, PlateAppearance[]> = {};
  for (const id of ids) {
    pasByBatter[id] = [];
    pasByPitcher[id] = [];
  }
  for (const pa of pasAsBatter) {
    if (pasByBatter[pa.batter_id]) pasByBatter[pa.batter_id].push(pa);
  }
  for (const pa of pasAsPitcher) {
    if (pa.pitcher_id && pasByPitcher[pa.pitcher_id]) pasByPitcher[pa.pitcher_id].push(pa);
  }

  const allBatterPaIds = pasAsBatter.map((p) => p.id).filter(Boolean) as string[];
  const pitchEvents = allBatterPaIds.length > 0 ? await getPitchEventsForPaIds(allBatterPaIds) : [];
  const pitchEventsByBatter: Record<string, PitchEvent[]> = {};
  for (const id of ids) pitchEventsByBatter[id] = [];
  for (const pe of pitchEvents) {
    const pa = pasAsBatter.find((p) => p.id === pe.pa_id);
    if (pa && pitchEventsByBatter[pa.batter_id]) pitchEventsByBatter[pa.batter_id].push(pe);
  }

  return { pasByBatter, pasByPitcher, pitchEventsByBatter };
}
