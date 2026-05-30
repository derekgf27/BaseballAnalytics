import type { BaseState, PAResult } from "@/lib/types";

export function normBaseStateBits(baseState: BaseState): string {
  return String(baseState)
    .replace(/[^01]/g, "0")
    .padStart(3, "0")
    .slice(0, 3);
}

export function getRunnerIdsAfterResult(
  runner1b: string | null,
  runner2b: string | null,
  runner3b: string | null,
  batterId: string,
  result: PAResult,
  baseStateBefore: BaseState,
  rbi: number
): [string | null, string | null, string | null] {
  if (result === "hr") return [null, null, null];
  if (result === "triple") return [null, null, batterId];
  if (result === "double") {
    if (normBaseStateBits(baseStateBefore) === "100" && rbi === 0) {
      return [null, batterId, runner1b];
    }
    return [null, batterId, null];
  }
  if (result === "single" || result === "other" || result === "reached_on_error") {
    return [batterId, runner1b, runner2b];
  }
  if (result === "bb" || result === "ibb" || result === "hbp") {
    let next2 = runner2b;
    let next3 = runner3b;
    if (runner1b) {
      if (runner2b) next3 = runner2b;
      next2 = runner1b;
    }
    return [batterId, next2, next3];
  }
  if (result === "sac_fly" || result === "sac") {
    return [runner1b, runner2b, null];
  }
  if (result === "sac_bunt") {
    return [batterId, runner1b, runner2b ?? runner3b];
  }
  if (result === "gidp") {
    return [null, runner2b, runner3b];
  }
  return [runner1b, runner2b, runner3b];
}

export function baseStateFromRunnerIds(
  r1: string | null,
  r2: string | null,
  r3: string | null
): BaseState {
  return `${r1 ? "1" : "0"}${r2 ? "1" : "0"}${r3 ? "1" : "0"}` as BaseState;
}

export function clearScoredRunnersFromSlots(
  r1: string | null,
  r2: string | null,
  r3: string | null,
  scorerIds: string[]
): [string | null, string | null, string | null] {
  if (scorerIds.length === 0) return [r1, r2, r3];
  const s = new Set(scorerIds);
  return [
    r1 && !s.has(r1) ? r1 : null,
    r2 && !s.has(r2) ? r2 : null,
    r3 && !s.has(r3) ? r3 : null,
  ];
}

export function stealDestinationOccupied(
  baseIndex: 0 | 1 | 2,
  runner1b: string | null,
  runner2b: string | null,
  runner3b: string | null,
  baseState: string
): boolean {
  const b = baseState.padStart(3, "0").slice(0, 3);
  const bits = b.split("").map((c) => c === "1");
  if (baseIndex === 0) return bits[1] || runner2b != null;
  if (baseIndex === 1) return bits[2] || runner3b != null;
  return false;
}

export function validateStealAttempt(
  baseIndex: 0 | 1 | 2,
  runnerId: string,
  runner1b: string | null,
  runner2b: string | null,
  runner3b: string | null,
  baseState: string
): { ok: true } | { ok: false; message: string } {
  if (baseIndex === 0) {
    if (runner1b !== runnerId) return { ok: false, message: "Select the runner who is on 1st base." };
    if (stealDestinationOccupied(baseIndex, runner1b, runner2b, runner3b, baseState)) {
      return { ok: false, message: "2nd base is occupied — a runner can’t steal there until it’s clear." };
    }
    return { ok: true };
  }
  if (baseIndex === 1) {
    if (runner2b !== runnerId) return { ok: false, message: "Select the runner who is on 2nd base." };
    if (stealDestinationOccupied(baseIndex, runner1b, runner2b, runner3b, baseState)) {
      return { ok: false, message: "3rd base is occupied — a runner can’t steal there until it’s clear." };
    }
    return { ok: true };
  }
  if (runner3b !== runnerId) return { ok: false, message: "Select the runner who is on 3rd base." };
  return { ok: true };
}

export function advanceRunnersAfterStolenBase(
  baseIndex: 0 | 1 | 2,
  runnerId: string,
  runner1b: string | null,
  runner2b: string | null,
  runner3b: string | null,
  baseState: string
): { runner1b: string | null; runner2b: string | null; runner3b: string | null; baseState: BaseState } | null {
  const b = baseState.padStart(3, "0").slice(0, 3);
  const bits = b.split("").map((c) => c === "1");
  const bitsToState = (nb: boolean[]): BaseState =>
    nb.map((x) => (x ? "1" : "0")).join("") as BaseState;

  if (baseIndex === 0) {
    if (runner1b !== runnerId) return null;
    if (bits[1] || runner2b != null) return null;
    const newBits = [false, true, bits[2]];
    return {
      runner1b: null,
      runner2b: runnerId,
      runner3b,
      baseState: bitsToState(newBits),
    };
  }
  if (baseIndex === 1) {
    if (runner2b !== runnerId) return null;
    if (bits[2] || runner3b != null) return null;
    const newBits = [bits[0], false, true];
    return {
      runner1b,
      runner2b: null,
      runner3b: runnerId,
      baseState: bitsToState(newBits),
    };
  }
  if (runner3b !== runnerId) return null;
  const newBits = [bits[0], bits[1], false];
  return {
    runner1b,
    runner2b,
    runner3b: null,
    baseState: bitsToState(newBits),
  };
}

export function removeRunnerAfterCaughtStealing(
  baseIndex: 0 | 1 | 2,
  runnerId: string,
  runner1b: string | null,
  runner2b: string | null,
  runner3b: string | null,
  baseState: string
): { runner1b: string | null; runner2b: string | null; runner3b: string | null; baseState: BaseState } | null {
  const b = baseState.padStart(3, "0").slice(0, 3);
  const bits = b.split("").map((c) => c === "1");
  const bitsToState = (nb: boolean[]): BaseState =>
    nb.map((x) => (x ? "1" : "0")).join("") as BaseState;

  if (baseIndex === 0) {
    if (runner1b !== runnerId) return null;
    const newBits = [false, bits[1], bits[2]];
    return {
      runner1b: null,
      runner2b,
      runner3b,
      baseState: bitsToState(newBits),
    };
  }
  if (baseIndex === 1) {
    if (runner2b !== runnerId) return null;
    const newBits = [bits[0], false, bits[2]];
    return {
      runner1b,
      runner2b: null,
      runner3b,
      baseState: bitsToState(newBits),
    };
  }
  if (runner3b !== runnerId) return null;
  const newBits = [bits[0], bits[1], false];
  return {
    runner1b,
    runner2b,
    runner3b: null,
    baseState: bitsToState(newBits),
  };
}

export function hasRunnersOnBaseForm(baseState: string): boolean {
  const b = baseState.padStart(3, "0").slice(0, 3);
  return b.includes("1");
}

export function occupiedRunnerIdsFromForm(
  baseState: string,
  runner1b: string | null,
  runner2b: string | null,
  runner3b: string | null
): string[] {
  const b = baseState.padStart(3, "0").slice(0, 3);
  const out: string[] = [];
  if (b[0] === "1" && runner1b) out.push(runner1b);
  if (b[1] === "1" && runner2b) out.push(runner2b);
  if (b[2] === "1" && runner3b) out.push(runner3b);
  return out;
}
