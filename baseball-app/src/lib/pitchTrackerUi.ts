import type { PitchOutcome, PitchTrackerLogResult, PitchTrackerPitchType } from "@/lib/types";

/** Map PA pitch-log outcome to `public.pitches.result` (HBP → ball; no `hbp` column on pitches). */
export function pitchOutcomeToTrackerLogResult(outcome: PitchOutcome): PitchTrackerLogResult {
  if (outcome === "hbp") return "ball";
  return outcome;
}

/** Detailed pitch types — coach pad on defense (our pitcher throwing). */
export const PITCH_TRACKER_TYPES: readonly PitchTrackerPitchType[] = [
  "fastball",
  "slider",
  "sinker",
  "cutter",
  "curveball",
  "changeup",
  "splitter",
] as const;

/** Coarse opponent-pitch buckets — coach pad on offense (we are hitting). */
export const PITCH_TRACKER_OFFENSE_TYPES: readonly PitchTrackerPitchType[] = [
  "fastball",
  "off_speed",
  "breaking_ball",
] as const;

export const ALL_PITCH_TRACKER_TYPES: readonly PitchTrackerPitchType[] = [
  ...PITCH_TRACKER_TYPES,
  "sweeper",
  "off_speed",
  "breaking_ball",
] as const;

export function isPitchTrackerPitchType(raw: string): raw is PitchTrackerPitchType {
  return (ALL_PITCH_TRACKER_TYPES as readonly string[]).includes(raw);
}

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
    case "off_speed":
      return "Off-speed";
    case "breaking_ball":
      return "Breaking ball";
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
      return "SK";
    case "cutter":
      return "CT";
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
    case "off_speed":
      return "OS";
    case "breaking_ball":
      return "BRK";
    default: {
      const _e: never = t;
      return _e;
    }
  }
}

/** Tailwind classes for pitch type chips / buttons. */
export function pitchTrackerTypeChipClass(t: PitchTrackerPitchType | null): string {
  if (t == null) {
    return "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-faint)] pitch-pad-type-chip-muted";
  }
  switch (t) {
    case "fastball":
      return "bg-[#c80815] text-white border-[#a00611]/90";
    case "sinker":
      return "bg-[#004225] text-white border-[#003318]/90";
    case "cutter":
      return "bg-[#b8860b] text-white border-[#926b09]/90";
    case "slider":
      return "bg-[#1e3a8a] text-white border-[#172554]/90";
    case "sweeper":
      return "bg-cyan-600/90 text-white border-cyan-400/50";
    case "curveball":
      return "bg-[#c2410c] text-white border-[#9a3412]/90";
    case "changeup":
      return "bg-[#5b21b6] text-white border-[#4c1d95]/90";
    case "splitter":
      return "bg-[#0d5c56] text-white border-[#0a4844]/90";
    case "off_speed":
      return "bg-[#5b21b6] text-white border-[#4c1d95]/90";
    case "breaking_ball":
      return "bg-[#1e3a8a] text-white border-[#172554]/90";
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
      return "bg-[#c80815] text-white hover:bg-[#b30713] active:bg-[#9a0610] border-[#a00611]/80 shadow-black/40";
    case "sinker":
      return "bg-[#004225] text-white hover:bg-[#003b20] active:bg-[#003318] border-[#003318]/80 shadow-black/40";
    case "cutter":
      return "bg-[#b8860b] text-white hover:bg-[#a6780a] active:bg-[#926b09] border-[#926b09]/80 shadow-black/40";
    case "slider":
      return "bg-[#1e3a8a] text-white hover:bg-[#234e99] active:bg-[#172e6b] border-[#172554]/80 shadow-black/40";
    case "sweeper":
      return "bg-cyan-600 text-white hover:bg-cyan-500 active:bg-cyan-700 border-cyan-400/60 shadow-cyan-900/40";
    case "curveball":
      return "bg-[#c2410c] text-white hover:bg-[#ad3810] active:bg-[#8b2e0f] border-[#9a3412]/80 shadow-black/40";
    case "changeup":
      return "bg-[#5b21b6] text-white hover:bg-[#5220a0] active:bg-[#3b1778] border-[#4c1d95]/80 shadow-black/40";
    case "splitter":
      return "bg-[#0d5c56] text-white hover:bg-[#0c524e] active:bg-[#093f3c] border-[#0a4844]/80 shadow-black/40";
    case "off_speed":
      return "bg-[#5b21b6] text-white hover:bg-[#5220a0] active:bg-[#3b1778] border-[#4c1d95]/80 shadow-black/40";
    case "breaking_ball":
      return "bg-[#1e3a8a] text-white hover:bg-[#234e99] active:bg-[#172e6b] border-[#172554]/80 shadow-black/40";
    default: {
      const _e: never = t;
      return _e;
    }
  }
}
