import type { PitchOutcome } from "@/lib/types";

const PITCH_LOG_BTN = "record-pitch-log-btn";

function pitchLogBtnModifier(outcome: PitchOutcome | "undo" | "clear"): string {
  return `${PITCH_LOG_BTN} record-pitch-log-btn--${outcome.replace(/_/g, "-")}`;
}

export function pitchLogOutcomePadClass(outcome: PitchOutcome): string {
  return pitchLogBtnModifier(outcome);
}

export function pitchLogOutcomeSequenceBorderClass(outcome: PitchOutcome): string {
  switch (outcome) {
    case "ball":
    case "called_strike":
    case "swinging_strike":
    case "foul":
      return `record-pitch-seq-border record-pitch-seq-border--${outcome.replace(/_/g, "-")}`;
    default:
      return "record-pitch-seq-border record-pitch-seq-border--default";
  }
}

export const PITCH_LOG_UNDO_PAD_CLASS = pitchLogBtnModifier("undo");
export const PITCH_LOG_CLEAR_PAD_CLASS = pitchLogBtnModifier("clear");
