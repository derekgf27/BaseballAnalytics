import { hasSupabase } from "@/lib/db/client";
import {
  getGames,
  getPlayers,
  getBattingStatsWithSplitsForPlayers,
  getPlateAppearancesByBatters,
} from "@/lib/db/queries";
import { pitchMixFromPlateAppearances } from "@/lib/compute/battingStats";
import { buildAnalystPlayerSpraySplits } from "@/lib/analystPlayerSpraySplits";
import type { AnalystPlayerSpraySplits } from "@/lib/analystPlayerSpraySplits";
import { isClubRosterPlayer, isPitcherPlayer } from "@/lib/opponentUtils";
import { fetchTeamTrendsPayload } from "@/app/reports/actions";
import { ReportsHubClient } from "./ReportsHubClient";
import type { PlateAppearance } from "@/lib/types";

export default async function ReportsPage() {
  const canEdit = hasSupabase();
  const [games, players, trendsRes] = await Promise.all([
    getGames(),
    getPlayers(),
    fetchTeamTrendsPayload(12),
  ]);

  const roster = players.filter(isClubRosterPlayer).sort((a, b) => a.name.localeCompare(b.name));
  const batterRoster = roster.filter((p) => !isPitcherPlayer(p));
  const batterIds = batterRoster.map((p) => p.id);
  const [statsByPlayerId, pasForBatters] = await Promise.all([
    batterIds.length > 0 ? getBattingStatsWithSplitsForPlayers(batterIds) : Promise.resolve({}),
    batterIds.length > 0 ? getPlateAppearancesByBatters(batterIds) : Promise.resolve([] as PlateAppearance[]),
  ]);

  const pasByBatter = new Map<string, PlateAppearance[]>();
  for (const pa of pasForBatters) {
    const list = pasByBatter.get(pa.batter_id) ?? [];
    list.push(pa);
    pasByBatter.set(pa.batter_id, list);
  }

  const sprayByPlayerId: Record<string, AnalystPlayerSpraySplits | null> = {};
  const disciplineExtraByPlayerId: Record<string, { strikePct: number | null; fpsPct: number | null }> = {};
  for (const p of batterRoster) {
    const pas = pasByBatter.get(p.id) ?? [];
    sprayByPlayerId[p.id] = buildAnalystPlayerSpraySplits(p, players, pas, []);
    const mix = pitchMixFromPlateAppearances(pas);
    disciplineExtraByPlayerId[p.id] = { strikePct: mix.strikePct, fpsPct: mix.firstPitchStrikePct };
  }

  const teamTrends = "error" in trendsRes ? { points: [], insights: ["Could not load team trends."] } : trendsRes;

  return (
    <ReportsHubClient
      games={games}
      batterRoster={batterRoster}
      statsByPlayerId={statsByPlayerId}
      sprayByPlayerId={sprayByPlayerId}
      disciplineExtraByPlayerId={disciplineExtraByPlayerId}
      teamTrendPoints={teamTrends.points}
      teamTrendInsights={teamTrends.insights}
      canEdit={canEdit}
    />
  );
}
