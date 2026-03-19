import { getPlayers, getPlayerRating, getPlateAppearancesByBatter, getBattingStatsWithSplitsForPlayers } from "@/lib/db/queries";
import { ratingsFromEvents } from "@/lib/compute";
import { CoachPlayerDetailClient } from "./CoachPlayerDetailClient";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CoachPlayerDetailPage({
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
  const ratings = storedRating?.overridden_at
    ? {
        contact_reliability: storedRating.contact_reliability,
        damage_potential: storedRating.damage_potential,
        decision_quality: storedRating.decision_quality,
        defense_trust: storedRating.defense_trust,
      }
    : computed;

  const battingSplits = statsWithSplits[id] ?? null;

  return <CoachPlayerDetailClient player={player} ratings={ratings} battingSplits={battingSplits} />;
}
