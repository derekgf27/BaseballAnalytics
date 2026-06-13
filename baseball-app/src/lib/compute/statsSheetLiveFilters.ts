/**
 * Live stat-sheet filters: Runners × Final count (and platoon) from in-memory PAs.
 * Used when pre-aggregated `runnerSituations` / `statsByFinalCount` cannot be combined.
 */

import { groupPitchEventsByPaId, mergeContactProfileIntoBattingStats } from "@/lib/compute/contactProfileFromPas";
import {
  battingStatsFromPAs,
  fieldingErrorsByPlayerFromPas,
  isBasesEmpty,
  isBasesLoaded,
  isRisp,
  isRunnersOn,
} from "@/lib/compute/battingStats";
import {
  battingStatsForFinalCountBucket,
  distinctGameCount,
  gamesStartedInSplit,
  pasMatchFinalCount,
} from "@/lib/compute/battingStatsWithSplitsFromPas";
import {
  paMatchesOurVenueSplit,
  starterGameIdsForVenue,
  type GameVenueSide,
} from "@/lib/compute/gameVenueSplits";
import { buildPitchingStatsLine } from "@/lib/compute/pitchingStats";
import type { StatsVenueFilter } from "@/lib/statsVenueFilter";
import type {
  BattingFinalCountBucketKey,
  BattingStats,
  Bats,
  PitchEvent,
  PitchingStats,
  PlateAppearance,
  StatsRunnersFilterKey,
} from "@/lib/types";

export type BattingSheetSplitView = "overall" | "vsL" | "vsR";

export type PitchingSheetSplitView = "overall" | "vsLHB" | "vsRHB";

export function paMatchesStatsVenueFilter(
  pa: PlateAppearance,
  venue: StatsVenueFilter,
  gameOurSideById?: Map<string, GameVenueSide>
): boolean {
  if (venue === "all") return true;
  if (!gameOurSideById?.size) return false;
  return paMatchesOurVenueSplit(pa, venue, gameOurSideById);
}

export function paMatchesStatsRunnersFilter(
  pa: PlateAppearance,
  runners: StatsRunnersFilterKey
): boolean {
  if (runners === "all") return true;
  if (runners === "basesEmpty") return isBasesEmpty(pa.base_state);
  if (runners === "runnersOn") return isRunnersOn(pa.base_state);
  if (runners === "risp") return isRisp(pa.base_state);
  return isBasesLoaded(pa.base_state);
}

export function paMatchesBattingPlatoonSplit(pa: PlateAppearance, split: BattingSheetSplitView): boolean {
  if (split === "vsL") return pa.pitcher_hand === "L";
  if (split === "vsR") return pa.pitcher_hand === "R";
  return true;
}

export function paMatchesPitchingPlatoonSplit(
  pa: PlateAppearance,
  split: PitchingSheetSplitView,
  batterBatsById: Map<string, Bats | null | undefined>
): boolean {
  if (split === "vsLHB") {
    const ch = batterBatsById.get(pa.batter_id)?.trim().toUpperCase()[0];
    return ch === "L";
  }
  if (split === "vsRHB") {
    const ch = batterBatsById.get(pa.batter_id)?.trim().toUpperCase()[0];
    return ch === "R";
  }
  return true;
}

function paMatchesFinalCountBucket(
  pa: PlateAppearance,
  bucket: BattingFinalCountBucketKey | null
): boolean {
  if (!bucket) return true;
  const [balls, strikes] = bucket.split("-").map((n) => Number(n));
  if (!Number.isFinite(balls) || !Number.isFinite(strikes)) return false;
  return pasMatchFinalCount(pa, balls, strikes);
}

function countRunsForPlayer(pasList: PlateAppearance[], playerId: string): number {
  return pasList.reduce(
    (sum, pa) => sum + (pa.runs_scored_player_ids?.filter((id) => id === playerId).length ?? 0),
    0
  );
}

function starterGamesInPasSample(starterGameIds: Set<string>, pas: PlateAppearance[]): Set<string> {
  const gameIds = new Set(pas.map((p) => p.game_id));
  const out = new Set<string>();
  for (const gid of starterGameIds) {
    if (gameIds.has(gid)) out.add(gid);
  }
  return out;
}

export function battingStatsForSheetLiveFilters(
  playerId: string,
  pas: PlateAppearance[],
  splitView: BattingSheetSplitView,
  venueFilter: StatsVenueFilter,
  runnersFilter: StatsRunnersFilterKey,
  finalCountBucket: BattingFinalCountBucketKey | null,
  startedGames: Set<string>,
  pitchEvents?: PitchEvent[],
  gameOurSideById?: Map<string, GameVenueSide>
): BattingStats | undefined {
  const sub = pas.filter(
    (pa) =>
      pa.batter_id === playerId &&
      paMatchesBattingPlatoonSplit(pa, splitView) &&
      paMatchesStatsVenueFilter(pa, venueFilter, gameOurSideById) &&
      paMatchesStatsRunnersFilter(pa, runnersFilter) &&
      (finalCountBucket ? paMatchesFinalCountBucket(pa, finalCountBucket) : true)
  );
  if (sub.length === 0) return undefined;

  const st = battingStatsFromPAs(sub);
  if (!st) return undefined;

  st.r = countRunsForPlayer(sub, playerId);
  st.gp = distinctGameCount(sub);
  st.gs = gamesStartedInSplit(startedGames, sub);
  const eventsByPaId =
    pitchEvents && pitchEvents.length > 0 ? groupPitchEventsByPaId(pitchEvents) : new Map<string, PitchEvent[]>();
  mergeContactProfileIntoBattingStats(st, sub, eventsByPaId);
  st.e = fieldingErrorsByPlayerFromPas(sub)[playerId] ?? 0;
  return finalCountBucket ? battingStatsForFinalCountBucket(st, finalCountBucket) ?? undefined : st;
}

export function pitchingStatsForSheetLiveFilters(
  pitcherId: string,
  pas: PlateAppearance[],
  splitView: PitchingSheetSplitView,
  venueFilter: StatsVenueFilter,
  runnersFilter: StatsRunnersFilterKey,
  finalCountBucket: BattingFinalCountBucketKey | null,
  starterGameIds: Set<string>,
  batterBatsById: Map<string, Bats | null | undefined>,
  pitchEvents?: PitchEvent[],
  gameOurSideById?: Map<string, GameVenueSide>
): PitchingStats | undefined {
  const allPitcherPas = pas.filter((pa) => pa.pitcher_id === pitcherId);
  let sub = allPitcherPas.filter(
    (pa) =>
      paMatchesStatsRunnersFilter(pa, runnersFilter) &&
      (finalCountBucket ? paMatchesFinalCountBucket(pa, finalCountBucket) : true) &&
      paMatchesPitchingPlatoonSplit(pa, splitView, batterBatsById) &&
      paMatchesStatsVenueFilter(pa, venueFilter, gameOurSideById)
  );

  if (sub.length === 0) {
    return undefined;
  }

  const platoonSubset = splitView === "vsLHB" || splitView === "vsRHB";
  let starters = platoonSubset
    ? new Set<string>()
    : starterGamesInPasSample(starterGameIds, allPitcherPas);
  if (venueFilter !== "all" && gameOurSideById?.size) {
    starters = starterGameIdsForVenue(starters, venueFilter, gameOurSideById);
  }

  const eventsByPaId =
    pitchEvents && pitchEvents.length > 0 ? groupPitchEventsByPaId(pitchEvents) : new Map<string, PitchEvent[]>();

  const paPredicate = (pa: PlateAppearance) =>
    pa.pitcher_id === pitcherId &&
    paMatchesStatsRunnersFilter(pa, runnersFilter) &&
    (finalCountBucket ? paMatchesFinalCountBucket(pa, finalCountBucket) : true) &&
    paMatchesPitchingPlatoonSplit(pa, splitView, batterBatsById) &&
    paMatchesStatsVenueFilter(pa, venueFilter, gameOurSideById);

  return (
    buildPitchingStatsLine(sub, starters, eventsByPaId, {
      pitcherId,
      allPas: allPitcherPas,
      paPredicate,
    }) ?? undefined
  );
}
