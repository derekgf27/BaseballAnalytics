import { getCachedGames, getCachedPlayers } from "@/lib/db/cachedQueries";
import { getTrackedOpponentNames } from "@/lib/db/queries";
import { canMutateData } from "@/lib/demoMode";
import { mergeOpponentNameLists, uniqueOpponentNames } from "@/lib/opponentUtils";
import { GamesPageClientGate } from "./GamesPageClientGate";

export default async function GamesPage() {
  const [games, players, trackedOpponentNames] = await Promise.all([
    getCachedGames(),
    getCachedPlayers(),
    getTrackedOpponentNames(),
  ]);
  const opponentNames = mergeOpponentNameLists(
    uniqueOpponentNames(games),
    trackedOpponentNames
  );
  const canEdit = canMutateData();
  return (
    <GamesPageClientGate
      initialGames={games}
      initialPlayers={players}
      initialOpponentNames={opponentNames}
      canEdit={canEdit}
    />
  );
}
