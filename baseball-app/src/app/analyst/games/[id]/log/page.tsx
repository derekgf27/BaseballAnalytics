import { getGame } from "@/lib/db/queries";
import { formatDateMMDDYYYY } from "@/lib/format";
import { GameLogPageClient } from "./GameLogPageClient";
import { notFound } from "next/navigation";

export default async function GameLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();
  return (
    <GameLogPageClient
      gameId={id}
      gameLabel={`${formatDateMMDDYYYY(game.date)} ${game.away_team} @ ${game.home_team}`}
    />
  );
}
