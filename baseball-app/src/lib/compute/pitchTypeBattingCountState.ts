/**
 * Count-state pitch-type rates for batters (pitches seen at balls–strikes before the pitch).
 */

import { groupPitchEventsByPaId } from "@/lib/compute/contactProfileFromPas";
import {
  aggregateBatterPitchTypeBucketCounts,
  BATTER_PITCH_STAT_BUCKETS,
  pitchTypeProfilesFromCounts,
} from "@/lib/compute/pitchTypeProfileFromPas";
import { isBasesEmpty, isBasesLoaded, isRisp, isRunnersOn } from "@/lib/compute/battingStats";
import { pasMatchFinalCount } from "@/lib/compute/battingStatsWithSplitsFromPas";
import { paMatchesStatsVenueFilter } from "@/lib/compute/statsSheetLiveFilters";
import type { GameVenueSide } from "@/lib/compute/gameVenueSplits";
import type { StatsVenueFilter } from "@/lib/statsVenueFilter";
import type {
  BattingStats,
  Bats,
  BattingFinalCountBucketKey,
  PitchEvent,
  PlateAppearance,
  StatsRunnersFilterKey,
} from "@/lib/types";
import type { SplitView } from "@/components/analyst/BattingStatsSheet";

function filterPasForBatterPitchTypeCountState(
  batterId: string,
  pas: PlateAppearance[],
  splitView: SplitView,
  runnersFilter: StatsRunnersFilterKey,
  finalCountBucket: BattingFinalCountBucketKey,
  pitcherThrowsById?: Record<string, Bats | null | undefined>,
  venueFilter: StatsVenueFilter = "all",
  gameOurSideById?: Map<string, GameVenueSide>
): PlateAppearance[] {
  const [ballsNeed, strikesNeed] = finalCountBucket.split("-").map((n) => Number(n));
  if (!Number.isFinite(ballsNeed) || !Number.isFinite(strikesNeed)) return [];

  return pas.filter((pa) => {
    if (pa.batter_id !== batterId) return false;
    const throws = pitcherThrowsById?.[pa.pitcher_id ?? ""] ?? null;
    if (splitView === "vsL" && throws !== "L") return false;
    if (splitView === "vsR" && throws !== "R") return false;
    if (runnersFilter === "basesEmpty" && !isBasesEmpty(pa.base_state)) return false;
    if (runnersFilter === "runnersOn" && !isRunnersOn(pa.base_state)) return false;
    if (runnersFilter === "risp" && !isRisp(pa.base_state)) return false;
    if (runnersFilter === "basesLoaded" && !isBasesLoaded(pa.base_state)) return false;
    if (!paMatchesStatsVenueFilter(pa, venueFilter, gameOurSideById)) return false;
    return pasMatchFinalCount(pa, ballsNeed, strikesNeed);
  });
}

/** Recompute batTyped / batBuckets using only pitches thrown at the selected count state. */
export function buildPitchTypeCountStateStatsByBatter(
  batterIds: string[],
  pas: PlateAppearance[] | undefined,
  pitchEvents: PitchEvent[] | undefined,
  splitView: SplitView,
  runnersFilter: StatsRunnersFilterKey,
  finalCountBucket: BattingFinalCountBucketKey | null,
  pitcherThrowsById?: Record<string, Bats | null | undefined>,
  venueFilter: StatsVenueFilter = "all",
  gameOurSideById?: Map<string, GameVenueSide>
): Record<string, Partial<BattingStats>> {
  if (!pas || !pitchEvents || !finalCountBucket) return {};
  const [ballsNeed, strikesNeed] = finalCountBucket.split("-").map((n) => Number(n));
  if (!Number.isFinite(ballsNeed) || !Number.isFinite(strikesNeed)) return {};

  const eventsByPaId = groupPitchEventsByPaId(pitchEvents);
  const out: Record<string, Partial<BattingStats>> = {};

  for (const batterId of batterIds) {
    const filteredPas = filterPasForBatterPitchTypeCountState(
      batterId,
      pas,
      splitView,
      runnersFilter,
      finalCountBucket,
      pitcherThrowsById,
      venueFilter,
      gameOurSideById
    );
    if (filteredPas.length === 0) continue;

    const subEvents = new Map<string, PitchEvent[]>();
    for (const pa of filteredPas) {
      const evs = (eventsByPaId.get(pa.id) ?? []).filter(
        (e) => e.balls_before === ballsNeed && e.strikes_before === strikesNeed
      );
      if (evs.length > 0) subEvents.set(pa.id, evs);
    }

    const full = aggregateBatterPitchTypeBucketCounts(filteredPas, subEvents);
    if (full.typedTotal <= 0) continue;

    out[batterId] = {
      batTyped: full.typedTotal,
      batBuckets: pitchTypeProfilesFromCounts(full.typedTotal, full.buckets, {
        totalFirstPitch: full.totalFirstPitch,
        totalAhead: full.totalAhead,
        totalBehind: full.totalBehind,
        totalEven: full.totalEven,
        totalPaEnds: full.totalPaEnds,
      }, BATTER_PITCH_STAT_BUCKETS),
    };
  }

  return out;
}
