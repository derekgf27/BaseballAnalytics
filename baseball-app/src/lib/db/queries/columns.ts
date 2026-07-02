/** Explicit Supabase column lists — avoids `select("*")` over-fetching. */

export const GAME_COLUMNS =
  "id, date, home_team, away_team, our_side, game_time, final_score_home, final_score_away, starting_pitcher_home_id, starting_pitcher_away_id, save_pitcher_id, winning_pitcher_id, losing_pitcher_id, our_sp_plan_notes, pitch_tracker_group_id, pitch_tracker_batter_id, pitch_tracker_batter_slot, pitch_tracker_outs, pitch_tracker_pitcher_id, pitch_tracker_mound_pitcher_id, pitch_tracker_balls, pitch_tracker_strikes, created_at";

export const PLAYER_COLUMNS =
  "id, name, jersey, positions, primary_position, bats, throws, height_in, weight_lb, hometown, birth_date, opponent_team, roster_status, staff_notes, is_active, created_at";

export const PLATE_APPEARANCE_COLUMNS =
  "id, game_id, batter_id, inning, outs, base_state, score_diff, count_balls, count_strikes, result, contact_quality, hit_direction, batted_ball_type, pitches_seen, strikes_thrown, first_pitch_strike, rbi, runs_scored_player_ids, unearned_runs_scored_player_ids, runs_scored_charged_pitcher_by_scorer, stolen_bases, pitcher_hand, pitcher_id, error_fielder_id, error_fielder_ids, inning_half, notes, created_at";

export const BASERUNNING_EVENT_COLUMNS =
  "id, game_id, inning, inning_half, outs, runner_id, event_type, batter_id, from_base, created_at";

export const PITCH_EVENT_COLUMNS =
  "id, pa_id, pitch_index, balls_before, strikes_before, outcome, pitch_type, created_at";

export const PITCH_TRACKER_COLUMNS =
  "id, game_id, at_bat_id, tracker_group_id, pitch_number, pitch_type, result, batter_id, pitcher_id, created_at";

export const DEFENSIVE_EVENT_COLUMNS =
  "id, game_id, inning, outs, base_state, decision_type, outcome, notes, created_at";

export const PLAYER_RATING_COLUMNS =
  "player_id, contact_reliability, damage_potential, decision_quality, defense_trust, overridden_at, overridden_by, updated_at";
