import { getCachedGames, getCachedPlayers } from "@/lib/db/cachedQueries";
import { getSavedLineups, getTrackedOpponentNames } from "@/lib/db/queries";
import { hasSupabase } from "@/lib/db/client";
import { GamesPageClientGate } from "./GamesPageClientGate";

export default async function GamesPage() {
  const [games, savedLineups, players, trackedOpponentNames] = await Promise.all([
    getCachedGames(),
    getSavedLineups(),
    getCachedPlayers(),
    getTrackedOpponentNames(),
  ]);
  const canEdit = hasSupabase();
  return (
    <GamesPageClientGate
      initialGames={games}
      initialSavedLineups={savedLineups}
      initialPlayers={players}
      initialTrackedOpponentNames={trackedOpponentNames}
      canEdit={canEdit}
    />
  );
}
