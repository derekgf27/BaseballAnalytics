import { Suspense } from "react";
import { getPlayers, getPlayerRating, getPlateAppearancesByBatter, getBattingStatsWithSplitsForPlayers } from "@/lib/db/queries";
import { ratingsFromEvents } from "@/lib/compute";
import { battingStatsFromPAs } from "@/lib/compute/battingStats";
import { PlayerProfileClient } from "./PlayerProfileClient";
import { notFound } from "next/navigation";
import { isDemoId } from "@/lib/db/mockData";
import type { PlateAppearance } from "@/lib/types";

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [players, storedRating, pas, statsWithSplits] = await Promise.all([
    getPlayers(),
    getPlayerRating(id),
    getPlateAppearancesByBatter(id),
    getBattingStatsWithSplitsForPlayers([id]),
  ]);
  const player = players.find((p) => p.id === id);
  if (!player) notFound();

  const computed = ratingsFromEvents(pas);
  const stored =
    storedRating?.overridden_at &&
    typeof storedRating.contact_reliability === "number" &&
    typeof storedRating.damage_potential === "number" &&
    typeof storedRating.decision_quality === "number" &&
    typeof storedRating.defense_trust === "number"
      ? {
          contact_reliability: storedRating.contact_reliability,
          damage_potential: storedRating.damage_potential,
          decision_quality: storedRating.decision_quality,
          defense_trust: storedRating.defense_trust,
        }
      : null;
  const ratings = stored ?? computed;
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
      // Switch hitters: vs LHP they bat right; vs RHP they bat left.
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

  return (
    <Suspense fallback={<div className="animate-pulse rounded-lg bg-[var(--bg-card)] p-6" />}>
      <PlayerProfileClient
        player={player}
        ratings={ratings}
        isOverridden={!!stored}
        battingSplits={battingSplits}
        spraySplits={spraySplits}
      />
    </Suspense>
  );
}
