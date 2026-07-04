import { Suspense } from "react";
import { getCachedGames, getCachedPlayers } from "@/lib/db/cachedQueries";
import {
  getPlayerRating,
  getPlateAppearancesByBatter,
  getPlateAppearancesByPitcher,
  getBattingStatsWithSplitsForPlayers,
  getPitchingStatsForPlayers,
  getPitchEventsForPaIds,
} from "@/lib/db/queries";
import { canMutateData } from "@/lib/demoMode";
import { ratingsFromEvents } from "@/lib/compute";
import { buildAnalystPlayerSpraySplits } from "@/lib/analystPlayerSpraySplits";
import { computeAgeYears, formatBirthDateShortUs } from "@/lib/age";
import { PlayerProfileClientGate } from "./PlayerProfileClientGate";
import { notFound } from "next/navigation";

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [players, games, storedRating, pasAsBatter, pasAsPitcher, statsWithSplits, pitchingStats] = await Promise.all([
    getCachedPlayers(),
    getCachedGames(),
    getPlayerRating(id),
    getPlateAppearancesByBatter(id),
    getPlateAppearancesByPitcher(id),
    getBattingStatsWithSplitsForPlayers([id]),
    getPitchingStatsForPlayers([id]),
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
  const pitchingSplits = pitchingStats[id] ?? null;
  const batterPaIds = pasAsBatter.map((p) => p.id);
  const [battingPitchEvents, pitchingPitchEvents] = await Promise.all([
    batterPaIds.length > 0 ? getPitchEventsForPaIds(batterPaIds) : Promise.resolve([]),
    pasAsPitcher.length > 0
      ? getPitchEventsForPaIds(pasAsPitcher.map((p) => p.id))
      : Promise.resolve([]),
  ]);
  const spraySplits = buildAnalystPlayerSpraySplits(player, players, pasAsBatter, pasAsPitcher);

  const canEdit = canMutateData();
  const ageYears = computeAgeYears(player.birth_date);
  const birthdayDisplay =
    player.birth_date != null && player.birth_date !== "" ? formatBirthDateShortUs(player.birth_date) : null;

  return (
    <Suspense fallback={<div className="animate-pulse rounded-lg bg-[var(--bg-card)] p-6" />}>
      <PlayerProfileClientGate
        player={player}
        ratings={ratings}
        isOverridden={!!stored}
        ageYears={ageYears}
        birthdayDisplay={birthdayDisplay}
        battingSplits={battingSplits}
        battingPas={pasAsBatter}
        battingPitchEvents={battingPitchEvents}
        pitchingSplits={pitchingSplits}
        pitchingPas={pasAsPitcher}
        pitchingPitchEvents={pitchingPitchEvents}
        spraySplits={spraySplits}
        games={games}
        canEdit={canEdit}
      />
    </Suspense>
  );
}
