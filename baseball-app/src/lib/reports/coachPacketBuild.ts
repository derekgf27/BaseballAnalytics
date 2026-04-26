import { normBaseState } from "@/lib/compute/battingStats";
import type { BattingStatsWithSplits, Game, GameLineupSlot, PlateAppearance, Player } from "@/lib/types";
import type { CoachPacketLineupRow, CoachPacketModel, CoachPacketPaRow } from "./coachPacketTypes";

function halfOrder(h: string | null | undefined): number {
  if (h === "top") return 0;
  if (h === "bottom") return 1;
  return 2;
}

function sortPasChronological(pas: PlateAppearance[]): PlateAppearance[] {
  return [...pas].sort((a, b) => {
    if (a.inning !== b.inning) return a.inning - b.inning;
    const ho = halfOrder(a.inning_half) - halfOrder(b.inning_half);
    if (ho !== 0) return ho;
    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  });
}

function lineupRow(
  slot: GameLineupSlot,
  playersById: Map<string, Player>,
  battingStatsByPlayerId: Record<string, BattingStatsWithSplits | undefined>
): CoachPacketLineupRow {
  const p = playersById.get(slot.player_id);
  const o = battingStatsByPlayerId[slot.player_id]?.overall;
  return {
    slot: slot.slot,
    name: p?.name ?? slot.player_id.slice(0, 8),
    position: (slot.position?.trim() || p?.positions?.[0] || "").trim(),
    jersey: p?.jersey != null && String(p.jersey).trim() !== "" ? String(p.jersey).trim() : "",
    bats: p?.bats ?? "",
    avg: o && Number.isFinite(o.avg) ? o.avg : null,
    ops: o && Number.isFinite(o.ops) ? o.ops : null,
  };
}

function pitcherThrowsForPa(pa: PlateAppearance, pitcher: Player | undefined): string {
  if (pa.pitcher_hand === "L" || pa.pitcher_hand === "R") return pa.pitcher_hand;
  const t = pitcher?.throws;
  if (t === "L" || t === "R") return t;
  return "";
}

export function buildCoachPacketModel(
  game: Game,
  lineup: GameLineupSlot[],
  playersById: Map<string, Player>,
  pas: PlateAppearance[],
  battingStatsByPlayerId: Record<string, BattingStatsWithSplits | undefined>
): CoachPacketModel {
  const ourSide = game.our_side;
  const oppSide: "home" | "away" = ourSide === "home" ? "away" : "home";
  const ourTeamName = ourSide === "home" ? game.home_team : game.away_team;
  const opponentTeamName = oppSide === "home" ? game.home_team : game.away_team;

  const ourSlots = lineup.filter((s) => s.side === ourSide).sort((a, b) => a.slot - b.slot);
  const oppSlots = lineup.filter((s) => s.side === oppSide).sort((a, b) => a.slot - b.slot);

  const sortedPas = sortPasChronological(pas);
  const paRows: CoachPacketPaRow[] = sortedPas.map((pa) => {
    const batter = playersById.get(pa.batter_id);
    const pitcher = pa.pitcher_id ? playersById.get(pa.pitcher_id) : undefined;
    const pitches =
      pa.pitches_seen != null && !Number.isNaN(Number(pa.pitches_seen))
        ? String(pa.pitches_seen)
        : "";
    return {
      inning: pa.inning,
      inning_half: pa.inning_half === "bottom" ? "bot" : "top",
      outs: pa.outs,
      base_state: normBaseState(pa.base_state),
      count_balls: pa.count_balls,
      count_strikes: pa.count_strikes,
      batter: batter?.name ?? pa.batter_id.slice(0, 8),
      batter_bats: batter?.bats ?? "",
      pitcher: pitcher?.name ?? (pa.pitcher_id ? pa.pitcher_id.slice(0, 8) : ""),
      pitcher_throws: pitcherThrowsForPa(pa, pitcher),
      result: pa.result,
      rbi: pa.rbi,
      pitches_seen: pitches,
    };
  });

  return {
    game: {
      id: game.id,
      date: game.date,
      home_team: game.home_team,
      away_team: game.away_team,
      our_side: game.our_side,
      final_score_home: game.final_score_home,
      final_score_away: game.final_score_away,
    },
    our_team_name: ourTeamName,
    opponent_team_name: opponentTeamName,
    our_lineup: ourSlots.map((s) => lineupRow(s, playersById, battingStatsByPlayerId)),
    opponent_lineup: oppSlots.map((s) => lineupRow(s, playersById, battingStatsByPlayerId)),
    plate_appearances: paRows,
  };
}
