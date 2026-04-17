import { hasSupabase } from "@/lib/db/client";
import { getGames, getPlayers, getBattingStatsWithSplitsForPlayers } from "@/lib/db/queries";
import { isClubRosterPlayer, isPitcherPlayer } from "@/lib/opponentUtils";
import { fetchTeamTrendsPayload } from "@/app/reports/actions";
import { ReportsHubClient } from "./ReportsHubClient";

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
  const statsByPlayerId =
    batterIds.length > 0 ? await getBattingStatsWithSplitsForPlayers(batterIds) : {};

  const teamTrends = "error" in trendsRes ? { points: [], insights: ["Could not load team trends."] } : trendsRes;

  return (
    <ReportsHubClient
      games={games}
      batterRoster={batterRoster}
      statsByPlayerId={statsByPlayerId}
      teamTrendPoints={teamTrends.points}
      teamTrendInsights={teamTrends.insights}
      canEdit={canEdit}
    />
  );
}
