import type { SprayResultFilterKey } from "@/lib/sprayChartFilters";

export type DateRangeKey = "season" | "last30" | "last7";
export type InningBucketKey = "all" | "1-3" | "4-6" | "7+";
export type PitchHandFilter = "all" | "L" | "R";
export type LeaderSortKey = "pa" | "ops" | "avg";

export type ChartUrlFilters = {
  spray: SprayResultFilterKey;
  range: DateRangeKey;
  inning: InningBucketKey;
  opp: string;
  rispOnly: boolean;
  phand: PitchHandFilter;
};

export type ChartsFilterChip = { label: string; value: string };

export type SprayChartRow = {
  game_id: string;
  batter_id: string;
  hit_direction: string;
  result: string;
  pitcher_hand: "L" | "R" | null;
  inning: number | null;
  base_state: string | null;
};

export type ChartPaRow = {
  game_id: string;
  batter_id: string;
  result: string;
  inning: number | null;
  base_state: string | null;
  pitcher_hand: "L" | "R" | null;
  batted_ball_type: "ground_ball" | "line_drive" | "fly_ball" | "infield_fly" | null | undefined;
  pitches_seen: number | null;
  strikes_thrown: number | null;
  first_pitch_strike: boolean | null;
};

export const CHARTS_SAMPLE_WARNING_BIP = 25;
export const CHARTS_SAMPLE_WARNING_PA = 30;
