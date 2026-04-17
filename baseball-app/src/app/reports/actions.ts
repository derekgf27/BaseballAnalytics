"use server";

import { battingStatsFromPAs } from "@/lib/compute/battingStats";
import { buildPostGameSnapshot, pasOurTeamBatting } from "@/lib/reports/postGameSnapshot";
import { buildTeamTrendSeries } from "@/lib/reports/teamTrendsSnapshot";
import { isGameFinalized, ourTeamOutcomeFromFinalScore } from "@/lib/gameRecord";
import { isDemoId } from "@/lib/db/mockData";
import {
  getBattingStatsWithSplitsForPlayers,
  getGame,
  getGameLineup,
  getGames,
  getPitcherLastOutingBefore,
  getPitchingStatsForPlayers,
  getPlateAppearancesByGame,
  getPlateAppearancesForGames,
  getPlayersByIds,
} from "@/lib/db/queries";
import type { PostGameSnapshot } from "@/lib/reports/postGameSnapshot";
import type { TeamTrendPoint } from "@/lib/reports/teamTrendsSnapshot";
import type { BattingStatsWithSplits, Game, PlateAppearance, Player } from "@/lib/types";

const PREGAME_RECENT_GAMES = 5;
const PREGAME_PRIOR_MEETINGS = 5;

function sameMatchup(a: Game, b: Game): boolean {
  const x = [a.home_team, a.away_team].sort().join("\0");
  const y = [b.home_team, b.away_team].sort().join("\0");
  return x === y;
}

function opponentNameFromGame(g: Game): string {
  return g.our_side === "home" ? g.away_team : g.home_team;
}

function ourRunsOppRuns(g: Game): { ours: number | null; opp: number | null } {
  if (
    g.final_score_home == null ||
    g.final_score_away == null ||
    Number.isNaN(g.final_score_home) ||
    Number.isNaN(g.final_score_away)
  ) {
    return { ours: null, opp: null };
  }
  return {
    ours: g.our_side === "home" ? g.final_score_home : g.final_score_away,
    opp: g.our_side === "home" ? g.final_score_away : g.final_score_home,
  };
}

function chasePctFromPas(pas: PlateAppearance[]): number | null {
  const tagged = pas.filter((p) => p.chase != null);
  if (tagged.length === 0) return null;
  return tagged.filter((p) => p.chase === true).length / tagged.length;
}

export type PreGameRecentHitterLine = {
  pa: number;
  ops: number;
  kPct: number;
  bbPct: number;
  chasePct: number | null;
};

export type PreGamePriorMeeting = {
  gameId: string;
  date: string;
  ourRuns: number | null;
  oppRuns: number | null;
  outcome: "W" | "L" | "T" | null;
  fromPas: { pa: number; ops: number; kPct: number; bbPct: number } | null;
};

export type PreGameOurStarterSummary = {
  playerId: string | null;
  name: string | null;
  seasonIpDisplay: string | null;
  seasonEra: string | null;
  lastOutingLine: string | null;
  planNotes: string | null;
};

/** Lineup slots for our club + players needed to show names (lineup + both SPs + opponent lineup). */
export type PreGameOverviewPayload = {
  ourLineup: Array<{ slot: number; player_id: string; position: string | null }>;
  opponentLineup: Array<{ slot: number; player_id: string; position: string | null }>;
  playersById: Record<string, Player>;
  /** Batting splits for lineup batters (same engine as roster reports). */
  lineupStatsByPlayerId: Record<string, BattingStatsWithSplits>;
  /** Rolling line from last {@link PREGAME_RECENT_GAMES} club games before this game (by date). */
  recentHitterLineByPlayerId: Record<string, PreGameRecentHitterLine | null>;
  recentGamesCount: number;
  priorMeetings: PreGamePriorMeeting[];
  ourStarterSummary: PreGameOurStarterSummary | null;
};

function recentHitterLineFromPas(pas: PlateAppearance[]): PreGameRecentHitterLine | null {
  if (pas.length === 0) return null;
  const st = battingStatsFromPAs(pas);
  if (!st) return null;
  return {
    pa: st.pa ?? pas.length,
    ops: st.ops,
    kPct: st.kPct ?? 0,
    bbPct: st.bbPct ?? 0,
    chasePct: chasePctFromPas(pas),
  };
}

export async function fetchPreGameOverview(
  gameId: string
): Promise<PreGameOverviewPayload | { error: string }> {
  if (!gameId?.trim()) return { error: "No game selected." };
  const game = await getGame(gameId);
  if (!game) return { error: "Game not found." };

  const lineup = await getGameLineup(gameId);
  const ourSide = game.our_side;
  const oppSide = ourSide === "home" ? "away" : "home";

  const ourLineup = lineup
    .filter((s) => s.side === ourSide)
    .sort((a, b) => a.slot - b.slot)
    .map((s) => ({
      slot: s.slot,
      player_id: s.player_id,
      position: s.position ?? null,
    }));

  const opponentLineup = lineup
    .filter((s) => s.side === oppSide)
    .sort((a, b) => a.slot - b.slot)
    .map((s) => ({
      slot: s.slot,
      player_id: s.player_id,
      position: s.position ?? null,
    }));

  const ourSpId =
    ourSide === "home" ? game.starting_pitcher_home_id ?? null : game.starting_pitcher_away_id ?? null;
  const oppSpId =
    ourSide === "home" ? game.starting_pitcher_away_id ?? null : game.starting_pitcher_home_id ?? null;

  const ids = new Set<string>();
  for (const row of ourLineup) ids.add(row.player_id);
  for (const row of opponentLineup) ids.add(row.player_id);
  if (ourSpId) ids.add(ourSpId);
  if (oppSpId) ids.add(oppSpId);

  const players = ids.size > 0 ? await getPlayersByIds([...ids]) : [];
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]));

  const lineupIds = [...new Set(ourLineup.map((r) => r.player_id))];
  const opponentLineupIds = [...new Set(opponentLineup.map((r) => r.player_id))];
  const lineupStatsIds = [...new Set([...lineupIds, ...opponentLineupIds])];
  const lineupStatsByPlayerId =
    lineupStatsIds.length > 0 ? await getBattingStatsWithSplitsForPlayers(lineupStatsIds) : {};

  const allGames = (await getGames()).filter((g) => !isDemoId(g.id));

  const recentClubGames = allGames
    .filter((g) => g.id !== game.id && g.date < game.date)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, PREGAME_RECENT_GAMES);
  const recentGameIds = new Set(recentClubGames.map((g) => g.id));

  const priorMeetingsGames = allGames
    .filter((g) => g.id !== game.id && sameMatchup(g, game) && g.date < game.date)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, PREGAME_PRIOR_MEETINGS);

  const pasGameIds = [...new Set([...recentGameIds, ...priorMeetingsGames.map((g) => g.id)])];
  const bulkPas = pasGameIds.length > 0 ? await getPlateAppearancesForGames(pasGameIds) : [];

  const recentHitterLineByPlayerId: Record<string, PreGameRecentHitterLine | null> = {};
  for (const pid of lineupIds) {
    const pasR = bulkPas.filter((p) => p.game_id && recentGameIds.has(p.game_id) && p.batter_id === pid);
    recentHitterLineByPlayerId[pid] = recentHitterLineFromPas(pasR);
  }

  const priorMeetings: PreGamePriorMeeting[] = priorMeetingsGames.map((pg) => {
    const pasG = bulkPas.filter((p) => p.game_id === pg.id);
    const ours = pasOurTeamBatting(pg, pasG);
    const teamSt = ours.length > 0 ? battingStatsFromPAs(ours) : null;
    const { ours: ourRuns, opp: oppRuns } = ourRunsOppRuns(pg);
    let outcome: "W" | "L" | "T" | null = null;
    if (isGameFinalized(pg)) {
      const o = ourTeamOutcomeFromFinalScore(pg);
      if (o === "W" || o === "L" || o === "T") outcome = o;
    }
    return {
      gameId: pg.id,
      date: pg.date,
      ourRuns,
      oppRuns,
      outcome,
      fromPas:
        teamSt && (teamSt.pa ?? 0) > 0
          ? {
              pa: teamSt.pa ?? 0,
              ops: teamSt.ops,
              kPct: teamSt.kPct ?? 0,
              bbPct: teamSt.bbPct ?? 0,
            }
          : null,
    };
  });

  let ourStarterSummary: PreGameOurStarterSummary | null = null;
  const planNotes = game.our_sp_plan_notes?.trim() || null;
  if (ourSpId && !isDemoId(ourSpId)) {
    const p = playersById[ourSpId];
    const pitchStats = await getPitchingStatsForPlayers([ourSpId]);
    const po = pitchStats[ourSpId]?.overall;
    let lastOutingLine: string | null = null;
    const last = await getPitcherLastOutingBefore(ourSpId, game.date, game.id);
    if (last) {
      const opp = opponentNameFromGame(last.game);
      const er = last.overall.er;
      const r = last.overall.r;
      const ip = last.overall.ipDisplay;
      lastOutingLine = `${last.game.date} vs ${opp}: ${ip} IP, ${r} R (${er} ER)`;
    }
    ourStarterSummary = {
      playerId: ourSpId,
      name: p?.name ?? null,
      seasonIpDisplay: po && po.ip > 0 ? po.ipDisplay : null,
      seasonEra: po && po.ip > 0 && Number.isFinite(po.era) ? po.era.toFixed(2) : null,
      lastOutingLine,
      planNotes,
    };
  } else if (planNotes) {
    ourStarterSummary = {
      playerId: null,
      name: null,
      seasonIpDisplay: null,
      seasonEra: null,
      lastOutingLine: null,
      planNotes,
    };
  }

  return {
    ourLineup,
    opponentLineup,
    playersById,
    lineupStatsByPlayerId,
    recentHitterLineByPlayerId,
    recentGamesCount: recentClubGames.length,
    priorMeetings,
    ourStarterSummary,
  };
}

export type ReportsGamePayload = {
  game: Game;
  postGame: PostGameSnapshot;
  playersById: Record<string, Player>;
};

export async function fetchReportsGamePayload(
  gameId: string
): Promise<ReportsGamePayload | { error: string }> {
  if (!gameId?.trim()) return { error: "Select a game." };
  const game = await getGame(gameId);
  if (!game) return { error: "Game not found." };

  const pas = await getPlateAppearancesByGame(gameId);

  const batterIds = [...new Set(pas.map((p) => p.batter_id).filter(Boolean))];
  const players = batterIds.length > 0 ? await getPlayersByIds(batterIds) : [];
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]));

  const postGame = buildPostGameSnapshot(game, pas, new Map(players.map((p) => [p.id, p])));

  return { game, postGame, playersById };
}

export async function fetchTeamTrendsPayload(maxGames = 10): Promise<{
  points: TeamTrendPoint[];
  insights: string[];
} | { error: string }> {
  const games = await getGames();
  const clean = games.filter((g) => !isDemoId(g.id)).slice(0, maxGames);
  if (clean.length === 0) return { points: [], insights: ["Add completed games to see team trends."] };

  const ids = clean.map((g) => g.id);
  const pas = await getPlateAppearancesForGames(ids);
  const points = buildTeamTrendSeries(clean, pas);

  const insights: string[] = [];
  if (points.length >= 3) {
    const last3 = points.slice(-3);
    const kAvg = last3.reduce((s, p) => s + p.kPct, 0) / 3;
    const prev = points.slice(-6, -3);
    if (prev.length >= 2) {
      const kPrev = prev.reduce((s, p) => s + p.kPct, 0) / prev.length;
      if (kAvg - kPrev > 0.05) insights.push("Strikeout rate up over the last three games vs the prior sample.");
      if (kPrev - kAvg > 0.05) insights.push("Strikeout rate improving recently.");
    }
    const opsSlope = last3[2]!.ops - last3[0]!.ops;
    if (opsSlope > 0.08) insights.push("OPS trending upward in the last three games.");
    if (opsSlope < -0.08) insights.push("OPS dipped in the last three games.");
  }
  if (insights.length === 0) insights.push("Trend lines below — add more games for stronger narrative cues.");

  return { points, insights };
}
