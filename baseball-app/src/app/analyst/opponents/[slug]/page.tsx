import { notFound } from "next/navigation";
import { computeBattingStatsWithSplitsFromPas } from "@/lib/compute/battingStatsWithSplitsFromPas";
import { computePitchingStatsWithSplitsForRoster } from "@/lib/compute/pitchingStats";
import {
  getGames,
  getPlayers,
  getPlateAppearancesForGames,
  getGameLineupsForGames,
  getBaserunningEventsForGames,
  getSprayChartRowsForGames,
  getTrackedOpponentNames,
  getPitchEventsForPaIds,
} from "@/lib/db/queries";
import { isDemoId } from "@/lib/db/mockData";
import { comparePlayersByLastNameThenFull } from "@/lib/playerSort";
import {
  gamesVsOpponent,
  isPitcherPlayer,
  opponentBattingHalf,
  opponentLineupSide,
  opponentNameKey,
  ourTeamName,
} from "@/lib/opponentUtils";
import type {
  BattingStatsWithSplits,
  ClubBattingMatchupPayload,
  ClubPitchingMatchupPayload,
  PitchingStatsWithSplits,
  Player,
} from "@/lib/types";
import { OpponentDetailClient } from "../OpponentDetailClient";

export const dynamic = "force-dynamic";

export default async function OpponentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let opponentName: string;
  try {
    opponentName = decodeURIComponent(slug);
  } catch {
    notFound();
  }

  const [games, players, trackedNames] = await Promise.all([
    getGames(),
    getPlayers(),
    getTrackedOpponentNames(),
  ]);

  const opponentNameTrim = opponentName.trim();
  const key = opponentNameKey(opponentNameTrim);
  const vsGames = gamesVsOpponent(games, opponentName);
  const inTracked = trackedNames.some((t) => opponentNameKey(t) === key);
  const hasTaggedPlayers = players.some(
    (p) => p.opponent_team && opponentNameKey(p.opponent_team) === key
  );
  if (vsGames.length === 0 && !inTracked && !hasTaggedPlayers) notFound();

  const gameIds = vsGames.map((g) => g.id);
  const [allPas, lineups, sprayRows, brEvents] = await Promise.all([
    getPlateAppearancesForGames(gameIds),
    getGameLineupsForGames(gameIds),
    getSprayChartRowsForGames(gameIds),
    getBaserunningEventsForGames(gameIds),
  ]);

  const gameById = new Map(vsGames.map((g) => [g.id, g]));
  const taggedPlayers = players.filter(
    (p) => p.opponent_team && opponentNameKey(p.opponent_team) === opponentNameKey(opponentNameTrim)
  );
  const taggedPlayerIds = new Set(taggedPlayers.map((p) => p.id));
  /** Batting + spray only count players tagged for this opponent (same as View roster). */
  const hasTaggedOpponentRoster = taggedPlayers.length > 0;

  const opponentPas = allPas.filter((pa) => {
    const g = gameById.get(pa.game_id);
    if (!g) return false;
    const half = opponentBattingHalf(g);
    return pa.inning_half === half;
  });

  const opponentSpray = sprayRows.filter((r) => {
    const g = gameById.get(r.game_id);
    if (!g) return false;
    const half = opponentBattingHalf(g);
    return r.inning_half === half;
  });

  const latest =
    vsGames.length > 0
      ? [...vsGames].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0]
      : null;

  let battingStatsPlayers: Player[] = [];
  let pitchingStatsPlayers: Player[] = [];
  let opponentBattingStatsWithSplits: Record<string, BattingStatsWithSplits> = {};
  let opponentPitchingStatsWithSplits: Record<string, PitchingStatsWithSplits> = {};
  let battingMatchupPayload: ClubBattingMatchupPayload | undefined;
  let pitchingMatchupPayload: ClubPitchingMatchupPayload | undefined;
  let opponentBattingPlayerIds: string[] = [];
  let opponentPitchingPlayerIds: string[] = [];
  let battingPlayersForSheet: Player[] = [];
  let pitchingPlayersForSheet: Player[] = [];
  let sprayDataForClient: {
    game_id: string;
    batter_id: string;
    hit_direction: string;
    result: string;
    pitcher_hand: "L" | "R" | null;
  }[] = [];
  let pitcherSprayDataForClient: {
    game_id: string;
    batter_id: string;
    hit_direction: string;
    result: string;
    pitcher_hand: "L" | "R" | null;
  }[] = [];

  if (hasTaggedOpponentRoster) {
    const opponentPasTagged = opponentPas.filter((pa) => taggedPlayerIds.has(pa.batter_id));
    const opponentPitchingHalfByGameId = new Map<string, "top" | "bottom">(
      vsGames.map((g) => [g.id, opponentBattingHalf(g) === "top" ? "bottom" : "top"])
    );
    const opponentPitchingPas = allPas.filter((pa) => {
      const half = opponentPitchingHalfByGameId.get(pa.game_id);
      return half != null && pa.inning_half === half;
    });

    const startedGamesByPlayer = new Map<string, Set<string>>();
    for (const g of vsGames) {
      const side = opponentLineupSide(g);
      for (const row of lineups) {
        if (row.game_id === g.id && row.side === side && taggedPlayerIds.has(row.player_id)) {
          const set = startedGamesByPlayer.get(row.player_id) ?? new Set<string>();
          set.add(g.id);
          startedGamesByPlayer.set(row.player_id, set);
        }
      }
    }

    const baserunningByPlayerId: Record<string, { sb: number; cs: number }> = {};
    for (const id of taggedPlayerIds) {
      baserunningByPlayerId[id] = { sb: 0, cs: 0 };
    }
    for (const e of brEvents) {
      if (!taggedPlayerIds.has(e.runner_id)) continue;
      const g = gameById.get(e.game_id);
      if (!g) continue;
      if (e.inning_half !== opponentBattingHalf(g)) continue;
      const cur = baserunningByPlayerId[e.runner_id] ?? { sb: 0, cs: 0 };
      if (e.event_type === "sb") cur.sb++;
      else cur.cs++;
      baserunningByPlayerId[e.runner_id] = cur;
    }

    const rosterPlayerIds = [...taggedPlayerIds]
      .filter((id) => !isDemoId(id))
      .filter((id) => {
        const pl = players.find((p) => p.id === id);
        return pl && !isPitcherPlayer(pl);
      });
    const rosterPlayersForSheet = [...taggedPlayers]
      .filter((p) => !isPitcherPlayer(p))
      .sort(comparePlayersByLastNameThenFull);

    sprayDataForClient = opponentSpray
      .filter((r) => taggedPlayerIds.has(r.batter_id))
      .filter((r) => {
        const pl = players.find((p) => p.id === r.batter_id);
        return pl && !isPitcherPlayer(pl);
      })
      .map((row) => ({
        game_id: row.game_id,
        batter_id: row.batter_id,
        hit_direction: row.hit_direction,
        result: row.result,
        pitcher_hand: row.pitcher_hand,
      }));

    const opponentPitchingSpray = sprayRows.filter((r) => {
      const g = gameById.get(r.game_id);
      if (!g) return false;
      const pitchingHalf = opponentBattingHalf(g) === "top" ? "bottom" : "top";
      return r.inning_half === pitchingHalf;
    });
    pitcherSprayDataForClient = opponentPitchingSpray
      .filter((r) => r.pitcher_id && taggedPlayerIds.has(r.pitcher_id))
      .filter((r) => {
        const pl = players.find((p) => p.id === r.pitcher_id);
        return pl && isPitcherPlayer(pl);
      })
      .filter((r) => !taggedPlayerIds.has(r.batter_id))
      .map((row) => ({
        game_id: row.game_id,
        batter_id: row.batter_id,
        hit_direction: row.hit_direction,
        result: row.result,
        pitcher_hand: row.pitcher_hand,
      }));

    const taggedPitchers = [...taggedPlayers]
      .filter((p) => isPitcherPlayer(p))
      .sort(comparePlayersByLastNameThenFull);
    const taggedPitcherIds = taggedPitchers.map((p) => p.id);
    const batterBatsById = new Map(players.map((p) => [p.id, p.bats ?? null]));
    const starterGameIdsByPlayer = new Map<string, Set<string>>();
    for (const g of vsGames) {
      if (g.our_side === "home") {
        const pid = g.starting_pitcher_away_id;
        if (pid && taggedPlayerIds.has(pid)) {
          const set = starterGameIdsByPlayer.get(pid) ?? new Set<string>();
          set.add(g.id);
          starterGameIdsByPlayer.set(pid, set);
        }
      } else {
        const pid = g.starting_pitcher_home_id;
        if (pid && taggedPlayerIds.has(pid)) {
          const set = starterGameIdsByPlayer.get(pid) ?? new Set<string>();
          set.add(g.id);
          starterGameIdsByPlayer.set(pid, set);
        }
      }
    }
    const opponentPitchingPasTagged = opponentPitchingPas.filter(
      (pa): pa is typeof pa & { pitcher_id: string } =>
        typeof pa.pitcher_id === "string" && taggedPlayerIds.has(pa.pitcher_id)
    );
    const contactPaIds = [
      ...opponentPasTagged.map((p) => p.id),
      ...opponentPitchingPasTagged.map((p) => p.id),
    ].filter(Boolean) as string[];
    const opponentPitchEvents =
      contactPaIds.length > 0 ? await getPitchEventsForPaIds([...new Set(contactPaIds)]) : [];

    opponentBattingStatsWithSplits = computeBattingStatsWithSplitsFromPas(
      rosterPlayerIds,
      opponentPasTagged,
      baserunningByPlayerId,
      startedGamesByPlayer,
      opponentPitchEvents
    );
    opponentPitchingStatsWithSplits = computePitchingStatsWithSplitsForRoster(
      taggedPitcherIds,
      opponentPitchingPasTagged,
      starterGameIdsByPlayer,
      batterBatsById,
      opponentPitchEvents
    );
    battingStatsPlayers = rosterPlayersForSheet.filter(
      (p) => (opponentBattingStatsWithSplits[p.id]?.overall.pa ?? 0) > 0
    );
    pitchingStatsPlayers = taggedPitchers.filter(
      (p) => (opponentPitchingStatsWithSplits[p.id]?.overall.g ?? 0) > 0
    );

    opponentBattingPlayerIds = rosterPlayerIds;
    opponentPitchingPlayerIds = taggedPitcherIds;
    battingPlayersForSheet = rosterPlayersForSheet;
    pitchingPlayersForSheet = taggedPitchers;

    battingMatchupPayload = {
      pas: opponentPasTagged,
      games: vsGames,
      baserunningByPlayerId,
      startedGameIdsByPlayer: Object.fromEntries(
        [...startedGamesByPlayer.entries()].map(([pid, set]) => [pid, [...set]])
      ),
      pitchEvents: opponentPitchEvents,
    };
    pitchingMatchupPayload = {
      pas: opponentPitchingPasTagged,
      games: vsGames,
      starterGameIdsByPlayer: Object.fromEntries(
        [...starterGameIdsByPlayer.entries()].map(([pid, set]) => [pid, [...set]])
      ),
      batterBatsById: Object.fromEntries(batterBatsById) as Record<string, string | null>,
      pitchEvents: opponentPitchEvents,
    };
  }

  const sortedAllGames = [...games].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const ourTeamLabel =
    latest != null
      ? ourTeamName(latest)
      : sortedAllGames.length > 0
        ? ourTeamName(sortedAllGames[0])
        : "Club";

  const playerIdToName = Object.fromEntries(players.map((p) => [p.id, p.name]));

  return (
    <OpponentDetailClient
      opponentName={opponentNameTrim}
      ourTeamLabel={ourTeamLabel}
      games={vsGames}
      players={players}
      battingStatsPlayers={battingStatsPlayers}
      pitchingStatsPlayers={pitchingStatsPlayers}
      battingPlayersForSheet={battingPlayersForSheet}
      pitchingPlayersForSheet={pitchingPlayersForSheet}
      opponentBattingStatsWithSplits={opponentBattingStatsWithSplits}
      opponentPitchingStatsWithSplits={opponentPitchingStatsWithSplits}
      battingMatchupPayload={battingMatchupPayload}
      pitchingMatchupPayload={pitchingMatchupPayload}
      opponentBattingPlayerIds={opponentBattingPlayerIds}
      opponentPitchingPlayerIds={opponentPitchingPlayerIds}
      playerIdToName={playerIdToName}
      sprayData={sprayDataForClient}
      pitcherSprayData={pitcherSprayDataForClient}
      hasTaggedOpponentRoster={hasTaggedOpponentRoster}
    />
  );
}
