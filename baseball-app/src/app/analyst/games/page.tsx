import { getGames, getSavedLineups, getPlayers, getTrackedOpponentNames } from "@/lib/db/queries";
import { hasSupabase } from "@/lib/db/client";
import { GamesPageClient } from "./GamesPageClient";

export default async function GamesPage() {
  const [games, savedLineups, players, trackedOpponentNames] = await Promise.all([
    getGames(),
    getSavedLineups(),
    getPlayers(),
    getTrackedOpponentNames(),
  ]);
  const canEdit = hasSupabase();
  return (
    <GamesPageClient
      initialGames={games}
      initialSavedLineups={savedLineups}
      initialPlayers={players}
      initialTrackedOpponentNames={trackedOpponentNames}
      canEdit={canEdit}
    />
  );
}
