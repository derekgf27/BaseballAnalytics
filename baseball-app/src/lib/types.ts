/**
 * Shared types — event-first model. No aggregate stat types stored.
 */

export type BaseState = string; // "000" | "100" | "010" | "001" | "110" | "101" | "011" | "111"

export type PAResult =
  | "single"
  | "double"
  | "triple"
  | "hr"
  | "out"
  | "bb"
  | "ibb"
  | "hbp"
  | "so"
  | "sac"
  | "sac_fly"
  | "sac_bunt"
  | "other";

export type ContactQuality = "soft" | "medium" | "hard";

/** Direction of batted ball: pulled, up the middle, or opposite field. */
export type HitDirection = "pulled" | "up_the_middle" | "opposite_field";

export interface Game {
  id: string;
  date: string;
  home_team: string;
  away_team: string;
  our_side: "home" | "away";
  final_score_home: number | null;
  final_score_away: number | null;
  created_at?: string;
}

export type Bats = "L" | "R" | "S";
export type Throws = "L" | "R";

export interface Player {
  id: string;
  name: string;
  jersey: string | null;
  positions: string[];
  bats?: Bats | null;
  throws?: Throws | null;
  height_in?: number | null;
  weight_lb?: number | null;
  hometown?: string | null;
  birth_date?: string | null;
  /** @deprecated No longer used; all players are treated as on roster. */
  is_active?: boolean;
  created_at?: string;
}

export interface PlateAppearance {
  id: string;
  game_id: string;
  batter_id: string;
  inning: number;
  outs: number;
  base_state: BaseState;
  score_diff: number;
  count_balls: number;
  count_strikes: number;
  result: PAResult;
  contact_quality: ContactQuality | null;
  chase: boolean | null;
  hit_direction: HitDirection | null;
  pitches_seen: number | null;
  rbi: number;
  /** Player IDs who scored on this PA (batter or baserunners). */
  runs_scored_player_ids?: string[];
  /** Stolen bases by the batter on this PA. */
  stolen_bases?: number;
  /** Pitcher handedness: L or R. */
  pitcher_hand?: "L" | "R" | null;
  /** Inning half: top or bottom. */
  inning_half?: "top" | "bottom" | null;
  notes: string | null;
  created_at?: string;
}

/** Batting stats derived from plate appearances (not stored). */
export interface BattingStats {
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  opsPlus: number;
  woba: number;
  /** Raw counts (included when computed from PAs; used on stats page). */
  pa?: number;
  ab?: number;
  h?: number;
  double?: number;
  triple?: number;
  hr?: number;
  rbi?: number;
  /** Runs scored (from runs_scored_player_ids across all PAs). */
  r?: number;
  /** Stolen bases (sum of stolen_bases on batter's PAs). */
  sb?: number;
  bb?: number;
  ibb?: number;
  hbp?: number;
  so?: number;
  sf?: number;
  sh?: number;
  /** K% = SO/PA (0–1). */
  kPct?: number;
  /** BB% = (BB+IBB)/PA (0–1). */
  bbPct?: number;
}

/** Batting stats plus platoon splits (vs LHP / vs RHP). */
export interface BattingStatsWithSplits {
  overall: BattingStats;
  /** Stats when batter faced a left-handed pitcher. */
  vsL: BattingStats | null;
  /** Stats when batter faced a right-handed pitcher. */
  vsR: BattingStats | null;
}

export interface DefensiveEvent {
  id: string;
  game_id: string;
  inning: number;
  outs: number;
  base_state: BaseState;
  decision_type: string;
  outcome: "success" | "fail" | "neutral" | null;
  notes: string | null;
  created_at?: string;
}

export interface PlayerRating {
  player_id: string;
  contact_reliability: number;
  damage_potential: number;
  decision_quality: number;
  defense_trust: number;
  overridden_at: string | null;
  overridden_by: string | null;
  updated_at?: string;
}

export interface GameLineupSlot {
  game_id: string;
  slot: number;
  player_id: string;
  /** Position for this game (e.g. "LF", "3B"). When set, use instead of player's default position. */
  position?: string | null;
}

export interface SavedLineup {
  id: string;
  name: string;
  created_at?: string;
}

export interface SavedLineupSlotRow {
  lineup_id: string;
  slot: number;
  player_id: string;
  position: string | null;
}

export interface SavedLineupWithSlots extends SavedLineup {
  slots: { slot: number; player_id: string; position: string | null }[];
}

/** 1–5 scale used in computation and UI */
export type RatingKey =
  | "contact_reliability"
  | "damage_potential"
  | "decision_quality"
  | "defense_trust";

export interface Ratings {
  contact_reliability: number;
  damage_potential: number;
  decision_quality: number;
  defense_trust: number;
}

/** Role label for coach lineup view */
export type LineupRole =
  | "Table-setter"
  | "Damage"
  | "Protection"
  | "Bottom"
  | "Other";

/** Green-light recommendation */
export type GreenLightVerdict = "yes" | "no" | "situational";

/** Situation prompt output */
export type SituationTone = "aggressive" | "neutral" | "conservative";

export interface SituationResult {
  tone: SituationTone;
  sentence: string;
}

export interface GreenLightRow {
  player_id: string;
  player_name: string;
  swing_3_0: GreenLightVerdict;
  hit_and_run: GreenLightVerdict;
  steal: GreenLightVerdict;
  bunt: GreenLightVerdict;
}
