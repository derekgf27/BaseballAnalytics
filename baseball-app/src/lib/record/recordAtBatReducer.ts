import { MAX_SELECTABLE_INNING } from "@/lib/leagueConfig";
import { RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT } from "@/lib/record/recordPageConstants";
import { parsePersistedBattedBallType } from "@/lib/record/recordBattedBall";
import { normalizeErrorFielderIds } from "@/lib/record/recordPaFielding";
import {
  hasRunnersOnBaseForm,
  occupiedRunnerIdsFromForm,
} from "@/lib/record/recordRunnerState";
import type { DraftPitchRow, InheritedForPriorPitcher, PersistedRecordFormState } from "@/lib/record/recordPageTypes";
import type { BaseState, BattedBallType, HitDirection, PAResult } from "@/lib/types";

export type RecordAtBatState = {
  inning: number;
  inningHalf: "top" | "bottom";
  outs: number;
  baseState: BaseState;
  runnerOn1bId: string | null;
  runnerOn2bId: string | null;
  runnerOn3bId: string | null;
  batterId: string | null;
  result: PAResult | null;
  countBalls: number;
  countStrikes: number;
  rbi: number;
  runsScoredPlayerIds: string[];
  unearnedRunsScoredPlayerIds: string[];
  inheritedForPriorPitcher: InheritedForPriorPitcher;
  errorFielderIds: string[];
  hitDirection: HitDirection | null;
  battedBallType: BattedBallType | null;
  pitcherId: string | null;
  pitcherBySide: { home: string | null; away: string | null };
  pitchesSeen: number | "";
  strikesThrown: number | "";
  firstCountFromZero: "ball" | "strike" | null;
  playNote: string;
  notes: string;
  nextBatterIndexBySide: { away: number; home: number };
  battingTablePeekOther: boolean;
  draftPitchLog: DraftPitchRow[];
};

type SetStateAction<T> = T | ((prev: T) => T);

type RecordAtBatSetFieldAction = {
  [K in keyof RecordAtBatState]: {
    type: "setField";
    key: K;
    value: SetStateAction<RecordAtBatState[K]>;
  };
}[keyof RecordAtBatState];

export type RecordAtBatAction =
  | RecordAtBatSetFieldAction
  | { type: "resetEmpty" }
  | { type: "clearNewPaDraft" }
  | { type: "clearForm"; batterId: string | null }
  | { type: "applyPersisted"; saved: PersistedRecordFormState };

export function createInitialRecordAtBatState(initialBatterId: string | null): RecordAtBatState {
  return {
    inning: 1,
    inningHalf: "top",
    outs: 0,
    baseState: "000",
    runnerOn1bId: null,
    runnerOn2bId: null,
    runnerOn3bId: null,
    batterId: initialBatterId,
    result: null,
    countBalls: 0,
    countStrikes: 0,
    rbi: 0,
    runsScoredPlayerIds: [],
    unearnedRunsScoredPlayerIds: [],
    inheritedForPriorPitcher: { chargeId: null, runnerIds: [] },
    errorFielderIds: [],
    hitDirection: null,
    battedBallType: null,
    pitcherId: null,
    pitcherBySide: { home: null, away: null },
    pitchesSeen: "",
    strikesThrown: "",
    firstCountFromZero: null,
    playNote: "",
    notes: "",
    nextBatterIndexBySide: { away: 0, home: 0 },
    battingTablePeekOther: false,
    draftPitchLog: [],
  };
}

function applyPersistedToState(saved: PersistedRecordFormState): Partial<RecordAtBatState> {
  const loadedScorers = Array.isArray(saved.runsScoredPlayerIds) ? saved.runsScoredPlayerIds : [];
  const loadedUe = Array.isArray(saved.unearnedRunsScoredPlayerIds)
    ? saved.unearnedRunsScoredPlayerIds
    : [];

  let inheritedForPriorPitcher: InheritedForPriorPitcher = { chargeId: null, runnerIds: [] };
  const rawInherited = saved.inheritedForPriorPitcher;
  if (
    rawInherited &&
    typeof rawInherited === "object" &&
    Array.isArray(rawInherited.runnerIds) &&
    (rawInherited.chargeId === null ||
      (typeof rawInherited.chargeId === "string" && rawInherited.chargeId.length > 0))
  ) {
    const chargeId =
      typeof rawInherited.chargeId === "string" && rawInherited.chargeId.length > 0
        ? rawInherited.chargeId
        : null;
    const onBase = new Set(
      occupiedRunnerIdsFromForm(
        (saved.baseState ?? "000") as BaseState,
        saved.runnerOn1bId ?? null,
        saved.runnerOn2bId ?? null,
        saved.runnerOn3bId ?? null
      )
    );
    const runnerIds = rawInherited.runnerIds.filter((id) => onBase.has(id));
    inheritedForPriorPitcher = {
      chargeId: runnerIds.length > 0 ? chargeId : null,
      runnerIds,
    };
  }

  let draftPitchLog: DraftPitchRow[] = [];
  if (
    saved.draftPitchLogRows &&
    Array.isArray(saved.draftPitchLogRows) &&
    saved.draftPitchLogRows.length > 0
  ) {
    draftPitchLog = saved.draftPitchLogRows.map((row) => ({
      balls_before: row.balls_before,
      strikes_before: row.strikes_before,
      outcome: row.outcome,
      clientKey:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `p-${Date.now()}-${Math.random()}`,
    }));
  }

  return {
    inning: Math.max(1, Math.min(saved.inning ?? 1, MAX_SELECTABLE_INNING)),
    inningHalf: saved.inningHalf === "bottom" ? "bottom" : "top",
    outs: Math.max(0, Math.min(saved.outs ?? 0, 2)),
    baseState: (saved.baseState ?? "000") as BaseState,
    runnerOn1bId: saved.runnerOn1bId ?? null,
    runnerOn2bId: saved.runnerOn2bId ?? null,
    runnerOn3bId: saved.runnerOn3bId ?? null,
    batterId: saved.batterId ?? null,
    result: saved.result ?? null,
    countBalls: Math.max(0, Math.min(saved.countBalls ?? 0, 3)),
    countStrikes: Math.max(0, Math.min(saved.countStrikes ?? 0, 3)),
    rbi: Math.max(0, saved.rbi ?? 0),
    runsScoredPlayerIds: loadedScorers,
    unearnedRunsScoredPlayerIds: loadedUe.filter((id) => loadedScorers.includes(id)),
    inheritedForPriorPitcher,
    hitDirection: saved.hitDirection ?? null,
    battedBallType: parsePersistedBattedBallType(saved.battedBallType),
    pitcherId: saved.pitcherId ?? null,
    pitcherBySide: saved.pitcherBySide ?? { home: null, away: null },
    pitchesSeen: saved.pitchesSeen ?? "",
    strikesThrown: saved.strikesThrown ?? "",
    firstCountFromZero: saved.firstCountFromZero ?? null,
    playNote: saved.playNote ?? "",
    notes: saved.notes ?? "",
    errorFielderIds: (() => {
      const fromSaved = normalizeErrorFielderIds(saved.errorFielderIds);
      const legacy =
        typeof saved.errorFielderId === "string" && saved.errorFielderId ? [saved.errorFielderId] : [];
      const ids = fromSaved.length > 0 ? fromSaved : legacy;
      if (ids.length === 0) return [];
      if (saved.result === "hr") return [];
      if (
        saved.result == null ||
        saved.result === "reached_on_error" ||
        RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT.has(saved.result) ||
        hasRunnersOnBaseForm(String(saved.baseState ?? "000"))
      ) {
        return ids;
      }
      return [];
    })(),
    nextBatterIndexBySide: saved.nextBatterIndexBySide ?? { away: 0, home: 0 },
    battingTablePeekOther: saved.battingTablePeekOther ?? false,
    draftPitchLog,
  };
}

export function recordAtBatReducer(state: RecordAtBatState, action: RecordAtBatAction): RecordAtBatState {
  switch (action.type) {
    case "setField": {
      const key = action.key;
      const prev = state[key];
      const next =
        typeof action.value === "function"
          ? (action.value as (p: typeof prev) => typeof prev)(prev)
          : action.value;
      return { ...state, [key]: next };
    }
    case "resetEmpty":
      return {
        ...createInitialRecordAtBatState(null),
        battingTablePeekOther: false,
      };
    case "clearNewPaDraft":
      return {
        ...state,
        result: null,
        countBalls: 0,
        countStrikes: 0,
        rbi: 0,
        runsScoredPlayerIds: [],
        unearnedRunsScoredPlayerIds: [],
        hitDirection: null,
        battedBallType: null,
        pitchesSeen: "",
        strikesThrown: "",
        firstCountFromZero: null,
        playNote: "",
        notes: "",
        errorFielderIds: [],
        draftPitchLog: [],
        inheritedForPriorPitcher: { chargeId: null, runnerIds: [] },
      };
    case "clearForm":
      return {
        ...createInitialRecordAtBatState(action.batterId),
        pitcherId: null,
      };
    case "applyPersisted":
      return { ...state, ...applyPersistedToState(action.saved) };
    default:
      return state;
  }
}
