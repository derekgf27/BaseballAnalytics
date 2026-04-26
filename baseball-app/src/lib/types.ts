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

/** Trajectory / type for balls in play (GB / LD / FB / IFF). */
export type BattedBallType = "ground_ball" | "line_drive" | "fly_ball" | "infield_fly";

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
  /** Staff notes for our starter (pre-game report, e.g. pitch plan, workload). */
  our_sp_plan_notes?: string | null;
  /** Shared coach iPad ↔ analyst pitch-tracker session (`pitches.tracker_group_id`). */
  pitch_tracker_group_id?: string | null;
  /** Current PA batter on Record — coach pad follows this. */
  pitch_tracker_batter_id?: string | null;
  /** Batting-order slot (1–9) for that batter; synced from Record lineup. */
  pitch_tracker_batter_slot?: number | null;
  /** Outs (0–2) on Record — coach pad follows this. */
  pitch_tracker_outs?: number | null;
  /** Defensive pitcher on Record — coach pad follows this. */
  pitch_tracker_pitcher_id?: string | null;
  /** PA count balls (0–3) on Record — coach pad follows this. */
  pitch_tracker_balls?: number | null;
  /** PA count strikes (0–3) on Record — coach pad follows this. */
  pitch_tracker_strikes?: number | null;
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

/** Counts used before deleting a player (lineups can be cleared; batter PAs block delete). */
export interface PlayerDeletionPreview {
  batterPlateAppearances: number;
  gameLineups: number;
  savedLineupSlots: number;
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
  hit_direction: HitDirection | null;
  /** Ground ball, line drive, fly ball, or infield fly (balls in play). */
  batted_ball_type?: BattedBallType | null;
  pitches_seen: number | null;
  /** Pitches that count as strikes (incl. fouls); paired with `pitches_seen` for strike%. */
  strikes_thrown: number | null;
  /** First pitch of the PA was a strike (incl. foul); for FPS%. */
  first_pitch_strike: boolean | null;
  rbi: number;
  /** Player IDs who scored on this PA (batter or baserunners). */
  runs_scored_player_ids?: string[];
  /**
   * Subset of `runs_scored_player_ids` whose runs count as unearned against the pitcher (ERA).
   * Omitted or empty means all runs on the play are earned unless you add ids here.
   */
  unearned_runs_scored_player_ids?: string[];
  /**
   * Maps scorer player id → pitcher id credited for that run’s R/ER. Omitted keys use this PA’s
   * `pitcher_id` (default). Used for inherited runners: charge the prior pitcher when a reliever
   * enters with runners on and a run still scores on the new pitcher’s watch.
   */
  runs_scored_charged_pitcher_by_scorer?: Record<string, string> | null;
  /** Stolen bases by the batter on this PA. */
  stolen_bases?: number;
  /** Pitcher handedness: L or R. */
  pitcher_hand?: "L" | "R" | null;
  /** Pitcher credited for this PA (for pitching stats). */
  pitcher_id?: string | null;
  /**
   * Fielder charged with the error: required context for `reached_on_error`, or optional on
   * 1B–3B when the batter still gets the hit but an error allows an extra base (e.g. E8 on throw).
   */
  error_fielder_id?: string | null;
  /** Inning half: top or bottom. */
  inning_half?: "top" | "bottom" | null;
  notes: string | null;
  created_at?: string;
}

/** Result of one pitch (before PA result is finalized). */
export type PitchOutcome =
  | "ball"
  | "called_strike"
  | "swinging_strike"
  | "foul"
  | "in_play"
  | "hbp";

/** One row per pitch in a plate appearance (optional detailed log). */
export interface PitchEvent {
  id: string;
  pa_id: string;
  pitch_index: number;
  balls_before: number;
  strikes_before: number;
  outcome: PitchOutcome;
  pitch_type: string | null;
  created_at?: string;
}

export type PitchEventInsert = Omit<PitchEvent, "id" | "created_at">;

/** Rows to attach after inserting a PA (`pa_id` filled server-side). */
export type PitchEventDraft = Omit<PitchEventInsert, "pa_id">;

/** Coach pitch-tracker pitch categories (stored lowercase). */
export type PitchTrackerPitchType =
  | "fastball"
  | "sinker"
  | "cutter"
  | "slider"
  | "sweeper"
  | "curveball"
  | "changeup"
  | "splitter";

/** Analyst-assigned pitch result on `pitches` rows (nullable until set). */
export type PitchTrackerLogResult =
  | "ball"
  | "called_strike"
  | "swinging_strike"
  | "foul"
  | "in_play";

/** One row from `public.pitches` (real-time tracker). */
export interface PitchTrackerPitch {
  id: string;
  game_id: string;
  at_bat_id: string | null;
  tracker_group_id: string;
  pitch_number: number;
  /** Null until coach logs a type; outcome can still be set from Record pitch log. */
  pitch_type: PitchTrackerPitchType | null;
  result: PitchTrackerLogResult | null;
  batter_id: string;
  pitcher_id: string | null;
  created_at?: string;
}

export type PitchTrackerPitchInsert = Omit<PitchTrackerPitch, "id" | "created_at">;

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
  /** Pitch log rows for all `pas` (for Sw% / Whiff% / Foul% in matchup recompute). */
  pitchEvents: PitchEvent[];
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
  /** Pitch log rows for all `pas` (contact profile on pitching sheet / matchup). */
  pitchEvents: PitchEvent[];
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
  /** Defensive errors charged (`error_fielder_id` on PAs in this sample). */
  e?: number;
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
  /** Swings ÷ pitches with a pitch log (0–1). */
  swingPct?: number;
  /** Swinging strikes ÷ swings when swings > 0 (0–1). */
  whiffPct?: number;
  /** Fouls ÷ pitches with a pitch log (0–1). */
  foulPct?: number;
  /** Share of tagged BIP by `batted_ball_type` (0–1 each); denominator = PAs with non-null type. */
  gbPct?: number;
  ldPct?: number;
  fbPct?: number;
  iffPct?: number;
}

/** Keys like "0-0" … "3-2" for final ball–strike count on a PA (see `statsByFinalCount`). */
export type BattingFinalCountBucketKey =
  | "0-0"
  | "0-1"
  | "0-2"
  | "1-0"
  | "1-1"
  | "1-2"
  | "2-0"
  | "2-1"
  | "2-2"
  | "3-0"
  | "3-1"
  | "3-2";

/** Stat sheet “Runners” filter: offensive base state at the start of the PA. */
export type StatsRunnersFilterKey = "all" | "basesEmpty" | "runnersOn" | "risp" | "basesLoaded";

/** Runner situation × platoon (combined / vs LHP / vs RHP) for one base-out bucket. */
export interface BattingRunnerSituationSplit {
  combined: BattingStats | null;
  vsL: BattingStats | null;
  vsR: BattingStats | null;
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
  /**
   * PAs filtered by starting base state; each bucket has combined + platoon lines.
   * Omitted in older payloads — stat sheet treats as “all runners” only.
   */
  runnerSituations?: {
    basesEmpty: BattingRunnerSituationSplit;
    runnersOn: BattingRunnerSituationSplit;
    risp: BattingRunnerSituationSplit;
    basesLoaded: BattingRunnerSituationSplit;
  };
  /**
   * Per final count (balls–strikes stored on each PA when the play ended).
   * Used by the Analyst batting sheet “Final count” column set.
   */
  statsByFinalCount?: {
    overall: Partial<Record<BattingFinalCountBucketKey, BattingStats | null>>;
    vsL: Partial<Record<BattingFinalCountBucketKey, BattingStats | null>>;
    vsR: Partial<Record<BattingFinalCountBucketKey, BattingStats | null>>;
    risp: Partial<Record<BattingFinalCountBucketKey, BattingStats | null>>;
  };
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
  /** Swings ÷ pitches logged on these PAs (0–1). */
  swingPct?: number;
  /** Swinging strikes ÷ swings (0–1). */
  whiffPct?: number;
  /** Fouls ÷ pitches logged (0–1). */
  foulPct?: number;
  /** Batted-ball mix allowed (0–1 each); denominator = BIP with `batted_ball_type`. */
  gbPct?: number;
  ldPct?: number;
  fbPct?: number;
  iffPct?: number;
  /** Pitches in the log with a non-null `pitch_type` (pitcher: thrown). */
  plTyped?: number;
  /** Mix / swing / whiff by coach pitch category (denominators: typed total; pitches of type; swings at type). */
  plMixFB?: number;
  plMixSI?: number;
  plMixFC?: number;
  plMixSL?: number;
  plMixSW?: number;
  plMixCB?: number;
  plMixCH?: number;
  plMixSP?: number;
  plMixOT?: number;
  plSwFB?: number;
  plSwSI?: number;
  plSwFC?: number;
  plSwSL?: number;
  plSwSW?: number;
  plSwCB?: number;
  plSwCH?: number;
  plSwSP?: number;
  plSwOT?: number;
  plWhiffFB?: number;
  plWhiffSI?: number;
  plWhiffFC?: number;
  plWhiffSL?: number;
  plWhiffSW?: number;
  plWhiffCB?: number;
  plWhiffCH?: number;
  plWhiffSP?: number;
  plWhiffOT?: number;
  /**
   * Opponent AB / hits attributed by **final logged pitch** type (PA must count as AB).
   * Used for per–pitch-type BAA; PAs with no pitch log or untyped final pitch are excluded.
   */
  plTxAbFB?: number;
  plTxHFB?: number;
  plTxAbSI?: number;
  plTxHSI?: number;
  plTxAbFC?: number;
  plTxHFC?: number;
  plTxAbSL?: number;
  plTxHSL?: number;
  plTxAbSW?: number;
  plTxHSW?: number;
  plTxAbCB?: number;
  plTxHCB?: number;
  plTxAbCH?: number;
  plTxHCH?: number;
  plTxAbSP?: number;
  plTxHSP?: number;
  plTxAbOT?: number;
  plTxHOT?: number;
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
  /**
   * Opponent at-bats credited on this pitcher's PAs: PA − BB − IBB − HBP − SF − SH
   * (same rules as batting `ab`).
   */
  abAgainst: number;
  /** Runs allowed on PAs while this pitcher was credited. */
  r: number;
  /**
   * Inherited runners: runners on base when this pitcher entered the game (new mound appearance),
   * summed over games. Omitted on splits where relief-entry context is not shown.
   */
  ir?: number;
  /**
   * Inherited runners scored: runs that crossed on PAs with this pitcher on the mound but were
   * charged to another pitcher (`runs_scored_charged_pitcher_by_scorer`, e.g. prior arm).
   */
  irs?: number;
  /**
   * Earned runs: runs scored on this pitcher's PAs minus per-scorer unearned flags
   * (`unearned_runs_scored_player_ids` on each PA).
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
  /** Fielding errors charged to this player in this sample (same basis as batting `e`). */
  e?: number;
  /** Per regulation inning and percentage rates for this sample (overall or platoon split). */
  rates: PitchingRateLine;
}

/** Runner situation × platoon for pitching (combined / vs LHB / vs RHB). */
export interface PitchingRunnerSituationSplit {
  combined: PitchingStats | null;
  vsLHB: PitchingStats | null;
  vsRHB: PitchingStats | null;
}

/** Pitching lines by batter handedness (vs LHB / vs RHB); same shape as batting `BattingStatsWithSplits`. */
export interface PitchingStatsWithSplits {
  overall: PitchingStats;
  /** PAs vs batters with `bats === 'L'` only (switch hitters excluded). */
  vsLHB: PitchingStats | null;
  /** PAs vs batters with `bats === 'R'` only (switch hitters excluded). */
  vsRHB: PitchingStats | null;
  /** PAs filtered by offensive base state when the PA began. */
  runnerSituations?: {
    basesEmpty: PitchingRunnerSituationSplit;
    runnersOn: PitchingRunnerSituationSplit;
    risp: PitchingRunnerSituationSplit;
    basesLoaded: PitchingRunnerSituationSplit;
  };
  /**
   * Per final count (balls–strikes stored on each PA when the play ended).
   * Analyst pitching sheet “Final count” filter (mirrors batting).
   */
  statsByFinalCount?: {
    overall: Partial<Record<BattingFinalCountBucketKey, PitchingStats | null>>;
    vsLHB: Partial<Record<BattingFinalCountBucketKey, PitchingStats | null>>;
    vsRHB: Partial<Record<BattingFinalCountBucketKey, PitchingStats | null>>;
  };
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
