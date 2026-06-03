import { getCachedGames, getCachedPlayers } from "@/lib/db/cachedQueries";
import {
  getBattingStatsWithSplitsForPlayers,
  getGameLineup,
  getSavedLineups,
} from "@/lib/db/queries";
import { isGameFinalized } from "@/lib/gameRecord";
import { isActiveRosterPlayer, isClubRosterPlayer, isPitcherPlayer } from "@/lib/opponentUtils";
import { getPlayerPrimaryPosition } from "@/lib/playerRoster";
import type { InitialGameLineupSlot, LineupConstructionClientProps } from "./LineupConstructionClient";

function buildInitialGameLineup(
  slots: { slot: number; player_id: string; position: string | null }[],
  players: Awaited<ReturnType<typeof getCachedPlayers>>
): InitialGameLineupSlot[] {
  const sorted = [...slots].sort((a, b) => a.slot - b.slot);
  return sorted.map((s) => {
    const p = players.find((pl) => pl.id === s.player_id);
    return {
      order: s.slot,
      playerId: s.player_id,
      playerName: p?.name ?? "—",
      position: s.position ?? getPlayerPrimaryPosition(p) ?? "—",
      bats: p?.bats ?? null,
    };
  });
}

/** Shared server props for Analyst + Coach lineup builder (games dropdown, per-game save). */
export async function loadLineupConstructionPageProps(): Promise<LineupConstructionClientProps> {
  const [allPlayers, games, savedLineups] = await Promise.all([
    getCachedPlayers(),
    getCachedGames(),
    getSavedLineups(),
  ]);
  const players = allPlayers.filter(
    (p) => isClubRosterPlayer(p) && isActiveRosterPlayer(p) && !isPitcherPlayer(p)
  );
  const playerIds = players.map((p) => p.id);
  const battingStatsWithSplits = await getBattingStatsWithSplitsForPlayers(playerIds);

  let initialGameLineup: InitialGameLineupSlot[] = [];
  const initialGame = games.find((g) => !isGameFinalized(g)) ?? null;

  if (initialGame) {
    const rows = await getGameLineup(initialGame.id);
    const ourRows = rows.filter((s) => s.side === initialGame.our_side);
    const bySlot = new Map<number, (typeof ourRows)[0]>();
    for (const s of ourRows) {
      bySlot.set(s.slot, s);
    }
    const ourSlots = [...bySlot.values()].sort((a, b) => a.slot - b.slot);
    if (ourSlots.length > 0) {
      initialGameLineup = buildInitialGameLineup(
        ourSlots.map((s) => ({ slot: s.slot, player_id: s.player_id, position: s.position ?? null })),
        players
      );
    }
  }

  return {
    initialPlayers: players,
    initialBattingStatsWithSplits: battingStatsWithSplits,
    initialSavedLineups: savedLineups,
    games,
    initialGameId: initialGame?.id ?? null,
    initialGameOurSide: initialGame?.our_side ?? null,
    initialGameLineup,
  };
}
