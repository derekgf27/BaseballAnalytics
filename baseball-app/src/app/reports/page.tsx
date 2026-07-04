import { canMutateData } from "@/lib/demoMode";
import { getCachedGames, getCachedPlayers } from "@/lib/db/cachedQueries";
import { isClubRosterPlayer, isPitcherPlayer } from "@/lib/opponentUtils";
import { fetchTeamTrendsPayload } from "@/app/reports/actions";
import { ReportsHubClientGate } from "./ReportsHubClientGate";

export default async function ReportsPage() {
  const canEdit = canMutateData();
  const [games, players, trendsRes] = await Promise.all([
    getCachedGames(),
    getCachedPlayers(),
    fetchTeamTrendsPayload(12),
  ]);

  const roster = players.filter(isClubRosterPlayer).sort((a, b) => a.name.localeCompare(b.name));
  const batterRoster = roster.filter((p) => !isPitcherPlayer(p));

  const teamTrends = "error" in trendsRes ? { points: [], insights: ["Could not load team trends."] } : trendsRes;

  return (
    <ReportsHubClientGate
      games={games}
      batterRoster={batterRoster}
      teamTrendPoints={teamTrends.points}
      teamTrendInsights={teamTrends.insights}
      canEdit={canEdit}
    />
  );
}
