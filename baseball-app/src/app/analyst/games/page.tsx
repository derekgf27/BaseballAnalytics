import { getCachedGames, getCachedPlayers } from "@/lib/db/cachedQueries";
import { getTrackedOpponentNames } from "@/lib/db/queries";
import { hasSupabase } from "@/lib/db/client";
import { GamesPageClientGate } from "./GamesPageClientGate";

export default async function GamesPage() {
  const [games, players, trackedOpponentNames] = await Promise.all([
    getCachedGames(),
    getCachedPlayers(),
    getTrackedOpponentNames(),
  ]);
  const canEdit = hasSupabase();
  return (
    <GamesPageClientGate
      initialGames={games}
      initialPlayers={players}
      initialTrackedOpponentNames={trackedOpponentNames}
      canEdit={canEdit}
    />
  );
}
