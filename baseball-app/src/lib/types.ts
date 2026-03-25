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
  | "so_looking"
  | "sac"
  | "sac_fly"
  | "sac_bunt"
  | "gidp"
  | "fielders_choice"
  | "other"
  /** Batter reaches safely on a defensive error (charged to fielding team). */
  | "reached_on_error";

export type ContactQuality = "soft" | "medium" | "hard";

/** Direction of batted ball: pulled, up the middle, or opposite field. */
export type HitDirection = "pulled" | "up_the_middle" | "opposite_field";

export interface Game {
  id: string;
  date: string;
  home_team: string;
  away_team: string;
  our_side: "home" | "away";
  /** Game time (e.g. "19:05:00" from DB); optional. */
  game_time?: string | null;
  final_score_home: number | null;
  final_score_away: number | null;
  /** Player id — starting pitcher for the home team in this game. */
  starting_pitcher_home_id?: string | null;
  /** Player id — starting pitcher for the away team in this game. */
  starting_pitcher_away_id?: string | null;
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
  /** When set, player is tracked for this opponent organization (not our club). */
  opponent_team?: string | null;
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
  /** Pitches that count as strikes (incl. fouls); paired with `pitches_seen` for strike%. */
  strikes_thrown: number | null;
  /** First pitch of the PA was a strike (incl. foul); for FPS%. */
  first_pitch_strike: boolean | null;
  rbi: number;
  /** Player IDs who scored on this PA (batter or baserunners). */
  runs_scored_player_ids?: string[];
  /** Stolen bases by the batter on this PA. */
  stolen_bases?: number;
  /** Pitcher handedness: L or R. */
  pitcher_hand?: "L" | "R" | null;
  /** Pitcher credited for this PA (for pitching stats). */
  pitcher_id?: string | null;
  /** Inning half: top or bottom. */
  inning_half?: "top" | "bottom" | null;
  notes: string | null;
  created_at?: string;
}

/**
 * PAs, games, and aux data for Analyst → Stats matchup filters (opponent + pitcher) on the club batting sheet.
 * Built server-side; stats recomputed in the client via `computeBattingStatsWithSplitsFromPas`.
 */
export interface ClubBattingMatchupPayload {
  pas: PlateAppearance[];
  games: Game[];
  baserunningByPlayerId: Record<string, { sb: number; cs: number }>;
  /** Lineup-derived started game ids per batter (for GS in splits). */
  startedGameIdsByPlayer: Record<string, string[]>;
}

/** PAs as pitcher, games, starters, and batter `bats` for Analyst → Stats pitching matchup filters. */
export interface ClubPitchingMatchupPayload {
  /** PAs where `pitcher_id` is a club pitcher. */
  pas: PlateAppearance[];
  games: Game[];
  /** Games where each pitcher is listed as starting pitcher (home or away). */
  starterGameIdsByPlayer: Record<string, string[]>;
  /** `bats` for every batter appearing on those PAs (for vs LHB / vs RHB splits). */
  batterBatsById: Record<string, string | null>;
}

/** Stolen base or caught stealing (runner-centric; saved without a plate appearance). */
export type BaserunningEventType = "sb" | "cs";

export interface BaserunningEvent {
  id: string;
  game_id: string;
  inning: number;
  inning_half: "top" | "bottom" | null;
  outs: number | null;
  runner_id: string;
  event_type: BaserunningEventType;
  /** Batter at the plate when the event occurred (optional). */
  batter_id: string | null;
  created_at?: string;
}

export type BaserunningEventInsert = Omit<BaserunningEvent, "id" | "created_at">;

/** Batting stats derived from plate appearances (not stored). */
export interface BattingStats {
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  opsPlus: number;
  woba: number;
  /** Raw counts (included when computed from PAs; used on stats page). */
  /** Distinct games with ≥1 PA (or split-specific: ≥1 PA in that split). */
  gp?: number;
  /** Distinct games in starting lineup (`game_lineups`); overall = all such games; splits = games started that also have ≥1 PA in split. */
  gs?: number;
  pa?: number;
  ab?: number;
  h?: number;
  double?: number;
  triple?: number;
  hr?: number;
  rbi?: number;
  /** Runs scored (from runs_scored_player_ids across all PAs). */
  r?: number;
  /** Stolen bases: legacy PA field + baserunning_events (SB). */
  sb?: number;
  /** Caught stealing (from baserunning_events only). */
  cs?: number;
  /** SB% = SB / (SB + CS) when there is at least one steal attempt (0–1). */
  sbPct?: number;
  bb?: number;
  ibb?: number;
  hbp?: number;
  so?: number;
  /** Ground into double play (from PA result `gidp`). */
  gidp?: number;
  /** Fielder's choice (from PA result `fielders_choice`). */
  fieldersChoice?: number;
  sf?: number;
  sh?: number;
  /** K% = SO/PA (0–1). */
  kPct?: number;
  /** BB% = (BB+IBB)/PA (0–1). */
  bbPct?: number;
  /** Sum of pitches_seen across PAs (when recorded). */
  pitchesSeenTotal?: number;
  /** Pitches per PA = total pitches seen ÷ PA (only when at least one PA has pitch count). */
  pPa?: number;
}

/** Batting stats plus platoon splits (vs LHP / vs RHP) and RISP (runners on 2nd/3rd). */
export interface BattingStatsWithSplits {
  overall: BattingStats;
  /** Stats when batter faced a left-handed pitcher. */
  vsL: BattingStats | null;
  /** Stats when batter faced a right-handed pitcher. */
  vsR: BattingStats | null;
  /** Stats on plate appearances with runners on 2nd and/or 3rd (RISP). */
  risp: BattingStats | null;
}

/** Rate stats for a pitching sample (overall or vs LHB / vs RHB). */
export interface PitchingRateLine {
  pa: number;
  ip: number;
  /** SO, BB, H allowed, HR per regulation inning (see `leagueConfig`). */
  k7: number;
  bb7: number;
  h7: number;
  hr7: number;
  /** SO / PA (0–1). */
  kPct: number;
  /** (BB + IBB) / PA (0–1). */
  bbPct: number;
  /** Pitches per PA when pitch counts exist; otherwise null. */
  pPa: number | null;
  /** Strikes ÷ pitches when both are recorded on PAs; otherwise null. */
  strikePct: number | null;
  /** First-pitch strikes ÷ PAs with FPS recorded; otherwise null. */
  fpsPct: number | null;
}

/** Pitching stats derived from PAs where this player is `pitcher_id` (not stored). */
export interface PitchingStats {
  /** Games appeared (distinct games with ≥1 PA as pitcher, or started). */
  g: number;
  /** Games started (`games.starting_pitcher_home_id` / `starting_pitcher_away_id`). */
  gs: number;
  /** Innings pitched as a decimal (outs ÷ 3) for rate stats. */
  ip: number;
  /** Baseball-style display, e.g. 6.1 = 6⅓ IP. */
  ipDisplay: string;
  h: number;
  /** Runs allowed on PAs while this pitcher was credited. */
  r: number;
  /**
   * Earned runs — without official error tracking, matches runs allowed (R).
   * Refine when errors are modeled per PA.
   */
  er: number;
  era: number;
  hr: number;
  so: number;
  /** Walks: BB + IBB. */
  bb: number;
  hbp: number;
  /** FIP with constant ~3.10, scaled to regulation-inning ERA. */
  fip: number;
  whip: number;
  /** Per regulation inning and percentage rates for this sample (overall or platoon split). */
  rates: PitchingRateLine;
}

/** Pitching lines by batter handedness (vs LHB / vs RHB); same shape as batting `BattingStatsWithSplits`. */
export interface PitchingStatsWithSplits {
  overall: PitchingStats;
  /** PAs vs batters with `bats === 'L'` only (switch hitters excluded). */
  vsLHB: PitchingStats | null;
  /** PAs vs batters with `bats === 'R'` only (switch hitters excluded). */
  vsRHB: PitchingStats | null;
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

export type LineupSide = "home" | "away";

export interface GameLineupSlot {
  game_id: string;
  /** Home or away lineup for this game. */
  side: LineupSide;
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
