import type { PitchOutcome, PitchTrackerLogResult, PitchTrackerPitchType } from "@/lib/types";

/** Map PA pitch-log outcome to `public.pitches.result` (HBP → ball; no `hbp` column on pitches). */
export function pitchOutcomeToTrackerLogResult(outcome: PitchOutcome): PitchTrackerLogResult {
  if (outcome === "hbp") return "ball";
  return outcome;
}

export const PITCH_TRACKER_TYPES: readonly PitchTrackerPitchType[] = [
  "fastball",
  "sinker",
  "cutter",
  "slider",
  "sweeper",
  "curveball",
  "changeup",
  "splitter",
] as const;

export function pitchTrackerTypeLabel(t: PitchTrackerPitchType | null): string {
  if (t == null) return "Type pending";
  switch (t) {
    case "fastball":
      return "Fastball";
    case "sinker":
      return "Sinker";
    case "cutter":
      return "Cutter";
    case "slider":
      return "Slider";
    case "sweeper":
      return "Sweeper";
    case "curveball":
      return "Curveball";
    case "changeup":
      return "Changeup";
    case "splitter":
      return "Splitter";
    default: {
      const _e: never = t;
      return _e;
    }
  }
}

/** Short labels for sequence chips (e.g. FB → SL). */
export function pitchTrackerAbbrev(t: PitchTrackerPitchType | null): string {
  if (t == null) return "—";
  switch (t) {
    case "fastball":
      return "FB";
    case "sinker":
      return "SI";
    case "cutter":
      return "FC";
    case "slider":
      return "SL";
    case "sweeper":
      return "SW";
    case "curveball":
      return "CB";
    case "changeup":
      return "CH";
    case "splitter":
      return "SP";
    default: {
      const _e: never = t;
      return _e;
    }
  }
}

/** Tailwind classes for pitch type chips / buttons. */
export function pitchTrackerTypeChipClass(t: PitchTrackerPitchType | null): string {
  if (t == null) {
    return "border-zinc-600 bg-zinc-800/70 text-zinc-500";
  }
  switch (t) {
    case "fastball":
      return "bg-rose-600/90 text-white border-rose-400/50";
    case "sinker":
      return "bg-emerald-700/90 text-white border-emerald-400/50";
    case "cutter":
      return "bg-yellow-500/95 text-zinc-950 border-yellow-400/60";
    case "slider":
      return "bg-indigo-600/90 text-white border-indigo-400/50";
    case "sweeper":
      return "bg-cyan-600/90 text-white border-cyan-400/50";
    case "curveball":
      return "bg-orange-600/90 text-white border-orange-400/55";
    case "changeup":
      return "bg-purple-600/90 text-white border-purple-400/50";
    case "splitter":
      return "bg-pink-700/90 text-white border-pink-400/50";
    default: {
      const _e: never = t;
      return _e;
    }
  }
}

/**
 * Label for coach / sequence UI (`pitches.result`).
 * Accepts `string` so legacy DB values (e.g. `strike`) still render without breaking.
 */
export function pitchTrackerLogResultShortLabel(result: PitchTrackerLogResult | null | string): string {
  if (result == null || result === "") return "—";
  switch (result) {
    case "ball":
      return "Ball";
    case "called_strike":
      return "Called";
    case "swinging_strike":
      return "Whiff";
    case "foul":
      return "Foul";
    case "in_play":
      return "In play";
    case "strike":
      return "Strike";
    default:
      return "—";
  }
}

export function pitchTrackerCoachButtonClass(t: PitchTrackerPitchType): string {
  switch (t) {
    case "fastball":
      return "bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 border-rose-400/60 shadow-rose-900/40";
    case "sinker":
      return "bg-emerald-700 text-white hover:bg-emerald-600 active:bg-emerald-800 border-emerald-400/60 shadow-emerald-900/40";
    case "cutter":
      return "bg-yellow-500 text-zinc-950 hover:bg-yellow-400 active:bg-yellow-600 border-yellow-300/70 shadow-yellow-900/30";
    case "slider":
      return "bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 border-indigo-400/60 shadow-indigo-900/40";
    case "sweeper":
      return "bg-cyan-600 text-white hover:bg-cyan-500 active:bg-cyan-700 border-cyan-400/60 shadow-cyan-900/40";
    case "curveball":
      return "bg-orange-600 text-white hover:bg-orange-500 active:bg-orange-700 border-orange-400/60 shadow-orange-900/40";
    case "changeup":
      return "bg-purple-600 text-white hover:bg-purple-500 active:bg-purple-700 border-purple-400/60 shadow-purple-900/40";
    case "splitter":
      return "bg-pink-700 text-white hover:bg-pink-600 active:bg-pink-800 border-pink-400/60 shadow-pink-900/40";
    default: {
      const _e: never = t;
      return _e;
    }
  }
}
