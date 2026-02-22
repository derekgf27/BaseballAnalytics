import { getGames, getPlayers } from "@/lib/db/queries";
import { fetchPAsForGame, fetchGameLineupOrder, savePlateAppearance, deletePlateAppearanceAction } from "./actions";
import RecordPageClient from "./RecordPageClient";

export default async function RecordPAsPage() {
  const [games, players] = await Promise.all([getGames(), getPlayers()]);
  return (
    <RecordPageClient
      games={games}
      players={players}
      fetchPAsForGame={fetchPAsForGame}
      fetchGameLineupOrder={fetchGameLineupOrder}
      savePlateAppearance={savePlateAppearance}
      deletePlateAppearance={deletePlateAppearanceAction}
    />
  );
}
