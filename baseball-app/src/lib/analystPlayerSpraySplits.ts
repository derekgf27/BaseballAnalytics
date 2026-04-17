import { battingStatsFromPAs } from "@/lib/compute/battingStats";
import { isPitcherPlayer } from "@/lib/opponentUtils";
import { isSprayChartBipResult, isValidSprayHitDirection } from "@/lib/sprayChartFilters";
import { isDemoId } from "@/lib/db/mockData";
import type { HitDirection, PlateAppearance, Player } from "@/lib/types";

export type AnalystPlayerSpraySplits =
  | {
      mode: "batting";
      vsL: {
        hand: "L" | "R";
        data: { hit_direction: HitDirection; result: string }[];
        line: { pa: number; h: number; ab: number };
      } | null;
      vsR: {
        hand: "L" | "R";
        data: { hit_direction: HitDirection; result: string }[];
        line: { pa: number; h: number; ab: number };
      } | null;
    }
  | {
      mode: "pitching";
      vsL: {
        hand: "L";
        data: { hit_direction: HitDirection; result: string }[];
        line: { pa: number; h: number; ab: number };
      };
      vsR: {
        hand: "R";
        data: { hit_direction: HitDirection; result: string }[];
        line: { pa: number; h: number; ab: number };
      };
    };

function bipSprayRow(pa: PlateAppearance): { hit_direction: HitDirection; result: string } | null {
  if (!pa.hit_direction || !isValidSprayHitDirection(pa.hit_direction)) return null;
  if (!isSprayChartBipResult(pa.result)) return null;
  return { hit_direction: pa.hit_direction, result: pa.result };
}

function effectiveBatterHand(bats: string | null | undefined, pitcherHand: "L" | "R"): "L" | "R" | null {
  if (!bats) return null;
  const code = bats.toUpperCase();
  if (code.startsWith("L")) return "L";
  if (code.startsWith("R")) return "R";
  if (code.startsWith("S")) {
    return pitcherHand === "L" ? "R" : "L";
  }
  return null;
}

function pitcherHandFacingBatter(pa: PlateAppearance, profilePitcher: Player): "L" | "R" {
  if (pa.pitcher_hand === "L" || pa.pitcher_hand === "R") return pa.pitcher_hand;
  const t = profilePitcher.throws;
  return t === "L" || t === "R" ? t : "R";
}

function spraySplitLineBatting(
  allPas: PlateAppearance[],
  pitcherHand: "L" | "R"
): { pa: number; h: number; ab: number } {
  const filtered = allPas
    .filter((pa) => !isDemoId(pa.game_id))
    .filter((pa) => pa.pitcher_hand === pitcherHand);
  const s = battingStatsFromPAs(filtered);
  if (!s) return { pa: 0, h: 0, ab: 0 };
  return { pa: s.pa ?? 0, h: s.h ?? 0, ab: s.ab ?? 0 };
}

function spraySplitLinePitching(
  allPas: PlateAppearance[],
  profilePitcher: Player,
  batterSide: "L" | "R",
  batsById: Map<string, string | null>
): { pa: number; h: number; ab: number } {
  function effectiveOpponentBatterHand(pa: PlateAppearance): "L" | "R" | null {
    const b = batsById.get(pa.batter_id);
    return effectiveBatterHand(b, pitcherHandFacingBatter(pa, profilePitcher));
  }
  const filtered = allPas
    .filter((pa) => !isDemoId(pa.game_id))
    .filter((pa) => effectiveOpponentBatterHand(pa) === batterSide);
  const s = battingStatsFromPAs(filtered);
  if (!s) return { pa: 0, h: 0, ab: 0 };
  return { pa: s.pa ?? 0, h: s.h ?? 0, ab: s.ab ?? 0 };
}

/**
 * Spray chart payload for analyst player profile / compare — mirrors logic on the player profile page.
 */
export function buildAnalystPlayerSpraySplits(
  player: Player,
  allPlayers: Player[],
  pasAsBatter: PlateAppearance[],
  pasAsPitcher: PlateAppearance[]
): AnalystPlayerSpraySplits {
  const batsById = new Map(allPlayers.map((p) => [p.id, p.bats ?? null] as const));
  const pasForSpray = isPitcherPlayer(player) ? pasAsPitcher : pasAsBatter;

  const vsLPAsBatting = pasForSpray
    .filter((pa) => !isDemoId(pa.game_id))
    .filter((pa) => pa.pitcher_hand === "L")
    .map(bipSprayRow)
    .filter((x): x is { hit_direction: HitDirection; result: string } => x != null);

  const vsRPAsBatting = pasForSpray
    .filter((pa) => !isDemoId(pa.game_id))
    .filter((pa) => pa.pitcher_hand === "R")
    .map(bipSprayRow)
    .filter((x): x is { hit_direction: HitDirection; result: string } => x != null);

  function effectiveOpponentBatterHand(pa: PlateAppearance, profilePitcher: Player): "L" | "R" | null {
    const b = batsById.get(pa.batter_id);
    return effectiveBatterHand(b, pitcherHandFacingBatter(pa, profilePitcher));
  }

  const vsLHBHitsPitching = pasForSpray
    .filter((pa) => !isDemoId(pa.game_id))
    .filter((pa) => effectiveOpponentBatterHand(pa, player) === "L")
    .map(bipSprayRow)
    .filter((x): x is { hit_direction: HitDirection; result: string } => x != null);

  const vsRHBHitsPitching = pasForSpray
    .filter((pa) => !isDemoId(pa.game_id))
    .filter((pa) => effectiveOpponentBatterHand(pa, player) === "R")
    .map(bipSprayRow)
    .filter((x): x is { hit_direction: HitDirection; result: string } => x != null);

  if (isPitcherPlayer(player)) {
    return {
      mode: "pitching",
      vsL: {
        hand: "L",
        data: vsLHBHitsPitching,
        line: spraySplitLinePitching(pasForSpray, player, "L", batsById),
      },
      vsR: {
        hand: "R",
        data: vsRHBHitsPitching,
        line: spraySplitLinePitching(pasForSpray, player, "R", batsById),
      },
    };
  }

  return {
    mode: "batting",
    vsL: effectiveBatterHand(player.bats, "L")
      ? {
          hand: effectiveBatterHand(player.bats, "L")!,
          data: vsLPAsBatting,
          line: spraySplitLineBatting(pasForSpray, "L"),
        }
      : null,
    vsR: effectiveBatterHand(player.bats, "R")
      ? {
          hand: effectiveBatterHand(player.bats, "R")!,
          data: vsRPAsBatting,
          line: spraySplitLineBatting(pasForSpray, "R"),
        }
      : null,
  };
}
