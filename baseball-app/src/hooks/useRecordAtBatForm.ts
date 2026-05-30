"use client";

import { useCallback, useMemo, useReducer, type Dispatch } from "react";
import {
  createInitialRecordAtBatState,
  recordAtBatReducer,
  type RecordAtBatAction,
  type RecordAtBatState,
} from "@/lib/record/recordAtBatReducer";
import type { RecordFormSetters } from "@/lib/record/recordFormApply";
import type { PersistedRecordFormState } from "@/lib/record/recordPageTypes";

function createSetters(dispatch: Dispatch<RecordAtBatAction>): RecordFormSetters {
  return {
    setInning: (value) => dispatch({ type: "setField", key: "inning", value }),
    setInningHalf: (value) => dispatch({ type: "setField", key: "inningHalf", value }),
    setOuts: (value) => dispatch({ type: "setField", key: "outs", value }),
    setBaseState: (value) => dispatch({ type: "setField", key: "baseState", value }),
    setRunnerOn1bId: (value) => dispatch({ type: "setField", key: "runnerOn1bId", value }),
    setRunnerOn2bId: (value) => dispatch({ type: "setField", key: "runnerOn2bId", value }),
    setRunnerOn3bId: (value) => dispatch({ type: "setField", key: "runnerOn3bId", value }),
    setBatterId: (value) => dispatch({ type: "setField", key: "batterId", value }),
    setResult: (value) => dispatch({ type: "setField", key: "result", value }),
    setCountBalls: (value) => dispatch({ type: "setField", key: "countBalls", value }),
    setCountStrikes: (value) => dispatch({ type: "setField", key: "countStrikes", value }),
    setRbi: (value) => dispatch({ type: "setField", key: "rbi", value }),
    setRunsScoredPlayerIds: (value) =>
      dispatch({ type: "setField", key: "runsScoredPlayerIds", value }),
    setUnearnedRunsScoredPlayerIds: (value) =>
      dispatch({ type: "setField", key: "unearnedRunsScoredPlayerIds", value }),
    setInheritedForPriorPitcher: (value) =>
      dispatch({ type: "setField", key: "inheritedForPriorPitcher", value }),
    setHitDirection: (value) => dispatch({ type: "setField", key: "hitDirection", value }),
    setBattedBallType: (value) => dispatch({ type: "setField", key: "battedBallType", value }),
    setPitcherId: (value) => dispatch({ type: "setField", key: "pitcherId", value }),
    setPitcherBySide: (value) => dispatch({ type: "setField", key: "pitcherBySide", value }),
    setPitchesSeen: (value) => dispatch({ type: "setField", key: "pitchesSeen", value }),
    setStrikesThrown: (value) => dispatch({ type: "setField", key: "strikesThrown", value }),
    setFirstCountFromZero: (value) =>
      dispatch({ type: "setField", key: "firstCountFromZero", value }),
    setPlayNote: (value) => dispatch({ type: "setField", key: "playNote", value }),
    setNotes: (value) => dispatch({ type: "setField", key: "notes", value }),
    setErrorFielderId: (value) => dispatch({ type: "setField", key: "errorFielderId", value }),
    setNextBatterIndexBySide: (value) =>
      dispatch({ type: "setField", key: "nextBatterIndexBySide", value }),
    setBattingTablePeekOther: (value) =>
      dispatch({ type: "setField", key: "battingTablePeekOther", value }),
    setDraftPitchLog: (value) => dispatch({ type: "setField", key: "draftPitchLog", value }),
  };
}

export function useRecordAtBatForm(initialBatterId: string | null) {
  const [state, dispatch] = useReducer(
    recordAtBatReducer,
    initialBatterId,
    createInitialRecordAtBatState
  );

  const recordFormSetters = useMemo(() => createSetters(dispatch), []);

  const applySavedFormFromStorage = useCallback((saved: PersistedRecordFormState) => {
    dispatch({ type: "applyPersisted", saved });
  }, []);

  const resetFormEmpty = useCallback(() => {
    dispatch({ type: "resetEmpty" });
  }, []);

  const clearNewPaDraftFields = useCallback(() => {
    dispatch({ type: "clearNewPaDraft" });
  }, []);

  const clearAtBatForm = useCallback((batterId: string | null) => {
    dispatch({ type: "clearForm", batterId });
  }, []);

  const setters = recordFormSetters;

  return {
    ...state,
    ...setters,
    dispatch,
    recordFormSetters,
    applySavedFormFromStorage,
    resetFormEmpty,
    clearNewPaDraftFields,
    clearAtBatForm,
  };
}
