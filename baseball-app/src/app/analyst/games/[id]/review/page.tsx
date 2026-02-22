import { getGame, getGameLineup, getPlateAppearancesByGame, getPlayersByIds } from "@/lib/db/queries";
import { GameReviewClient } from "./GameReviewClient";
import { notFound } from "next/navigation";

export default async function GameReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [game, pas, lineupSlots] = await Promise.all([
    getGame(id),
    getPlateAppearancesByGame(id),
    getGameLineup(id),
  ]);
  if (!game) notFound();
  const batterIds = [...new Set(pas.map((pa) => pa.batter_id).filter(Boolean))];
  const players = await getPlayersByIds(batterIds);
  const lineupOrder = lineupSlots.length > 0 ? lineupSlots.map((s) => s.player_id) : undefined;
  const lineupPositionByPlayerId: Record<string, string> = {};
  for (const s of lineupSlots) {
    if (s.position?.trim()) lineupPositionByPlayerId[s.player_id] = s.position.trim();
  }
  return (
    <GameReviewClient
      gameId={id}
      game={game}
      pas={pas}
      players={players}
      lineupOrder={lineupOrder}
      lineupPositionByPlayerId={lineupPositionByPlayerId}
    />
  );
}
