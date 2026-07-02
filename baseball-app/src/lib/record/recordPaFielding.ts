import type { PAResult, PlateAppearance } from "@/lib/types";
import { RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT } from "@/lib/record/recordPageConstants";
import {
  clearScoredRunnersFromSlots,
  getRunnerIdsAfterResult,
  hasRunnersOnBaseForm,
} from "@/lib/record/recordRunnerState";

export function normalizeErrorFielderIds(ids: string[] | null | undefined): string[] {
  if (!ids?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** All fielders charged with an error on this PA (supports legacy single `error_fielder_id`). */
export function paErrorFielderIds(
  pa: Pick<PlateAppearance, "error_fielder_id" | "error_fielder_ids">
): string[] {
  const fromArray = normalizeErrorFielderIds(pa.error_fielder_ids);
  if (fromArray.length > 0) return fromArray;
  if (pa.error_fielder_id) return [pa.error_fielder_id];
  return [];
}

export function paHasChargedFieldingError(
  pa: Pick<PlateAppearance, "error_fielder_id" | "error_fielder_ids" | "result">
): boolean {
  if (pa.result === "reached_on_error") return true;
  return paErrorFielderIds(pa).length > 0;
}

/** Team linescore: number of defensive errors on this play. */
export function paDefensiveErrorCountForLinescore(pa: PlateAppearance): number {
  const ids = paErrorFielderIds(pa);
  if (pa.result === "reached_on_error") return Math.max(ids.length, 1);
  if (pa.result === "hr") return 0;
  return ids.length;
}

export function persistPlateAppearanceErrorFielders(
  result: PAResult,
  baseState: string,
  errorFielderIds: string[]
): { error_fielder_id: string | null; error_fielder_ids: string[] } {
  const ids = normalizeErrorFielderIds(errorFielderIds);
  if (ids.length === 0) return { error_fielder_id: null, error_fielder_ids: [] };
  const primary = ids[0]!;
  if (result === "reached_on_error") return { error_fielder_id: primary, error_fielder_ids: ids };
  if (RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT.has(result)) {
    return { error_fielder_id: primary, error_fielder_ids: ids };
  }
  if (result === "hr") return { error_fielder_id: null, error_fielder_ids: [] };
  return hasRunnersOnBaseForm(baseState)
    ? { error_fielder_id: primary, error_fielder_ids: ids }
    : { error_fielder_id: null, error_fielder_ids: [] };
}

/** @deprecated Use {@link persistPlateAppearanceErrorFielders}. */
export function persistPlateAppearanceErrorFielderId(
  result: PAResult,
  baseState: string,
  errorFielderId: string | null
): string | null {
  return persistPlateAppearanceErrorFielders(
    result,
    baseState,
    errorFielderId ? [errorFielderId] : []
  ).error_fielder_id;
}

export function recordPaShowsUnearnedRunControls(
  result: PAResult | null,
  errorFielderIds: string[]
): boolean {
  if (result === "reached_on_error") return true;
  return errorFielderIds.length > 0;
}

export function halfInningHadPriorErrorFromPas(
  pas: PlateAppearance[],
  gameId: string,
  inning: number,
  inningHalf: "top" | "bottom"
): boolean {
  return pas.some((pa) => {
    if (pa.game_id !== gameId || pa.inning !== inning) return false;
    const paHalf = pa.inning_half === "bottom" ? "bottom" : "top";
    if (paHalf !== inningHalf) return false;
    return paHasChargedFieldingError(pa);
  });
}

export function computeShowEarnedUnearnedRunControls(
  pas: PlateAppearance[],
  gameId: string,
  inning: number,
  inningHalf: "top" | "bottom",
  result: PAResult | null,
  errorFielderIds: string[]
): boolean {
  return (
    halfInningHadPriorErrorFromPas(pas, gameId, inning, inningHalf) ||
    recordPaShowsUnearnedRunControls(result, errorFielderIds)
  );
}

function paInningHalf(pa: PlateAppearance): "top" | "bottom" {
  return pa.inning_half === "bottom" ? "bottom" : "top";
}

function pasForHalfInning(
  pas: PlateAppearance[],
  gameId: string,
  inning: number,
  inningHalf: "top" | "bottom"
): PlateAppearance[] {
  return pas
    .filter(
      (pa) => pa.game_id === gameId && pa.inning === inning && paInningHalf(pa) === inningHalf
    )
    .sort((a, b) => {
      if (a.created_at && b.created_at) return a.created_at.localeCompare(b.created_at);
      return a.id.localeCompare(b.id);
    });
}

type RunnerSlots = { r1: string | null; r2: string | null; r3: string | null };

function advanceRoeStateAfterPa(
  slots: RunnerSlots,
  roeIds: Set<string>,
  pa: Pick<PlateAppearance, "batter_id" | "result" | "base_state" | "rbi" | "runs_scored_player_ids">
): RunnerSlots {
  const scorers = pa.runs_scored_player_ids ?? [];
  for (const id of scorers) roeIds.delete(id);

  const [newR1, newR2, newR3] = getRunnerIdsAfterResult(
    slots.r1,
    slots.r2,
    slots.r3,
    pa.batter_id,
    pa.result,
    pa.base_state,
    pa.rbi
  );

  const [cR1, cR2, cR3] = clearScoredRunnersFromSlots(newR1, newR2, newR3, scorers);
  for (const id of scorers) roeIds.delete(id);

  const onBase = new Set([cR1, cR2, cR3].filter((id): id is string => id != null));
  for (const id of [...roeIds]) {
    if (!onBase.has(id)) roeIds.delete(id);
  }

  if (pa.result === "reached_on_error") {
    roeIds.add(pa.batter_id);
  }

  return { r1: cR1, r2: cR2, r3: cR3 };
}

/** Player IDs still on base via ROE after replaying saved PAs in this half-inning. */
export function roeReacherIdsOnBaseAfterHalfInningPas(
  pas: PlateAppearance[],
  gameId: string,
  inning: number,
  inningHalf: "top" | "bottom"
): Set<string> {
  const roeIds = new Set<string>();
  let slots: RunnerSlots = { r1: null, r2: null, r3: null };
  for (const pa of pasForHalfInning(pas, gameId, inning, inningHalf)) {
    slots = advanceRoeStateAfterPa(slots, roeIds, pa);
  }
  return roeIds;
}

/**
 * ROE tags for the current play: inherited runners who reached on error this trip,
 * plus the batter when this PA is ROE (not prior ROE appearances).
 */
export function playerIdsReachedOnErrorOnCurrentTrip(
  pas: PlateAppearance[],
  gameId: string,
  inning: number,
  inningHalf: "top" | "bottom",
  pendingRoeBatterId: string | null,
  onBaseRunnerIds: string[]
): Set<string> {
  if (!gameId) {
    return pendingRoeBatterId ? new Set([pendingRoeBatterId]) : new Set();
  }
  const roeFromReplay = roeReacherIdsOnBaseAfterHalfInningPas(pas, gameId, inning, inningHalf);
  const out = new Set<string>();
  for (const id of onBaseRunnerIds) {
    if (roeFromReplay.has(id)) out.add(id);
  }
  if (pendingRoeBatterId) out.add(pendingRoeBatterId);
  return out;
}

export function unearnedScorerIdsForSave(
  runsScoredIds: string[],
  roeReachIds: Set<string>,
  persistManualUnearnedFlags: boolean,
  unearnedRunsScoredPlayerIds: string[]
): string[] {
  return runsScoredIds.filter(
    (id) => roeReachIds.has(id) || (persistManualUnearnedFlags && unearnedRunsScoredPlayerIds.includes(id))
  );
}
