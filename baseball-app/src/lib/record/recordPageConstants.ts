import type { BattedBallType, PAResult } from "@/lib/types";
import type { PitchOutcome } from "@/lib/types";

export const RESULT_OPTIONS: { value: PAResult; label: string }[] = [
  { value: "single", label: "1B" },
  { value: "double", label: "2B" },
  { value: "triple", label: "3B" },
  { value: "hr", label: "HR" },
  { value: "out", label: "Out" },
  { value: "foul_out", label: "FO" },
  { value: "so", label: "SO" },
  { value: "gidp", label: "GIDP" },
  { value: "bb", label: "BB" },
  { value: "ibb", label: "IBB" },
  { value: "hbp", label: "HBP" },
  { value: "sac_fly", label: "Sac. Fly" },
  { value: "sac_bunt", label: "Sac. Bunt" },
  { value: "reached_on_error", label: "Reached on error" },
  { value: "fielders_choice", label: "FC" },
];

export const RESULT_GROUPS: { label: string; options: { value: PAResult; label: string }[] }[] = [
  { label: "Hits", options: RESULT_OPTIONS.filter((o) => ["single", "double", "triple", "hr"].includes(o.value)) },
  {
    label: "Outs",
    options: RESULT_OPTIONS.filter((o) => ["out", "foul_out", "so", "gidp"].includes(o.value)),
  },
  {
    label: "Reach",
    options: RESULT_OPTIONS.filter((o) => ["bb", "ibb", "hbp", "reached_on_error"].includes(o.value)),
  },
  {
    label: "Other",
    options: RESULT_OPTIONS.filter((o) => ["sac_fly", "sac_bunt", "fielders_choice"].includes(o.value)),
  },
];

export const RESULT_IS_OUT = new Set<PAResult>(["out", "foul_out", "so", "so_looking", "gidp"]);

export const RESULT_ADDS_ONE_OUT = new Set<PAResult>([
  "out",
  "foul_out",
  "so",
  "so_looking",
  "sac_fly",
  "sac_bunt",
  "sac",
  "fielders_choice",
]);

export const RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT = new Set<PAResult>(["single", "double", "triple"]);

export const PLAY_PRESETS = [
  "4-3",
  "6-3",
  "5-3",
  "3-1",
  "1-3",
  "6-4-3",
  "4-6-3",
  "5-4-3",
  "F7",
  "F8",
  "F9",
  "3U",
  "K",
  "ꓘ",
];

export const PLAY_ABBREVIATIONS: Record<string, string> = {
  dp: "6-4-3",
  "4-6-3": "4-6-3",
  "4-3": "4-3",
  "6-3": "6-3",
  "5-3": "5-3",
  "3-1": "3-1",
  f7: "F7",
  f8: "F8",
  f9: "F9",
  "3u": "3U",
  k: "K",
  kl: "ꓘ",
  "1-3": "1-3",
  ipo: "4-3",
  go: "4-3",
};

export const BATTED_BALL_TYPE_OPTIONS: { value: BattedBallType; label: string; title: string }[] = [
  { value: "ground_ball", label: "GB", title: "Ground ball (GB)" },
  { value: "line_drive", label: "LD", title: "Line drive (LD)" },
  { value: "fly_ball", label: "FB", title: "Fly ball (FB)" },
  { value: "infield_fly", label: "IFF", title: "Infield fly (IFF)" },
];

export const PITCH_LOG_BUTTONS: { outcome: PitchOutcome; label: string; title: string }[] = [
  { outcome: "ball", label: "Ball", title: "Ball (no swing)" },
  { outcome: "called_strike", label: "Called", title: "Called strike" },
  { outcome: "swinging_strike", label: "Whiff", title: "Swinging strike" },
  { outcome: "foul", label: "Foul", title: "Foul ball" },
];

export const PITCH_SEQUENCE_VISIBLE_ROWS = 6;
export const PITCH_SEQUENCE_ROW_CLASS =
  "flex min-h-10 flex-nowrap items-center gap-x-2 gap-y-0 rounded-md px-2 py-1 text-[11px] sm:text-xs";
