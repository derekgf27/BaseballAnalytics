import type { BaseState } from "@/lib/types";

/** Shape of `record-form-state:{gameId}` in localStorage (subset for hydration checks). */
export type RecordFormSnapshotShape = {
  inning?: number;
  inningHalf?: "top" | "bottom";
  outs?: number;
  baseState?: BaseState;
  runnerOn1bId?: string | null;
  runnerOn2bId?: string | null;
  runnerOn3bId?: string | null;
  batterId?: string | null;
  result?: unknown;
  countBalls?: number;
  countStrikes?: number;
  rbi?: number;
  runsScoredPlayerIds?: string[];
  draftPitchLogRows?: unknown[];
  playNote?: string;
  notes?: string;
};

/** True when the blob is the empty factory state (not a real in-progress PA draft). */
export function isFactoryDefaultRecordForm(state: RecordFormSnapshotShape): boolean {
  return (
    (state.inning ?? 1) === 1 &&
    (state.inningHalf ?? "top") === "top" &&
    (state.outs ?? 0) === 0 &&
    (state.baseState ?? "000") === "000" &&
    !state.runnerOn1bId &&
    !state.runnerOn2bId &&
    !state.runnerOn3bId &&
    !state.batterId &&
    state.result == null &&
    (state.countBalls ?? 0) === 0 &&
    (state.countStrikes ?? 0) === 0 &&
    (state.rbi ?? 0) === 0 &&
    (!state.runsScoredPlayerIds || state.runsScoredPlayerIds.length === 0) &&
    (!state.draftPitchLogRows || state.draftPitchLogRows.length === 0) &&
    !String(state.playNote ?? "").trim() &&
    !String(state.notes ?? "").trim()
  );
}
