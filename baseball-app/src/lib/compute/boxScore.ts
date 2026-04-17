import { REGULATION_INNINGS } from "@/lib/leagueConfig";
import type { PAResult, PlateAppearance } from "@/lib/types";

const HIT_RESULTS = new Set<PAResult>(["single", "double", "triple", "hr"]);

export function isPaHit(result: PAResult): boolean {
  return HIT_RESULTS.has(result);
}

/** Prefer explicit scorer IDs; fall back to RBI when scorer IDs are missing/incomplete. */
export function runsOnPaForLinescore(pa: PlateAppearance): number {
  const scoredIds = pa.runs_scored_player_ids?.length ?? 0;
  const rbi = typeof pa.rbi === "number" && pa.rbi > 0 ? pa.rbi : 0;
  return Math.max(scoredIds, rbi);
}

/** PAs that count toward inning lines (must know top vs bottom). */
function usablePas(pas: PlateAppearance[]): PlateAppearance[] {
  return pas.filter((p) => p.inning_half === "top" || p.inning_half === "bottom");
}

export function sumRunsTopInning(pas: PlateAppearance[], inning: number): number {
  return usablePas(pas)
    .filter((p) => p.inning === inning && p.inning_half === "top")
    .reduce((s, p) => s + runsOnPaForLinescore(p), 0);
}

export function sumRunsBottomInning(pas: PlateAppearance[], inning: number): number {
  return usablePas(pas)
    .filter((p) => p.inning === inning && p.inning_half === "bottom")
    .reduce((s, p) => s + runsOnPaForLinescore(p), 0);
}

export function countHitsTop(pas: PlateAppearance[]): number {
  return usablePas(pas)
    .filter((p) => p.inning_half === "top")
    .reduce((s, p) => s + (isPaHit(p.result) ? 1 : 0), 0);
}

export function countHitsBottom(pas: PlateAppearance[]): number {
  return usablePas(pas)
    .filter((p) => p.inning_half === "bottom")
    .reduce((s, p) => s + (isPaHit(p.result) ? 1 : 0), 0);
}

export function totalRunsTop(pas: PlateAppearance[]): number {
  return usablePas(pas)
    .filter((p) => p.inning_half === "top")
    .reduce((s, p) => s + runsOnPaForLinescore(p), 0);
}

export function totalRunsBottom(pas: PlateAppearance[]): number {
  return usablePas(pas)
    .filter((p) => p.inning_half === "bottom")
    .reduce((s, p) => s + runsOnPaForLinescore(p), 0);
}

/** Batter’s PA result is reached on error (no hit credit). */
export function isReachedOnError(pa: PlateAppearance): boolean {
  return pa.result === "reached_on_error";
}

/**
 * Count this PA as one team error on the linescore (ROE, or 1B/2B/3B with a charged fielder).
 */
export function paCountsAsDefensiveErrorForLinescore(pa: PlateAppearance): boolean {
  if (pa.result === "reached_on_error") return true;
  if (
    pa.error_fielder_id &&
    (pa.result === "single" || pa.result === "double" || pa.result === "triple")
  ) {
    return true;
  }
  return false;
}

/**
 * Errors charged to the **home** team (they are fielding in the top of each inning).
 */
export function totalErrorsChargedToHome(pas: PlateAppearance[]): number {
  return usablePas(pas).filter(
    (p) => p.inning_half === "top" && paCountsAsDefensiveErrorForLinescore(p)
  ).length;
}

/**
 * Errors charged to the **away** team (they field in the bottom of each inning).
 */
export function totalErrorsChargedToAway(pas: PlateAppearance[]): number {
  return usablePas(pas).filter(
    (p) => p.inning_half === "bottom" && paCountsAsDefensiveErrorForLinescore(p)
  ).length;
}

/**
 * How many inning columns to show (1..N). At least regulation length; expands for extras.
 */
export function boxScoreInningColumnCount(
  pas: PlateAppearance[],
  liveInning: number
): number {
  let max = REGULATION_INNINGS;
  for (const p of pas) {
    if (typeof p.inning === "number" && p.inning > max) max = p.inning;
  }
  if (liveInning > max) max = liveInning;
  return max;
}

/**
 * Away (top) cell for inning column k (1-based). null = show placeholder dash (not reached yet).
 */
export function awayInningCell(
  pas: PlateAppearance[],
  k: number,
  liveInning: number
): number | null {
  if (k > liveInning) return null;
  return sumRunsTopInning(pas, k);
}

/**
 * Home (bottom) cell for inning column k. null = placeholder dash.
 */
export function homeInningCell(
  pas: PlateAppearance[],
  k: number,
  liveInning: number,
  liveHalf: "top" | "bottom" | null
): number | null {
  const half = liveHalf ?? "top";
  if (k > liveInning) return null;
  if (k === liveInning && half === "top") return null;
  return sumRunsBottomInning(pas, k);
}

/**
 * When the form clears `inningHalf` after save, infer top vs bottom from the latest PA
 * in the same inning so the linescore placeholders stay accurate.
 */
/**
 * Read-only linescore “live” pointer from saved PAs (Coach dashboard polling).
 * After the last top-half PA, still in that inning with home yet to bat.
 * After the last bottom-half PA, next column is the following inning’s top.
 */
export function inferLiveLinescoreFromPAs(pas: PlateAppearance[]): {
  liveInning: number;
  liveHalf: "top" | "bottom" | null;
} {
  const usable = usablePas(pas);
  if (usable.length === 0) {
    return { liveInning: 1, liveHalf: "top" };
  }
  const sorted = [...usable].sort(
    (a, b) =>
      new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
  );
  const last = sorted[sorted.length - 1]!;
  const inn = Math.max(1, last.inning ?? 1);
  if (last.inning_half === "top") {
    return { liveInning: inn, liveHalf: "top" };
  }
  if (last.inning_half === "bottom") {
    return { liveInning: inn + 1, liveHalf: "top" };
  }
  return { liveInning: inn, liveHalf: null };
}

export function effectiveInningHalfForLinescore(
  liveInning: number,
  liveHalf: "top" | "bottom" | null,
  pas: PlateAppearance[]
): "top" | "bottom" {
  if (liveHalf !== null) return liveHalf;
  const sorted = [...pas].sort(
    (a, b) =>
      new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
  );
  const last = sorted[sorted.length - 1];
  if (!last?.inning_half) return "top";
  /** Form inning moved past last save — new half-inning is top. */
  if (last.inning < liveInning) return "top";
  /** User set inning earlier than last PA (rare) — assume top. */
  if (last.inning > liveInning) return "top";
  return last.inning_half;
}
