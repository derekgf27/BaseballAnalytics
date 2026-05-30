import { MAX_SELECTABLE_INNING } from "@/lib/leagueConfig";
import { RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT } from "@/lib/record/recordPageConstants";
import { parsePersistedBattedBallType } from "@/lib/record/recordBattedBall";
import {
  hasRunnersOnBaseForm,
  occupiedRunnerIdsFromForm,
} from "@/lib/record/recordRunnerState";
import type { Dispatch, SetStateAction } from "react";
import type { DraftPitchRow, PersistedRecordFormState } from "@/lib/record/recordPageTypes";
import type { BaseState } from "@/lib/types";

type Setter<T> = Dispatch<SetStateAction<T>>;

export type RecordFormSetters = {
  setInning: Setter<number>;
  setInningHalf: Setter<"top" | "bottom">;
  setOuts: Setter<number>;
  setBaseState: Setter<BaseState>;
  setRunnerOn1bId: Setter<string | null>;
  setRunnerOn2bId: Setter<string | null>;
  setRunnerOn3bId: Setter<string | null>;
  setBatterId: Setter<string | null>;
  setResult: Setter<PersistedRecordFormState["result"]>;
  setCountBalls: Setter<number>;
  setCountStrikes: Setter<number>;
  setRbi: Setter<number>;
  setRunsScoredPlayerIds: Setter<string[]>;
  setUnearnedRunsScoredPlayerIds: Setter<string[]>;
  setInheritedForPriorPitcher: Setter<{ chargeId: string | null; runnerIds: string[] }>;
  setHitDirection: Setter<PersistedRecordFormState["hitDirection"]>;
  setBattedBallType: Setter<PersistedRecordFormState["battedBallType"]>;
  setPitcherId: Setter<string | null>;
  setPitcherBySide: Setter<{ home: string | null; away: string | null }>;
  setPitchesSeen: Setter<number | "">;
  setStrikesThrown: Setter<number | "">;
  setFirstCountFromZero: Setter<"ball" | "strike" | null>;
  setPlayNote: Setter<string>;
  setNotes: Setter<string>;
  setErrorFielderId: Setter<string | null>;
  setNextBatterIndexBySide: Setter<{ away: number; home: number }>;
  setBattingTablePeekOther: Setter<boolean>;
  setDraftPitchLog: Setter<DraftPitchRow[]>;
};

/** Apply a persisted mid-PA draft blob to React state (game switch + multi-tab sync). */
export function applyPersistedRecordFormState(saved: PersistedRecordFormState, setters: RecordFormSetters) {
  setters.setInning(Math.max(1, Math.min(saved.inning ?? 1, MAX_SELECTABLE_INNING)));
  setters.setInningHalf(saved.inningHalf === "bottom" ? "bottom" : "top");
  setters.setOuts(Math.max(0, Math.min(saved.outs ?? 0, 2)));
  setters.setBaseState((saved.baseState ?? "000") as BaseState);
  setters.setRunnerOn1bId(saved.runnerOn1bId ?? null);
  setters.setRunnerOn2bId(saved.runnerOn2bId ?? null);
  setters.setRunnerOn3bId(saved.runnerOn3bId ?? null);
  setters.setBatterId(saved.batterId ?? null);
  setters.setResult(saved.result ?? null);
  setters.setCountBalls(Math.max(0, Math.min(saved.countBalls ?? 0, 3)));
  setters.setCountStrikes(Math.max(0, Math.min(saved.countStrikes ?? 0, 3)));
  setters.setRbi(Math.max(0, saved.rbi ?? 0));
  const loadedScorers = Array.isArray(saved.runsScoredPlayerIds) ? saved.runsScoredPlayerIds : [];
  setters.setRunsScoredPlayerIds(loadedScorers);
  const loadedUe = Array.isArray(saved.unearnedRunsScoredPlayerIds)
    ? saved.unearnedRunsScoredPlayerIds
    : [];
  setters.setUnearnedRunsScoredPlayerIds(loadedUe.filter((id) => loadedScorers.includes(id)));
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
    setters.setInheritedForPriorPitcher({
      chargeId: runnerIds.length > 0 ? chargeId : null,
      runnerIds,
    });
  } else {
    setters.setInheritedForPriorPitcher({ chargeId: null, runnerIds: [] });
  }
  setters.setHitDirection(saved.hitDirection ?? null);
  setters.setBattedBallType(parsePersistedBattedBallType(saved.battedBallType));
  setters.setPitcherId(saved.pitcherId ?? null);
  setters.setPitcherBySide(saved.pitcherBySide ?? { home: null, away: null });
  setters.setPitchesSeen(saved.pitchesSeen ?? "");
  setters.setStrikesThrown(saved.strikesThrown ?? "");
  setters.setFirstCountFromZero(saved.firstCountFromZero ?? null);
  setters.setPlayNote(saved.playNote ?? "");
  setters.setNotes(saved.notes ?? "");
  setters.setErrorFielderId(
    typeof saved.errorFielderId === "string" &&
      saved.errorFielderId &&
      saved.result !== "hr" &&
      (saved.result == null ||
        saved.result === "reached_on_error" ||
        RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT.has(saved.result) ||
        hasRunnersOnBaseForm(String(saved.baseState ?? "000")))
      ? saved.errorFielderId
      : null
  );
  setters.setNextBatterIndexBySide(saved.nextBatterIndexBySide ?? { away: 0, home: 0 });
  setters.setBattingTablePeekOther(saved.battingTablePeekOther ?? false);
  if (
    saved.draftPitchLogRows &&
    Array.isArray(saved.draftPitchLogRows) &&
    saved.draftPitchLogRows.length > 0
  ) {
    setters.setDraftPitchLog(
      saved.draftPitchLogRows.map((row) => ({
        balls_before: row.balls_before,
        strikes_before: row.strikes_before,
        outcome: row.outcome,
        clientKey:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `p-${Date.now()}-${Math.random()}`,
      }))
    );
  } else {
    setters.setDraftPitchLog([]);
  }
}

export function resetRecordFormToEmpty(setters: RecordFormSetters) {
  setters.setInning(1);
  setters.setInningHalf("top");
  setters.setOuts(0);
  setters.setBaseState("000");
  setters.setRunnerOn1bId(null);
  setters.setRunnerOn2bId(null);
  setters.setRunnerOn3bId(null);
  setters.setBattingTablePeekOther(false);
  setters.setPitcherId(null);
  setters.setPitcherBySide({ home: null, away: null });
  setters.setRunsScoredPlayerIds([]);
  setters.setUnearnedRunsScoredPlayerIds([]);
  setters.setInheritedForPriorPitcher({ chargeId: null, runnerIds: [] });
  setters.setDraftPitchLog([]);
  setters.setErrorFielderId(null);
}
