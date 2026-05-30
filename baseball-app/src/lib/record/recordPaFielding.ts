import type { PAResult, PlateAppearance } from "@/lib/types";
import { RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT } from "@/lib/record/recordPageConstants";
import { hasRunnersOnBaseForm } from "@/lib/record/recordRunnerState";

export function persistPlateAppearanceErrorFielderId(
  result: PAResult,
  baseState: string,
  errorFielderId: string | null
): string | null {
  if (!errorFielderId) return null;
  if (result === "reached_on_error") return errorFielderId;
  if (RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT.has(result)) return errorFielderId;
  if (result === "hr") return null;
  return hasRunnersOnBaseForm(baseState) ? errorFielderId : null;
}

export function recordPaShowsUnearnedRunControls(
  result: PAResult | null,
  errorFielderId: string | null
): boolean {
  if (result === "reached_on_error") return true;
  return Boolean(errorFielderId);
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
    if (pa.result === "reached_on_error") return true;
    const fid = pa.error_fielder_id;
    return typeof fid === "string" && fid.length > 0;
  });
}

export function computeShowEarnedUnearnedRunControls(
  pas: PlateAppearance[],
  gameId: string,
  inning: number,
  inningHalf: "top" | "bottom",
  result: PAResult | null,
  errorFielderId: string | null
): boolean {
  return (
    halfInningHadPriorErrorFromPas(pas, gameId, inning, inningHalf) ||
    recordPaShowsUnearnedRunControls(result, errorFielderId)
  );
}

export function playerIdsWhoReachedOnErrorFromPas(
  pas: PlateAppearance[],
  currentRoeBatterId: string | null
): Set<string> {
  const set = new Set<string>();
  for (const pa of pas) {
    if (pa.result === "reached_on_error" && pa.batter_id) set.add(pa.batter_id);
  }
  if (currentRoeBatterId) set.add(currentRoeBatterId);
  return set;
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
