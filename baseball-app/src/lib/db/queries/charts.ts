import { isSprayChartBipResult } from "@/lib/sprayChartFilters";
import { isClubRosterPlayer, isPitcherPlayer } from "@/lib/opponentUtils";
import { isDemoId } from "../mockData";
import type { PlateAppearance } from "@/lib/types";
import { getSupabase } from "./client";
import { getPlayers } from "./players";

export async function getSprayChartRowsForGames(gameIds: string[]): Promise<
  {
    game_id: string;
    batter_id: string;
    pitcher_id: string | null;
    hit_direction: string;
    result: string;
    pitcher_hand: "L" | "R" | null;
    inning_half: string | null;
  }[]
> {
  const supabase = await getSupabase();
  if (!supabase || gameIds.length === 0) return [];
  const clean = gameIds.filter((id) => !isDemoId(id));
  if (clean.length === 0) return [];
  const { data } = await supabase
    .from("plate_appearances")
    .select("game_id, batter_id, pitcher_id, hit_direction, result, pitcher_hand, inning_half")
    .in("game_id", clean);
  const rows = (data ?? []) as {
    game_id: string;
    batter_id: string;
    pitcher_id: string | null;
    hit_direction: string | null;
    result: string;
    pitcher_hand: string | null;
    inning_half: string | null;
  }[];
  return rows
    .filter(
      (r) =>
        !isDemoId(r.game_id) &&
        r.hit_direction != null &&
        r.hit_direction !== "" &&
        r.batter_id &&
        !isDemoId(r.batter_id)
    )
    .map((r) => ({
      game_id: r.game_id,
      batter_id: r.batter_id,
      pitcher_id: r.pitcher_id && !isDemoId(r.pitcher_id) ? r.pitcher_id : null,
      hit_direction: r.hit_direction!,
      result: r.result,
      pitcher_hand: r.pitcher_hand === "L" || r.pitcher_hand === "R" ? r.pitcher_hand : null,
      inning_half: r.inning_half,
    }));
}

/** Base-hit PAs with hit_direction when a club pitcher is on the mound — team pitching spray (vs LHB / vs RHB). */

export async function getTeamPlateAppearancesForPitchingSpray(): Promise<
  { game_id: string; batter_id: string; hit_direction: string; result: string; pitcher_hand: "L" | "R" | null; inning: number | null; base_state: string | null }[]
> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const roster = await getPlayers();
  const clubPitcherIds = new Set(
    roster.filter((p) => !isDemoId(p.id) && isClubRosterPlayer(p) && isPitcherPlayer(p)).map((p) => p.id)
  );
  if (clubPitcherIds.size === 0) return [];
  const { data } = await supabase
    .from("plate_appearances")
    .select("game_id, batter_id, pitcher_id, hit_direction, result, pitcher_hand, inning, base_state");
  const rows = (data ?? []) as {
    game_id: string;
    batter_id: string;
    pitcher_id: string | null;
    hit_direction: string | null;
    result: string;
    pitcher_hand: string | null;
    inning: number | null;
    base_state: string | null;
  }[];
  return rows
    .filter(
      (r) =>
        !isDemoId(r.game_id) &&
        r.pitcher_id &&
        clubPitcherIds.has(r.pitcher_id) &&
        isSprayChartBipResult(r.result) &&
        r.hit_direction != null &&
        r.hit_direction !== "" &&
        r.batter_id &&
        !isDemoId(r.batter_id)
    )
    .map((r) => ({
      game_id: r.game_id,
      batter_id: r.batter_id,
      hit_direction: r.hit_direction!,
      result: r.result,
      pitcher_hand: r.pitcher_hand === "L" || r.pitcher_hand === "R" ? r.pitcher_hand : null,
      inning: typeof r.inning === "number" ? r.inning : null,
      base_state: r.base_state ?? null,
    }));
}

/** PAs with hit_direction for team spray chart (hits and BIP outs). Excludes demo games.
 *  Includes batter_id and pitcher_hand for RHB/LHB split (switch hitters inferred: vs LHP → R, vs RHP → L).
 */

export async function getTeamPlateAppearancesForSpray(): Promise<
  { game_id: string; batter_id: string; hit_direction: string; result: string; pitcher_hand: "L" | "R" | null; inning: number | null; base_state: string | null }[]
> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("plate_appearances")
    .select("game_id, batter_id, hit_direction, result, pitcher_hand, inning, base_state");
  const rows = (data ?? []) as {
    game_id: string;
    batter_id: string;
    hit_direction: string | null;
    result: string;
    pitcher_hand: string | null;
    inning: number | null;
    base_state: string | null;
  }[];
  return rows.filter(
    (r) =>
      !isDemoId(r.game_id) &&
      isSprayChartBipResult(r.result) &&
      r.hit_direction != null &&
      r.hit_direction !== "" &&
      r.batter_id &&
      !isDemoId(r.batter_id)
  ).map((r) => ({
    ...r,
    hit_direction: r.hit_direction!,
    pitcher_hand: r.pitcher_hand === "L" || r.pitcher_hand === "R" ? r.pitcher_hand : null,
    inning: typeof r.inning === "number" ? r.inning : null,
    base_state: r.base_state ?? null,
  })) as { game_id: string; batter_id: string; hit_direction: string; result: string; pitcher_hand: "L" | "R" | null; inning: number | null; base_state: string | null }[];
}

/** Team batting PAs for objective charts (discipline/contact/situational/player compare). */

export async function getTeamPlateAppearancesForCharts(): Promise<
  {
    game_id: string;
    batter_id: string;
    result: PlateAppearance["result"];
    inning: number | null;
    base_state: string | null;
    pitcher_hand: "L" | "R" | null;
    batted_ball_type: PlateAppearance["batted_ball_type"] | null;
    pitches_seen: number | null;
    strikes_thrown: number | null;
    first_pitch_strike: boolean | null;
  }[]
> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const roster = await getPlayers();
  const clubBatterIds = new Set(
    roster.filter((p) => !isDemoId(p.id) && isClubRosterPlayer(p) && !isPitcherPlayer(p)).map((p) => p.id)
  );
  if (clubBatterIds.size === 0) return [];
  const { data } = await supabase
    .from("plate_appearances")
    .select(
      "game_id, batter_id, result, inning, base_state, pitcher_hand, batted_ball_type, pitches_seen, strikes_thrown, first_pitch_strike"
    );
  const rows = (data ?? []) as {
    game_id: string;
    batter_id: string;
    result: PlateAppearance["result"];
    inning: number | null;
    base_state: string | null;
    pitcher_hand: string | null;
    batted_ball_type: PlateAppearance["batted_ball_type"] | null;
    pitches_seen: number | null;
    strikes_thrown: number | null;
    first_pitch_strike: boolean | null;
  }[];
  return rows
    .filter((r) => !isDemoId(r.game_id) && clubBatterIds.has(r.batter_id))
    .map((r) => ({
      ...r,
      batted_ball_type: r.batted_ball_type ?? null,
      pitcher_hand: r.pitcher_hand === "L" || r.pitcher_hand === "R" ? r.pitcher_hand : null,
    }));
}

/** Parallel bundle for analyst charts page (spray + pitching spray + snapshot PAs). */

export async function getChartsPagePlateData() {
  const [sprayData, pitchingSprayData, chartPas] = await Promise.all([
    getTeamPlateAppearancesForSpray(),
    getTeamPlateAppearancesForPitchingSpray(),
    getTeamPlateAppearancesForCharts(),
  ]);
  return { sprayData, pitchingSprayData, chartPas };
}

