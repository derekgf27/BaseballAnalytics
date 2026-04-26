/** Serializable coach packet for CSV / PDF export (built server-side, consumed on client). */

export interface CoachPacketLineupRow {
  slot: number;
  name: string;
  position: string;
  jersey: string;
  bats: string;
  /** Season batting average for this hitter (from logged PAs), null when unavailable. */
  avg: number | null;
  /** Season OPS for this hitter (from logged PAs), null when unavailable. */
  ops: number | null;
}

export interface CoachPacketPaRow {
  inning: number;
  inning_half: string;
  outs: number;
  base_state: string;
  count_balls: number;
  count_strikes: number;
  batter: string;
  batter_bats: string;
  pitcher: string;
  pitcher_throws: string;
  result: string;
  rbi: number;
  pitches_seen: string;
}

export interface CoachPacketModel {
  game: {
    id: string;
    date: string;
    home_team: string;
    away_team: string;
    our_side: "home" | "away";
    final_score_home: number | null;
    final_score_away: number | null;
  };
  our_team_name: string;
  opponent_team_name: string;
  our_lineup: CoachPacketLineupRow[];
  opponent_lineup: CoachPacketLineupRow[];
  plate_appearances: CoachPacketPaRow[];
}
