"use server";

import { buildAnalystPlayerSpraySplits } from "@/lib/analystPlayerSpraySplits";
import { buildCoachPacketModel } from "@/lib/reports/coachPacketBuild";
import type { CoachPacketModel } from "@/lib/reports/coachPacketTypes";
import type { HitterReportBundle } from "@/lib/reports/playerReportTypes";
import { isClubRosterPlayer } from "@/lib/opponentUtils";
import {
  getGame,
  getGameLineup,
  getPlateAppearancesByBatter,
  getPlateAppearancesByGame,
  getPlateAppearancesByPitcher,
  getPlayers,
  getPlayersByIds,
  getBattingStatsWithSplitsForPlayers,
} from "@/lib/db/queries";
import type { Player } from "@/lib/types";

const MAX_HITTER_REPORT_PLAYERS = 5;

export async function fetchCoachPacketAction(
  gameId: string
): Promise<CoachPacketModel | { error: string }> {
  if (!gameId?.trim()) return { error: "Pick a game." };
  const game = await getGame(gameId);
  if (!game) return { error: "Game not found." };

  const [lineup, pas] = await Promise.all([
    getGameLineup(gameId),
    getPlateAppearancesByGame(gameId),
  ]);

  const ids = new Set<string>();
  for (const s of lineup) ids.add(s.player_id);
  for (const pa of pas) {
    ids.add(pa.batter_id);
    if (pa.pitcher_id) ids.add(pa.pitcher_id);
  }
  const players: Player[] = ids.size > 0 ? await getPlayersByIds([...ids]) : [];
  const playersById = new Map<string, Player>(players.map((p) => [p.id, p]));

  return buildCoachPacketModel(game, lineup, playersById, pas);
}

/** Splits + spray data for PDF hitter reports (club roster only). */
export async function fetchHitterReportBundleAction(
  playerIds: string[]
): Promise<HitterReportBundle | { error: string }> {
  const raw = [...new Set((playerIds ?? []).filter(Boolean))];
  if (raw.length === 0) return { error: "Select at least one player." };
  if (raw.length > MAX_HITTER_REPORT_PLAYERS) {
    return { error: `Select at most ${MAX_HITTER_REPORT_PLAYERS} players per PDF.` };
  }
  const unique = raw;

  const allPlayers = await getPlayers();
  const resolved: Player[] = [];
  for (const id of unique) {
    const p = allPlayers.find((x) => x.id === id);
    if (!p || !isClubRosterPlayer(p)) {
      return { error: "All selected players must be on the main roster (no opponent tag)." };
    }
    resolved.push(p);
  }

  const ids = resolved.map((p) => p.id);
  const [statsMap] = await Promise.all([getBattingStatsWithSplitsForPlayers(ids)]);

  const sprayEntries = await Promise.all(
    resolved.map(async (pl) => {
      const [pasAb, pasAp] = await Promise.all([
        getPlateAppearancesByBatter(pl.id),
        getPlateAppearancesByPitcher(pl.id),
      ]);
      const spray = buildAnalystPlayerSpraySplits(pl, allPlayers, pasAb, pasAp);
      return [pl.id, spray] as const;
    })
  );

  const spray: HitterReportBundle["spray"] = {};
  for (const [id, s] of sprayEntries) spray[id] = s;

  return {
    players: resolved.map((p) => ({
      id: p.id,
      name: p.name,
      bats: p.bats ?? null,
      jersey: p.jersey ?? null,
    })),
    batting: statsMap,
    spray,
  };
}
