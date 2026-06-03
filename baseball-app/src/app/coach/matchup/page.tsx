import { getCachedGames } from "@/lib/db/cachedQueries";
import { pickCoachDashboardGame, sortGamesForCoachSelect } from "@/lib/coachGamePick";
import { fetchTeamTrendsPayload } from "@/app/reports/actions";
import { CoachMatchupClientGate } from "./CoachMatchupClientGate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CoachMatchupPage({
  searchParams,
}: {
  searchParams: Promise<{ gameId?: string }>;
}) {
  const sp = await searchParams;
  const [games, trendsRes] = await Promise.all([getCachedGames(), fetchTeamTrendsPayload(12)]);

  const sortedGames = sortGamesForCoachSelect(games);
  const defaultGame = pickCoachDashboardGame(games);
  const requestedId = sp.gameId?.trim();
  const initialGameId =
    requestedId && games.some((g) => g.id === requestedId)
      ? requestedId
      : (defaultGame?.id ?? sortedGames[0]?.id ?? null);

  const teamTrendInsights =
    "error" in trendsRes ? ["Could not load team trends."] : trendsRes.insights;

  return (
    <CoachMatchupClientGate
      games={sortedGames}
      initialGameId={initialGameId}
      teamTrendInsights={teamTrendInsights}
    />
  );
}
