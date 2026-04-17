import { notFound } from "next/navigation";
import { hasSupabase } from "@/lib/db/client";
import { getGame, getPlateAppearancesByGame, getPlayersByIds } from "@/lib/db/queries";
import { GameLogPageClient } from "./GameLogPageClient";

export default async function GameLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [game, pas] = await Promise.all([getGame(id), getPlateAppearancesByGame(id)]);
  if (!game) notFound();
  const playerIds = [
    ...new Set(
      pas.flatMap((p) => [p.batter_id, p.pitcher_id].filter((x): x is string => Boolean(x)))
    ),
  ];
  const players = playerIds.length > 0 ? await getPlayersByIds(playerIds) : [];
  return (
    <GameLogPageClient
      game={game}
      initialPas={pas}
      players={players}
      canEdit={hasSupabase()}
    />
  );
}
