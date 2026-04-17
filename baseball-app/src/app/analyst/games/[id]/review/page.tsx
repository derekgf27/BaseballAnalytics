import {
  getGame,
  getGameLineup,
  getPitchEventsForGame,
  getPlateAppearancesByGame,
  getPlayersByIds,
  getBaserunningTotalsForGame,
} from "@/lib/db/queries";
import { hasSupabase } from "@/lib/db/client";
import { GameReviewClient } from "./GameReviewClient";
import { notFound } from "next/navigation";
import type { GameLineupSlot } from "@/lib/types";

function buildLineupMaps(slots: GameLineupSlot[]) {
  if (slots.length === 0) {
    return { order: undefined as string[] | undefined, positionByPlayerId: {} as Record<string, string> };
  }
  const sorted = [...slots].sort((a, b) => a.slot - b.slot);
  const order = sorted.map((s) => s.player_id);
  const positionByPlayerId: Record<string, string> = {};
  for (const s of sorted) {
    if (s.position?.trim()) positionByPlayerId[s.player_id] = s.position.trim();
  }
  return { order, positionByPlayerId };
}

export default async function GameReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [game, pas, lineupSlots, baserunningByPlayerId, pitchEvents] = await Promise.all([
    getGame(id),
    getPlateAppearancesByGame(id),
    getGameLineup(id),
    getBaserunningTotalsForGame(id),
    getPitchEventsForGame(id),
  ]);
  if (!game) notFound();

  const awaySlots = lineupSlots.filter((s) => s.side === "away");
  const homeSlots = lineupSlots.filter((s) => s.side === "home");
  /** Lineups must be included: box score shows lineup order before any PAs exist; PA-only fetch left names as "Unknown". */
  const lineupPlayerIds = [...awaySlots, ...homeSlots].map((s) => s.player_id).filter(Boolean);
  const batterIds = [...new Set(pas.map((pa) => pa.batter_id).filter(Boolean))];
  const pitcherIds = [...new Set(pas.map((pa) => pa.pitcher_id).filter(Boolean))] as string[];
  const allPlayerIds = [...new Set([...batterIds, ...lineupPlayerIds, ...pitcherIds])];
  const players = await getPlayersByIds(allPlayerIds);
  const awayLineup = buildLineupMaps(awaySlots);
  const homeLineup = buildLineupMaps(homeSlots);

  const pasAway = pas.filter((p) => p.inning_half === "top");
  const pasHome = pas.filter((p) => p.inning_half === "bottom");

  return (
    <GameReviewClient
      game={game}
      canEdit={hasSupabase()}
      pasAll={pas}
      pasAway={pasAway}
      pasHome={pasHome}
      players={players}
      awayLineupOrder={awayLineup.order}
      homeLineupOrder={homeLineup.order}
      awayLineupPositionByPlayerId={awayLineup.positionByPlayerId}
      homeLineupPositionByPlayerId={homeLineup.positionByPlayerId}
      baserunningByPlayerId={baserunningByPlayerId}
      pitchEvents={pitchEvents}
    />
  );
}
