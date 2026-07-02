"use client";

import { useEffect, type MutableRefObject } from "react";
import { isTypingInFormField } from "@/lib/record/recordKeyboard";
import {
  outcomeIndexFromDigitKey,
  resultBlockedByPitchCount,
} from "@/lib/record/recordPaOutcome";
import { RESULT_OPTIONS } from "@/lib/record/recordPageConstants";
import type { PAResult } from "@/lib/types";

export interface UseRecordKeyboardShortcutsOptions {
  selectedGameId: string | null;
  recordLocked: boolean;
  batterId: string | null;
  result: PAResult | null;
  errorFielderId: string | null;
  substitutionModalOpen: boolean;
  pitcherChangeModalOpen: boolean;
  finalizeModalOpen: boolean;
  destructiveConfirm: null | "undoLastPa" | "clearGamePas";
  errorFielderModalMode: string | null;
  shortcutsHelpOpen: boolean;
  quickAddPlayerOpen: boolean;
  quickAddPitcherOpen: boolean;
  canQuickAddOpponentPlayer: boolean;
  savePaDisabled: boolean;
  batterSelectRef: MutableRefObject<HTMLSelectElement | null>;
  outcomeCountGateRef: MutableRefObject<{ balls: number; strikes: number }>;
  prevResultBeforeRoeModalRef: MutableRefObject<PAResult | null>;
  prevErrorFielderIdBeforeRoeModalRef: MutableRefObject<string | null>;
  handleSaveRef: MutableRefObject<() => void>;
  advanceToNextLineupBatterRef: MutableRefObject<() => void>;
  repeatLastSavedOutcomeRef: MutableRefObject<() => void>;
  setShortcutsHelpOpen: (open: boolean) => void;
  setQuickAddPlayerOpen: (open: boolean) => void;
  setSubstitutionModalOpen: (open: boolean) => void;
  setPitcherChangeModalOpen: (open: boolean) => void;
  setResult: (value: PAResult | null) => void;
  setErrorFielderId: (value: string | null) => void;
  setHitDirection: (value: null) => void;
  setBattedBallType: (value: null) => void;
  setErrorFielderModalMode: (mode: null | "roe" | "hit") => void;
}

export function useRecordKeyboardShortcuts(options: UseRecordKeyboardShortcutsOptions): void {
  const {
    selectedGameId,
    recordLocked,
    batterId,
    result,
    errorFielderId,
    substitutionModalOpen,
    pitcherChangeModalOpen,
    finalizeModalOpen,
    destructiveConfirm,
    errorFielderModalMode,
    shortcutsHelpOpen,
    quickAddPlayerOpen,
    quickAddPitcherOpen,
    canQuickAddOpponentPlayer,
    savePaDisabled,
    batterSelectRef,
    outcomeCountGateRef,
    prevResultBeforeRoeModalRef,
    prevErrorFielderIdBeforeRoeModalRef,
    handleSaveRef,
    advanceToNextLineupBatterRef,
    repeatLastSavedOutcomeRef,
    setShortcutsHelpOpen,
    setQuickAddPlayerOpen,
    setSubstitutionModalOpen,
    setPitcherChangeModalOpen,
    setResult,
    setErrorFielderId,
    setHitDirection,
    setBattedBallType,
    setErrorFielderModalMode,
  } = options;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedGameId || recordLocked) return;
      const blockNavShortcuts =
        substitutionModalOpen ||
        pitcherChangeModalOpen ||
        finalizeModalOpen ||
        destructiveConfirm != null ||
        errorFielderModalMode != null ||
        quickAddPlayerOpen ||
        quickAddPitcherOpen;
      if (blockNavShortcuts) return;
      if (shortcutsHelpOpen) {
        if (e.key === "Escape") {
          setShortcutsHelpOpen(false);
          e.preventDefault();
        }
        return;
      }
      if (isTypingInFormField(e.target)) return;

      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setShortcutsHelpOpen(true);
        return;
      }
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        batterSelectRef.current?.focus();
        return;
      }
      if (e.key === "j" || e.key === "J") {
        if (!batterId) return;
        e.preventDefault();
        advanceToNextLineupBatterRef.current();
        return;
      }
      if (e.key === "s" || e.key === "S") {
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        e.preventDefault();
        setSubstitutionModalOpen(true);
        return;
      }
      if (e.key === "p" || e.key === "P") {
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        e.preventDefault();
        setPitcherChangeModalOpen(true);
        return;
      }
      if ((e.key === "a" || e.key === "A") && canQuickAddOpponentPlayer) {
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        e.preventDefault();
        setQuickAddPlayerOpen(true);
        return;
      }
      if (e.key === "r" || e.key === "R") {
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        e.preventDefault();
        repeatLastSavedOutcomeRef.current();
        return;
      }

      if (!batterId) return;
      if (e.key === "Enter") {
        if (!savePaDisabled) handleSaveRef.current();
        return;
      }
      if (e.key >= "0" && e.key <= "9") {
        const idx = outcomeIndexFromDigitKey(e.key);
        if (idx == null) return;
        const opt = RESULT_OPTIONS[idx];
        if (!opt) return;
        const { balls, strikes } = outcomeCountGateRef.current;
        if (result === opt.value) {
          setResult(null);
          setErrorFielderId(null);
          setHitDirection(null);
          setBattedBallType(null);
          e.preventDefault();
          return;
        }
        if (resultBlockedByPitchCount(opt.value, balls, strikes)) return;
        if (opt.value === "reached_on_error") {
          prevResultBeforeRoeModalRef.current = result;
          prevErrorFielderIdBeforeRoeModalRef.current = errorFielderId;
          setResult("reached_on_error");
          setErrorFielderModalMode("roe");
        } else {
          setResult(opt.value);
        }
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    selectedGameId,
    recordLocked,
    batterId,
    result,
    errorFielderId,
    substitutionModalOpen,
    pitcherChangeModalOpen,
    finalizeModalOpen,
    destructiveConfirm,
    errorFielderModalMode,
    shortcutsHelpOpen,
    quickAddPlayerOpen,
    quickAddPitcherOpen,
    canQuickAddOpponentPlayer,
    savePaDisabled,
    batterSelectRef,
    outcomeCountGateRef,
    prevResultBeforeRoeModalRef,
    prevErrorFielderIdBeforeRoeModalRef,
    handleSaveRef,
    advanceToNextLineupBatterRef,
    repeatLastSavedOutcomeRef,
    setShortcutsHelpOpen,
    setQuickAddPlayerOpen,
    setSubstitutionModalOpen,
    setPitcherChangeModalOpen,
    setResult,
    setErrorFielderId,
    setHitDirection,
    setBattedBallType,
    setErrorFielderModalMode,
  ]);
}
