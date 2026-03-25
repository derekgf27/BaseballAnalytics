import { getPlayers, getBattingStatsWithSplitsForPlayers, getPlateAppearancesByBatter } from "@/lib/db/queries";
import { battingStatsFromPAs } from "@/lib/compute/battingStats";
import { CoachPlayerDetailClient } from "./CoachPlayerDetailClient";
import { notFound } from "next/navigation";
import { isDemoId } from "@/lib/db/mockData";
import type { PlateAppearance } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CoachPlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [players, statsWithSplits, pas] = await Promise.all([
    getPlayers(),
    getBattingStatsWithSplitsForPlayers([id]),
    getPlateAppearancesByBatter(id),
  ]);
  const player = players.find((p) => p.id === id);
  if (!player) notFound();

  const battingSplits = statsWithSplits[id] ?? null;

  const BASE_HIT_RESULTS = new Set(["single", "double", "triple", "hr"]);

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

  const vsLPAs = pas
    .filter((pa) => !isDemoId(pa.game_id))
    .filter((pa) => BASE_HIT_RESULTS.has(pa.result))
    .filter((pa) => pa.hit_direction != null)
    .filter((pa) => pa.pitcher_hand === "L")
    .map((pa) => ({ hit_direction: pa.hit_direction! }));

  const vsRPAs = pas
    .filter((pa) => !isDemoId(pa.game_id))
    .filter((pa) => BASE_HIT_RESULTS.has(pa.result))
    .filter((pa) => pa.hit_direction != null)
    .filter((pa) => pa.pitcher_hand === "R")
    .map((pa) => ({ hit_direction: pa.hit_direction! }));

  function spraySplitLine(allPas: PlateAppearance[], pitcherHand: "L" | "R"): { pa: number; h: number; ab: number } {
    const filtered = allPas
      .filter((pa) => !isDemoId(pa.game_id))
      .filter((pa) => pa.pitcher_hand === pitcherHand);
    const s = battingStatsFromPAs(filtered);
    if (!s) return { pa: 0, h: 0, ab: 0 };
    return { pa: s.pa ?? 0, h: s.h ?? 0, ab: s.ab ?? 0 };
  }

  const spraySplits = {
    vsL: effectiveBatterHand(player.bats, "L")
      ? {
          hand: effectiveBatterHand(player.bats, "L")!,
          data: vsLPAs,
          line: spraySplitLine(pas, "L"),
        }
      : null,
    vsR: effectiveBatterHand(player.bats, "R")
      ? {
          hand: effectiveBatterHand(player.bats, "R")!,
          data: vsRPAs,
          line: spraySplitLine(pas, "R"),
        }
      : null,
  };

  return <CoachPlayerDetailClient player={player} battingSplits={battingSplits} spraySplits={spraySplits} />;
}
