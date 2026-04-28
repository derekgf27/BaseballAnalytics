import { getPlayers, getBattingStatsWithSplitsForPlayers, getSavedLineups } from "@/lib/db/queries";
import { isActiveRosterPlayer, isClubRosterPlayer, isPitcherPlayer } from "@/lib/opponentUtils";
import { LineupConstructionClientGate } from "./LineupConstructionClientGate";

export default async function LineupConstructionPage() {
  const [allPlayers, savedLineups] = await Promise.all([getPlayers(), getSavedLineups()]);
  const players = allPlayers.filter(
    (p) => isClubRosterPlayer(p) && isActiveRosterPlayer(p) && !isPitcherPlayer(p)
  );
  const playerIds = players.map((p) => p.id);
  const battingStatsWithSplits = await getBattingStatsWithSplitsForPlayers(playerIds);
  return (
    <LineupConstructionClientGate
      initialPlayers={players}
      initialBattingStatsWithSplits={battingStatsWithSplits}
      initialSavedLineups={savedLineups}
    />
  );
}
