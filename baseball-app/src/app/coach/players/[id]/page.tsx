import { getCachedPlayers } from "@/lib/db/cachedQueries";
import {
  getBattingStatsWithSplitsForPlayers,
  getPitchEventsForPaIds,
  getPitchingStatsForPlayers,
  getPlateAppearancesByBatter,
  getPlateAppearancesByPitcher,
} from "@/lib/db/queries";
import { buildAnalystPlayerSpraySplits } from "@/lib/analystPlayerSpraySplits";
import { isPitcherPlayer } from "@/lib/opponentUtils";
import { CoachPlayerDetailClientGate } from "./CoachPlayerDetailClientGate";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CoachPlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [players, statsWithSplits, pitchingStats, pasAsBatter, pasAsPitcher] = await Promise.all([
    getCachedPlayers(),
    getBattingStatsWithSplitsForPlayers([id]),
    getPitchingStatsForPlayers([id]),
    getPlateAppearancesByBatter(id),
    getPlateAppearancesByPitcher(id),
  ]);
  const player = players.find((p) => p.id === id);
  if (!player) notFound();

  const battingSplits = statsWithSplits[id] ?? null;
  const pitchingSplits = pitchingStats[id] ?? null;
  const pasForPitchLog = isPitcherPlayer(player) ? pasAsPitcher : pasAsBatter;
  const batterPaIds = pasForPitchLog.map((p) => p.id);
  const battingPitchEvents =
    batterPaIds.length > 0 ? await getPitchEventsForPaIds(batterPaIds) : [];
  const spraySplits = buildAnalystPlayerSpraySplits(player, players, pasAsBatter, pasAsPitcher);

  return (
    <CoachPlayerDetailClientGate
      player={player}
      battingSplits={battingSplits}
      pitchingSplits={pitchingSplits}
      spraySplits={spraySplits}
      battingPas={isPitcherPlayer(player) ? [] : pasAsBatter}
      battingPitchEvents={isPitcherPlayer(player) ? [] : battingPitchEvents}
    />
  );
}
