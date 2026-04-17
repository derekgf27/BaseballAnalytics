import { Suspense } from "react";
import {
  getPlayers,
  getPlayerRating,
  getPlateAppearancesByBatter,
  getPlateAppearancesByPitcher,
  getBattingStatsWithSplitsForPlayers,
} from "@/lib/db/queries";
import { hasSupabase } from "@/lib/db/client";
import { ratingsFromEvents } from "@/lib/compute";
import { buildAnalystPlayerSpraySplits } from "@/lib/analystPlayerSpraySplits";
import { computeAgeYears, formatBirthDateShortUs } from "@/lib/age";
import { PlayerProfileClient } from "./PlayerProfileClient";
import { notFound } from "next/navigation";

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [players, storedRating, pasAsBatter, pasAsPitcher, statsWithSplits] = await Promise.all([
    getPlayers(),
    getPlayerRating(id),
    getPlateAppearancesByBatter(id),
    getPlateAppearancesByPitcher(id),
    getBattingStatsWithSplitsForPlayers([id]),
  ]);
  const player = players.find((p) => p.id === id);
  if (!player) notFound();

  const computed = ratingsFromEvents(pasAsBatter);
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
  const spraySplits = buildAnalystPlayerSpraySplits(player, players, pasAsBatter, pasAsPitcher);

  const canEdit = hasSupabase();
  const ageYears = computeAgeYears(player.birth_date);
  const birthdayDisplay =
    player.birth_date != null && player.birth_date !== "" ? formatBirthDateShortUs(player.birth_date) : null;

  return (
    <Suspense fallback={<div className="animate-pulse rounded-lg bg-[var(--bg-card)] p-6" />}>
      <PlayerProfileClient
        player={player}
        ratings={ratings}
        isOverridden={!!stored}
        ageYears={ageYears}
        birthdayDisplay={birthdayDisplay}
        battingSplits={battingSplits}
        spraySplits={spraySplits}
        canEdit={canEdit}
      />
    </Suspense>
  );
}
