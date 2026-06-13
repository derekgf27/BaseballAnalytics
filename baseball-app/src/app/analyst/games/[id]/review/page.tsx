import { Suspense } from "react";
import {
  getGame,
  getGameLineup,
  getPitchEventsForGame,
  getPitcherOfficialTotalsForPlayers,
  getPlateAppearancesByGame,
  getPlayersByIds,
  getBaserunningTotalsForGame,
} from "@/lib/db/queries";
import { hasSupabase } from "@/lib/db/client";
import { GameReviewClientGate } from "./GameReviewClientGate";
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

function calendarYearFromGameDate(date: string): number | undefined {
  const y = Number(date.slice(0, 4));
  return Number.isFinite(y) && y >= 1900 && y <= 2100 ? y : undefined;
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
  const creditPitcherIds = [
    game.winning_pitcher_id,
    game.losing_pitcher_id,
    game.save_pitcher_id,
  ].filter((id): id is string => Boolean(id?.trim()));
  const allPlayerIds = [...new Set([...batterIds, ...lineupPlayerIds, ...pitcherIds, ...creditPitcherIds])];
  const players = await getPlayersByIds(allPlayerIds);
  const awayLineup = buildLineupMaps(awaySlots);
  const homeLineup = buildLineupMaps(homeSlots);

  const pasAway = pas.filter((p) => p.inning_half === "top");
  const pasHome = pas.filter((p) => p.inning_half === "bottom");

  const uniqueCreditPitchers = [...new Set(creditPitcherIds)];
  const pitcherOfficialTotals = hasSupabase()
    ? await getPitcherOfficialTotalsForPlayers(uniqueCreditPitchers, {
        calendarYear: calendarYearFromGameDate(game.date),
      })
    : Object.fromEntries(
        uniqueCreditPitchers.map((id) => [id, { wins: 0, losses: 0, saves: 0 }])
      );

  return (
    <Suspense fallback={<div className="min-h-[50vh] p-8 text-sm text-[var(--text-muted)]">Loading review…</div>}>
      <GameReviewClientGate
      game={game}
      canEdit={hasSupabase()}
      pasAll={pas}
      pasAway={pasAway}
      pasHome={pasHome}
      players={players}
      pitcherOfficialTotals={pitcherOfficialTotals}
      awayLineupOrder={awayLineup.order}
      homeLineupOrder={homeLineup.order}
      awayLineupPositionByPlayerId={awayLineup.positionByPlayerId}
      homeLineupPositionByPlayerId={homeLineup.positionByPlayerId}
      baserunningByPlayerId={baserunningByPlayerId}
      pitchEvents={pitchEvents}
    />
    </Suspense>
  );
}
