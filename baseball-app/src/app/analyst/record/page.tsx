import { redirect } from "next/navigation";
import { getGame, getPlayersForGame } from "@/lib/db/queries";
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
import { RecordPageClientGate } from "./RecordPageClientGate";

export default async function RecordPAsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const gameIdParam = params?.gameId;
  const requestedGameId = typeof gameIdParam === "string" ? gameIdParam : undefined;

  const game = requestedGameId ? await getGame(requestedGameId) : null;
  const initialGameId = game?.id;

  if (game && isGameFinalized(game)) {
    redirect(analystGameReviewHref(game.id));
  }

  const players = game ? await getPlayersForGame(game) : [];

  return (
    <RecordPageClientGate
      game={game}
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
