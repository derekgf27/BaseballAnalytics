import { getGames, getPlayers } from "@/lib/db/queries";
import { fetchPAsForGame, fetchGameLineupOrder, savePlateAppearance, deletePlateAppearanceAction } from "./actions";
import RecordPageClient from "./RecordPageClient";

export default async function RecordPAsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [games, players] = await Promise.all([getGames(), getPlayers()]);
  const params = await searchParams;
  const gameIdParam = params?.gameId;
  const requestedGameId = typeof gameIdParam === "string" ? gameIdParam : undefined;
  const initialGameId =
    requestedGameId && games.some((g) => g.id === requestedGameId)
      ? requestedGameId
      : undefined;

  return (
    <RecordPageClient
      games={games}
      players={players}
      initialGameId={initialGameId}
      fetchPAsForGame={fetchPAsForGame}
      fetchGameLineupOrder={fetchGameLineupOrder}
      savePlateAppearance={savePlateAppearance}
      deletePlateAppearance={deletePlateAppearanceAction}
    />
  );
}
