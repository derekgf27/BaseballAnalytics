import { getPlayers, getBattingStatsWithSplitsForPlayers } from "@/lib/db/queries";
import { StatsPageClient } from "./StatsPageClient";

/** Always fetch fresh stats so recorded PAs (including SB, R, RBI, etc.) show up immediately. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StatsPage() {
  const players = await getPlayers();
  const playerIds = players.map((p) => p.id);
  const battingStatsWithSplits = await getBattingStatsWithSplitsForPlayers(playerIds);
  return (
    <StatsPageClient
      initialPlayers={players}
      initialBattingStatsWithSplits={battingStatsWithSplits}
    />
  );
}
