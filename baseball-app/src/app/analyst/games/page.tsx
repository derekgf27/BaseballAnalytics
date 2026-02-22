import { getGames, getSavedLineups, getPlayers } from "@/lib/db/queries";
import { hasSupabase } from "@/lib/db/client";
import { GamesPageClient } from "./GamesPageClient";

export default async function GamesPage() {
  const [games, savedLineups, players] = await Promise.all([
    getGames(),
    getSavedLineups(),
    getPlayers(),
  ]);
  const canEdit = hasSupabase();
  return (
    <GamesPageClient
      initialGames={games}
      initialSavedLineups={savedLineups}
      initialPlayers={players}
      canEdit={canEdit}
    />
  );
}
