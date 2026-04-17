import {
  getPlayers,
  getBattingStatsWithSplitsForPlayers,
  getPlateAppearancesByBatter,
  getPlateAppearancesByPitcher,
} from "@/lib/db/queries";
import { battingStatsFromPAs } from "@/lib/compute/battingStats";
import { isPitcherPlayer } from "@/lib/opponentUtils";
import { isSprayChartBipResult, isValidSprayHitDirection } from "@/lib/sprayChartFilters";
import { CoachPlayerDetailClient } from "./CoachPlayerDetailClient";
import { notFound } from "next/navigation";
import { isDemoId } from "@/lib/db/mockData";
import type { HitDirection, PlateAppearance, Player } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CoachPlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [players, statsWithSplits, pasAsBatter, pasAsPitcher] = await Promise.all([
    getPlayers(),
    getBattingStatsWithSplitsForPlayers([id]),
    getPlateAppearancesByBatter(id),
    getPlateAppearancesByPitcher(id),
  ]);
  const player = players.find((p) => p.id === id);
  if (!player) notFound();

  const battingSplits = statsWithSplits[id] ?? null;

  function bipSprayRow(pa: PlateAppearance): { hit_direction: HitDirection; result: string } | null {
    if (!pa.hit_direction || !isValidSprayHitDirection(pa.hit_direction)) return null;
    if (!isSprayChartBipResult(pa.result)) return null;
    return { hit_direction: pa.hit_direction, result: pa.result };
  }

  function effectiveBatterHand(
    bats: string | null | undefined,
    pitcherHand: "L" | "R"
  ): "L" | "R" | null {
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

  const batsById = new Map(players.map((p) => [p.id, p.bats ?? null] as const));

  function effectiveOpponentBatterHand(pa: PlateAppearance, profilePitcher: Player): "L" | "R" | null {
    const b = batsById.get(pa.batter_id);
    return effectiveBatterHand(b, pitcherHandFacingBatter(pa, profilePitcher));
  }

  function spraySplitLineBatting(allPas: PlateAppearance[], pitcherHand: "L" | "R"): { pa: number; h: number; ab: number } {
    const filtered = allPas
      .filter((pa) => !isDemoId(pa.game_id))
      .filter((pa) => pa.pitcher_hand === pitcherHand);
    const s = battingStatsFromPAs(filtered);
    if (!s) return { pa: 0, h: 0, ab: 0 };
    return { pa: s.pa ?? 0, h: s.h ?? 0, ab: s.ab ?? 0 };
  }

  function spraySplitLinePitching(allPas: PlateAppearance[], profilePitcher: Player, batterSide: "L" | "R"): {
    pa: number;
    h: number;
    ab: number;
  } {
    const filtered = allPas
      .filter((pa) => !isDemoId(pa.game_id))
      .filter((pa) => effectiveOpponentBatterHand(pa, profilePitcher) === batterSide);
    const s = battingStatsFromPAs(filtered);
    if (!s) return { pa: 0, h: 0, ab: 0 };
    return { pa: s.pa ?? 0, h: s.h ?? 0, ab: s.ab ?? 0 };
  }

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

  const spraySplits = isPitcherPlayer(player)
    ? {
        mode: "pitching" as const,
        vsL: {
          hand: "L" as const,
          data: vsLHBHitsPitching,
          line: spraySplitLinePitching(pasForSpray, player, "L"),
        },
        vsR: {
          hand: "R" as const,
          data: vsRHBHitsPitching,
          line: spraySplitLinePitching(pasForSpray, player, "R"),
        },
      }
    : {
        mode: "batting" as const,
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

  return <CoachPlayerDetailClient player={player} battingSplits={battingSplits} spraySplits={spraySplits} />;
}
