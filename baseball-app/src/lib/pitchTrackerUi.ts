import type { PitchTrackerLogResult, PitchTrackerPitchType } from "@/lib/types";

export const PITCH_TRACKER_TYPES: readonly PitchTrackerPitchType[] = [
  "fastball",
  "slider",
  "curveball",
  "changeup",
] as const;

export function pitchTrackerTypeLabel(t: PitchTrackerPitchType): string {
  switch (t) {
    case "fastball":
      return "Fastball";
    case "slider":
      return "Slider";
    case "curveball":
      return "Curveball";
    case "changeup":
      return "Changeup";
    default: {
      const _e: never = t;
      return _e;
    }
  }
}

/** Short labels for sequence chips (e.g. FB → SL). */
export function pitchTrackerAbbrev(t: PitchTrackerPitchType): string {
  switch (t) {
    case "fastball":
      return "FB";
    case "slider":
      return "SL";
    case "curveball":
      return "CB";
    case "changeup":
      return "CH";
    default: {
      const _e: never = t;
      return _e;
    }
  }
}

/** Tailwind classes for pitch type chips / buttons. */
export function pitchTrackerTypeChipClass(t: PitchTrackerPitchType): string {
  switch (t) {
    case "fastball":
      return "bg-emerald-600/90 text-white border-emerald-400/50";
    case "slider":
      return "bg-blue-600/90 text-white border-blue-400/50";
    case "curveball":
      return "bg-amber-500/95 text-zinc-950 border-amber-300/60";
    case "changeup":
      return "bg-violet-600/90 text-white border-violet-400/50";
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
      return "Called strike";
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
      return "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 border-emerald-400/60 shadow-emerald-900/40";
    case "slider":
      return "bg-blue-600 hover:bg-blue-500 active:bg-blue-700 border-blue-400/60 shadow-blue-900/40";
    case "curveball":
      return "bg-amber-500 hover:bg-amber-400 active:bg-amber-600 border-amber-300/70 text-zinc-950 shadow-amber-900/30";
    case "changeup":
      return "bg-violet-600 hover:bg-violet-500 active:bg-violet-700 border-violet-400/60 shadow-violet-900/40";
    default: {
      const _e: never = t;
      return _e;
    }
  }
}
