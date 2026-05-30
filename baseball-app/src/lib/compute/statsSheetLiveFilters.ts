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
  distinctGameCount,
  gamesStartedInSplit,
  pasMatchFinalCount,
} from "@/lib/compute/battingStatsWithSplitsFromPas";
import { buildPitchingStatsLine } from "@/lib/compute/pitchingStats";
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

export function paMatchesBattingPlatoonSplit(
  pa: PlateAppearance,
  split: BattingSheetSplitView
): boolean {
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
  runnersFilter: StatsRunnersFilterKey,
  finalCountBucket: BattingFinalCountBucketKey,
  startedGames: Set<string>,
  pitchEvents?: PitchEvent[]
): BattingStats | undefined {
  const sub = pas.filter(
    (pa) =>
      pa.batter_id === playerId &&
      paMatchesBattingPlatoonSplit(pa, splitView) &&
      paMatchesStatsRunnersFilter(pa, runnersFilter) &&
      paMatchesFinalCountBucket(pa, finalCountBucket)
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
  return st;
}

export function pitchingStatsForSheetLiveFilters(
  pitcherId: string,
  pas: PlateAppearance[],
  splitView: PitchingSheetSplitView,
  runnersFilter: StatsRunnersFilterKey,
  finalCountBucket: BattingFinalCountBucketKey,
  starterGameIds: Set<string>,
  batterBatsById: Map<string, Bats | null | undefined>,
  pitchEvents?: PitchEvent[]
): PitchingStats | undefined {
  const allPitcherPas = pas.filter((pa) => pa.pitcher_id === pitcherId);
  let sub = allPitcherPas.filter(
    (pa) =>
      paMatchesStatsRunnersFilter(pa, runnersFilter) &&
      paMatchesFinalCountBucket(pa, finalCountBucket) &&
      paMatchesPitchingPlatoonSplit(pa, splitView, batterBatsById)
  );

  if (sub.length === 0) {
    return undefined;
  }

  const platoonSubset = splitView !== "overall";
  const starters = platoonSubset
    ? new Set<string>()
    : starterGamesInPasSample(starterGameIds, allPitcherPas);

  const eventsByPaId =
    pitchEvents && pitchEvents.length > 0 ? groupPitchEventsByPaId(pitchEvents) : new Map<string, PitchEvent[]>();

  const paPredicate = (pa: PlateAppearance) =>
    pa.pitcher_id === pitcherId &&
    paMatchesStatsRunnersFilter(pa, runnersFilter) &&
    paMatchesFinalCountBucket(pa, finalCountBucket) &&
    paMatchesPitchingPlatoonSplit(pa, splitView, batterBatsById);

  return (
    buildPitchingStatsLine(sub, starters, eventsByPaId, {
      pitcherId,
      allPas: allPitcherPas,
      paPredicate,
    }) ?? undefined
  );
}
