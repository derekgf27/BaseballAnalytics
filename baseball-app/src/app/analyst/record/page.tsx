import { redirect } from "next/navigation";
import { getGames, getPlayers } from "@/lib/db/queries";
import { isGameFinalized } from "@/lib/gameRecord";
import { analystGameReviewHref } from "@/lib/analystRoutes";
import {
  fetchPAsForGame,
  fetchGameLineupOrder,
  savePlateAppearance,
  deletePlateAppearanceAction,
  fetchBaserunningEventsForGame,
  saveBaserunningEventAction,
  deleteBaserunningEventAction,
  saveRecordGameLineupAction,
  finalizeGameScoreAction,
  linkPitchTrackerGroupToPaAction,
} from "./actions";
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

  const gameForRecord = initialGameId ? games.find((g) => g.id === initialGameId) : undefined;
  if (gameForRecord && isGameFinalized(gameForRecord)) {
    redirect(analystGameReviewHref(gameForRecord.id));
  }

  return (
    <RecordPageClient
      games={games}
      players={players}
      initialGameId={initialGameId}
      fetchPAsForGame={fetchPAsForGame}
      fetchGameLineupOrder={fetchGameLineupOrder}
      savePlateAppearance={savePlateAppearance}
      deletePlateAppearance={deletePlateAppearanceAction}
      fetchBaserunningEventsForGame={fetchBaserunningEventsForGame}
      saveBaserunningEventAction={saveBaserunningEventAction}
      deleteBaserunningEventAction={deleteBaserunningEventAction}
      saveRecordGameLineup={saveRecordGameLineupAction}
      finalizeGameScore={finalizeGameScoreAction}
      linkPitchTrackerGroupToPa={linkPitchTrackerGroupToPaAction}
    />
  );
}
