"use server";

import { getCachedGames, getCachedPlayers } from "@/lib/db/cachedQueries";
import { buildAnalystPlayerSpraySplits } from "@/lib/analystPlayerSpraySplits";
import type { HitterReportBundle } from "@/lib/reports/playerReportTypes";
import { isClubRosterPlayer } from "@/lib/opponentUtils";
import {
  getBattingStatsWithSplitsForPlayers,
  getHitterReportSprayData,
} from "@/lib/db/queries";
import { buildHitterProfileReportPayload } from "@/lib/reports/hitterProfileReportTables";
import type { Player } from "@/lib/types";

const MAX_HITTER_REPORT_PLAYERS = 5;

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

  const allPlayers = await getCachedPlayers();
  const resolved: Player[] = [];
  for (const id of unique) {
    const p = allPlayers.find((x) => x.id === id);
    if (!p || !isClubRosterPlayer(p)) {
      return { error: "All selected players must be on the main roster (no opponent tag)." };
    }
    resolved.push(p);
  }

  const ids = resolved.map((p) => p.id);
  const [statsMap, games, sprayData] = await Promise.all([
    getBattingStatsWithSplitsForPlayers(ids),
    getCachedGames(),
    getHitterReportSprayData(ids),
  ]);

  const perPlayer = resolved.map((pl) => {
    const pasAb = sprayData.pasByBatter[pl.id] ?? [];
    const pasAp = sprayData.pasByPitcher[pl.id] ?? [];
    const pitchEvents = sprayData.pitchEventsByBatter[pl.id] ?? [];
    const spray = buildAnalystPlayerSpraySplits(pl, allPlayers, pasAb, pasAp);
    const splits = statsMap[pl.id];
    const profile =
      splits != null
        ? buildHitterProfileReportPayload(pl.id, splits, pasAb, pitchEvents, games)
        : undefined;
    return { id: pl.id, spray, profile };
  });

  const spray: HitterReportBundle["spray"] = {};
  const profile: NonNullable<HitterReportBundle["profile"]> = {};
  for (const row of perPlayer) {
    spray[row.id] = row.spray;
    profile[row.id] = row.profile;
  }

  return {
    players: resolved.map((p) => ({
      id: p.id,
      name: p.name,
      bats: p.bats ?? null,
      jersey: p.jersey ?? null,
    })),
    batting: statsMap,
    spray,
    profile,
  };
}
