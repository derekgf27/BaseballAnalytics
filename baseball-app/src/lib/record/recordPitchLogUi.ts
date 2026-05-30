import type { PitchOutcome } from "@/lib/types";

export function pitchLogOutcomePadClass(outcome: PitchOutcome): string {
  switch (outcome) {
    case "ball":
      return "border-emerald-700/50 bg-emerald-950/80 text-emerald-50 hover:border-emerald-600/55 hover:bg-emerald-900/42";
    case "called_strike":
      return "border-orange-700/55 bg-orange-950/80 text-orange-50 hover:border-orange-600/58 hover:bg-orange-900/45";
    case "swinging_strike":
      return "border-rose-800/50 bg-rose-950/80 text-rose-50 hover:border-rose-700/52 hover:bg-rose-900/40";
    case "foul":
      return "border-blue-800/52 bg-blue-950/80 text-blue-100 hover:border-blue-700/52 hover:bg-blue-900/40";
    default:
      return "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)] hover:border-[var(--accent)]/60 hover:bg-[var(--bg-elevated)]";
  }
}

export function pitchLogOutcomeSequenceBorderClass(outcome: PitchOutcome): string {
  switch (outcome) {
    case "ball":
      return "border-emerald-700/50";
    case "called_strike":
      return "border-orange-700/55";
    case "swinging_strike":
      return "border-rose-800/50";
    case "foul":
      return "border-blue-800/52";
    default:
      return "border-[var(--accent)]/40";
  }
}

export const PITCH_LOG_UNDO_PAD_CLASS =
  "border-zinc-600/35 bg-zinc-800/45 text-zinc-300 hover:border-zinc-500/40 hover:bg-zinc-800/68";
export const PITCH_LOG_CLEAR_PAD_CLASS =
  "border-rose-900/42 bg-rose-950/38 text-rose-200/85 hover:border-rose-800/48 hover:bg-rose-950/52";
