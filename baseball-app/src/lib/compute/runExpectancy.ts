/**
 * Run Expectancy (RE) from internal team data.
 * - Builds RE table from all plate appearances (expected runs from each base/out state).
 * - Run value of an event = RE_after - RE_before + runs scored.
 * - Run impact = difference between two decisions (e.g. bunt vs swing).
 */

import type { BaseState, PAResult } from "@/lib/types";

const BASE_STATES: BaseState[] = [
  "000", "100", "010", "001", "110", "101", "011", "111",
];

const OUTS = [0, 1, 2] as const;

export type REState = { base_state: BaseState; outs: 0 | 1 | 2 };

/** One row of PA data needed to build RE (runs from this PA to end of half-inning). */
export type PAForRE = {
  game_id: string;
  inning: number;
  inning_half?: string | null;
  base_state: BaseState;
  outs: number;
  rbi: number;
  created_at?: string;
};

/** Run expectancy table: (base_state, outs) -> expected runs to end of inning. */
export type RETable = Record<string, number>;

/** Build RE table from ordered PAs. Groups by (game_id, inning, inning_half), then for each PA records (base_state, outs) and runs from that PA to end of half. */
export function buildRETable(pas: PAForRE[]): RETable {
  const key = (b: BaseState, o: number) => `${b}_${o}`;
  const runsByState: Record<string, number[]> = {};
  for (const b of BASE_STATES) {
    for (const o of OUTS) {
      runsByState[key(b, o)] = [];
    }
  }
  runsByState["xxx_3"] = []; // 3 outs = 0 runs (we don't record PAs at 3 outs, but we use it for lookups)

  const groups = new Map<string, PAForRE[]>();
  for (const pa of pas) {
    const g = `${pa.game_id}|${pa.inning}|${pa.inning_half ?? "x"}`;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(pa);
  }

  for (const [, group] of groups) {
    const sorted = [...group].sort(
      (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
    );
    for (let i = 0; i < sorted.length; i++) {
      const pa = sorted[i];
      const runsFromHere = sorted.slice(i).reduce((s, p) => s + (p.rbi ?? 0), 0);
      const o = Math.min(2, pa.outs) as 0 | 1 | 2;
      const b = String(pa.base_state).padStart(3, "0").slice(0, 3);
      if (/^[01]{3}$/.test(b)) {
        runsByState[key(b as BaseState, o)].push(runsFromHere);
      }
    }
  }

  const table: RETable = {};
  for (const b of BASE_STATES) {
    for (const o of OUTS) {
      const arr = runsByState[key(b, o)] ?? [];
      table[key(b, o)] = arr.length > 0 ? arr.reduce((a, x) => a + x, 0) / arr.length : NaN;
    }
  }
  table[key("000", 3 as unknown as number)] = 0;
  return table;
}

/** Expected runs remaining in the inning from (base_state, outs). 3 outs = 0. */
export function getExpectedRunsRemaining(reTable: RETable, baseState: BaseState, outs: number): number {
  if (outs >= 3) return 0;
  const b = String(baseState).padStart(3, "0").slice(0, 3);
  const k = `${b}_${outs}`;
  const v = reTable[k];
  return typeof v === "number" && !Number.isNaN(v) ? v : 0;
}

/** Normalize base state to 3 chars 0/1 (1st, 2nd, 3rd). */
function norm(baseState: BaseState): BaseState {
  const s = String(baseState).replace(/[^01]/g, "0").padStart(3, "0").slice(0, 3);
  return (s as BaseState) || "000";
}

/** Simple state transition: (base_state, outs, result) -> (new_base_state, new_outs). Approximate; uses standard advancement. */
function transitionState(
  baseState: BaseState,
  outs: number,
  result: PAResult
): { base_state: BaseState; outs: number } {
  const b = norm(baseState);
  const o = Math.min(2, Math.max(0, outs));

  if (result === "hr") {
    return { base_state: "000", outs: o };
  }
  if (result === "triple") {
    return { base_state: "001", outs: o }; // runner on 3rd
  }
  if (result === "double") {
    // Runners advance 2; batter on 2nd. Simplified: 000->010, 100->010, 010->010, 001->010, 110->010, 101->010, 011->010, 111->010
    return { base_state: "010", outs: o };
  }
  if (result === "single" || result === "bb" || result === "ibb" || result === "hbp") {
    // All advance 1, batter to 1st. 000->100, 100->110, 010->110, 001->101, 110->111, 101->111, 011->111, 111->111
    const one = b[0] === "1" ? 1 : 0;
    const two = b[1] === "1" ? 1 : 0;
    const three = b[2] === "1" ? 1 : 0;
    const n1 = 1;
    const n2 = one;
    const n3 = two;
    const newB = `${n1}${n2}${n3}` as BaseState;
    return { base_state: newB, outs: o };
  }
  if (result === "sac_fly" || result === "sac") {
    const newOuts = Math.min(2, o + 1);
    if (b[2] === "1") {
      const newB = (b[0] + b[1] + "0") as BaseState;
      return { base_state: newB, outs: newOuts };
    }
    return { base_state: b, outs: newOuts };
  }
  if (result === "sac_bunt") {
    const newOuts = Math.min(2, o + 1);
    const one = b[0] === "1" ? 1 : 0;
    const two = b[1] === "1" ? 1 : 0;
    const three = b[2] === "1" ? 1 : 0;
    const n1 = 1;
    const n2 = one;
    const n3 = two || three;
    const newB = `${n1}${n2}${n3}` as BaseState;
    return { base_state: newB, outs: newOuts };
  }
  if (result === "other") {
    // Reached on error: batter to 1st, runners advance one (no out)
    const one = b[0] === "1" ? 1 : 0;
    const two = b[1] === "1" ? 1 : 0;
    const n1 = 1;
    const n2 = one;
    const n3 = two;
    const newB = `${n1}${n2}${n3}` as BaseState;
    return { base_state: newB, outs: o };
  }
  // out, so: one more out, bases unchanged (simplified; no double-play advancement)
  const newOuts = Math.min(2, o + 1);
  return { base_state: b, outs: newOuts };
}

/** New base state after this result (for advancing game state in Record PAs). */
export function getBaseStateAfterResult(baseState: BaseState, result: PAResult): BaseState {
  return transitionState(baseState, 0, result).base_state;
}

/** Run value of an event: RE_after - RE_before + runs scored on the play. */
export function getRunValueOfEvent(
  reTable: RETable,
  baseState: BaseState,
  outs: number,
  result: PAResult,
  runsOnPlay: number
): number {
  const before = getExpectedRunsRemaining(reTable, baseState, outs);
  const afterState = transitionState(baseState, outs, result);
  const after = getExpectedRunsRemaining(reTable, afterState.base_state, afterState.outs);
  return after - before + runsOnPlay;
}

/** Run impact of choosing event A vs event B (e.g. bunt vs swing). Positive = A is better. */
export function getRunImpact(
  reTable: RETable,
  baseState: BaseState,
  outs: number,
  eventA: { result: PAResult; runsOnPlay: number },
  eventB: { result: PAResult; runsOnPlay: number }
): number {
  const valueA = getRunValueOfEvent(reTable, baseState, outs, eventA.result, eventA.runsOnPlay);
  const valueB = getRunValueOfEvent(reTable, baseState, outs, eventB.result, eventB.runsOnPlay);
  return valueA - valueB;
}

/** Sample counts per state (for UI: show how many PAs built each cell). */
export function buildRECounts(pas: PAForRE[]): Record<string, number> {
  const key = (b: BaseState, o: number) => `${b}_${o}`;
  const counts: Record<string, number> = {};
  for (const b of BASE_STATES) {
    for (const o of OUTS) {
      counts[key(b, o)] = 0;
    }
  }
  for (const pa of pas) {
    const o = Math.min(2, Math.max(0, pa.outs));
    const b = String(pa.base_state).padStart(3, "0").slice(0, 3);
    if (/^[01]{3}$/.test(b)) {
      const k = key(b as BaseState, o);
      counts[k] = (counts[k] ?? 0) + 1;
    }
  }
  return counts;
}

export { BASE_STATES, OUTS };
