import { getGames, getGameLineup, getPlayers, getSavedLineups, getSavedLineupWithSlots } from "@/lib/db/queries";
import { CoachLineupClient } from "./CoachLineupClient";
import type { CoachLineupSlot } from "./CoachLineupClient";

export const dynamic = "force-dynamic";

/**
 * Read-only lineup for coach. Data from most recent game, or a saved template, or first 9 players.
 */
export default async function CoachLineupPage() {
  const players = await getPlayers();
  const games = await getGames();
  const savedLineups = await getSavedLineups();

  let lineup: CoachLineupSlot[] = [];
  let templateName: string | null = null;

  const game = games[0] ?? null;
  if (game) {
    const slots = await getGameLineup(game.id);
    if (slots.length > 0) {
      lineup = slots.sort((a, b) => a.slot - b.slot).map((s) => {
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
  }

  if (lineup.length === 0 && savedLineups.length > 0) {
    const first = await getSavedLineupWithSlots(savedLineups[0].id);
    if (first?.slots?.length) {
      templateName = first.name;
      const sorted = [...first.slots].sort((a, b) => a.slot - b.slot);
      lineup = sorted.map((s) => {
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
  }

  if (lineup.length === 0 && players.length > 0) {
    const nine = players.slice(0, 9);
    lineup = nine.map((p, i) => ({
      order: i + 1,
      playerId: p.id,
      playerName: p.name,
      position: p.positions?.[0] ?? "—",
      bats: p.bats ?? null,
    }));
  }

  return <CoachLineupClient lineup={lineup} templateName={templateName} />;
}
