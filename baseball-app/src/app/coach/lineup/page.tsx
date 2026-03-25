import {
  getGames,
  getGameLineup,
  getPlayers,
  getSavedLineups,
  getBattingStatsWithSplitsForPlayers,
} from "@/lib/db/queries";
import { isClubRosterPlayer, isPitcherPlayer } from "@/lib/opponentUtils";
import { CoachLineupClientGate } from "./CoachLineupClientGate";
import type { CoachLineupSlot } from "./CoachLineupClient";

export const dynamic = "force-dynamic";

function buildLineupFromSlots(
  slots: { slot: number; player_id: string; position: string | null }[],
  players: Awaited<ReturnType<typeof getPlayers>>
): CoachLineupSlot[] {
  const sorted = [...slots].sort((a, b) => a.slot - b.slot);
  return sorted.map((s) => {
    const p = players.find((p) => p.id === s.player_id);
    return {
      order: s.slot,
      playerId: s.player_id,
      playerName: p?.name ?? "—",
      position: s.position ?? p?.positions?.[0] ?? "—",
      bats: p?.bats ?? null,
    };
  });
}

/**
 * Coach lineup: view/edit gameday or future game lineups. Passes games, players, stats, templates, and initial lineup.
 */
export default async function CoachLineupPage() {
  const [allPlayers, games, savedLineups] = await Promise.all([
    getPlayers(),
    getGames(),
    getSavedLineups(),
  ]);
  const players = allPlayers.filter((p) => isClubRosterPlayer(p) && !isPitcherPlayer(p));
  const playerIds = players.map((p) => p.id);
  const battingStatsWithSplits = await getBattingStatsWithSplitsForPlayers(playerIds);

  let initialLineup: CoachLineupSlot[] = [];
  const initialGame = games[0] ?? null;

  if (initialGame) {
    const slots = await getGameLineup(initialGame.id);
    const ourSlots = slots.filter((s) => s.side === initialGame.our_side);
    if (ourSlots.length > 0) {
      initialLineup = buildLineupFromSlots(
        ourSlots.map((s) => ({ slot: s.slot, player_id: s.player_id, position: s.position ?? null })),
        players
      );
    }
  }

  return (
    <CoachLineupClientGate
      games={games}
      players={players}
      initialBattingStatsWithSplits={battingStatsWithSplits}
      savedLineups={savedLineups}
      initialGameId={initialGame?.id ?? null}
      initialGameOurSide={initialGame?.our_side ?? null}
      initialLineup={initialLineup}
    />
  );
}
