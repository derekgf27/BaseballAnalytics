import { getPlayers, getBattingStatsWithSplitsForPlayers, getSavedLineups } from "@/lib/db/queries";
import LineupConstructionClient from "./LineupConstructionClient";

export default async function LineupConstructionPage() {
  const [players, savedLineups] = await Promise.all([getPlayers(), getSavedLineups()]);
  const playerIds = players.map((p) => p.id);
  const battingStatsWithSplits = await getBattingStatsWithSplitsForPlayers(playerIds);
  return (
    <LineupConstructionClient
      initialPlayers={players}
      initialBattingStatsWithSplits={battingStatsWithSplits}
      initialSavedLineups={savedLineups}
    />
  );
}
