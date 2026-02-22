import { getGames, getGameLineup, getPlayersByIds, getBattingStatsWithSplitsForPlayers, getPlateAppearancesByBatters } from "@/lib/db/queries";
import { battingStatsFromPAs } from "@/lib/compute/battingStats";
import { trendFromRecentPAs } from "@/lib/compute/trends";
import { platoonFromSplits } from "@/lib/compute/platoon";
import { CoachTodayClient } from "./CoachTodayClient";

/**
 * Coach Today: real game + lineup from DB, with trend (hot/cold) and platoon (vs LHP/RHP).
 */
export const dynamic = "force-dynamic";

export default async function CoachTodayPage() {
  const games = await getGames();
  const game = games[0] ?? null;

  let gameInfo: Parameters<typeof CoachTodayClient>[0]["game"] = null;
  let recommendedLineup: Parameters<typeof CoachTodayClient>[0]["recommendedLineup"] = [];

  if (game) {
    const opponent =
      game.our_side === "home" ? game.away_team : game.home_team;
    const venue = game.our_side === "home" ? "Home" : "Away";
    gameInfo = {
      id: game.id,
      date: game.date,
      opponent,
      venue,
      venueType: game.our_side as "home" | "away",
    };

    const slots = await getGameLineup(game.id);
    if (slots.length > 0) {
      const playerIds = slots.map((s) => s.player_id);
      const [players, splits, allPAs] = await Promise.all([
        getPlayersByIds(playerIds),
        getBattingStatsWithSplitsForPlayers(playerIds),
        getPlateAppearancesByBatters(playerIds),
      ]);
      const playerMap = new Map(players.map((p) => [p.id, p]));
      const pasByBatter = new Map<string, import("@/lib/types").PlateAppearance[]>();
      for (const pa of allPAs) {
        const list = pasByBatter.get(pa.batter_id) ?? [];
        list.push(pa);
        pasByBatter.set(pa.batter_id, list);
      }
      recommendedLineup = slots
        .sort((a, b) => a.slot - b.slot)
        .map((s) => {
          const p = playerMap.get(s.player_id);
          const recentPAs = pasByBatter.get(s.player_id) ?? [];
          const playerSplits = splits[s.player_id];
          const trend = trendFromRecentPAs(recentPAs, 20);
          const platoon = playerSplits
            ? platoonFromSplits(playerSplits.vsL, playerSplits.vsR)
            : null;
          let recentStats: Parameters<typeof CoachTodayClient>[0]["recommendedLineup"][0]["recentStats"] = undefined;
          if ((trend === "hot" || trend === "cold") && recentPAs.length > 0) {
            const last15 = recentPAs.slice(0, 15);
            const stats = battingStatsFromPAs(last15);
            if (stats) {
              recentStats = {
                pa: stats.pa ?? 0,
                ab: stats.ab ?? 0,
                h: stats.h ?? 0,
                double: stats.double ?? 0,
                triple: stats.triple ?? 0,
                hr: stats.hr ?? 0,
                rbi: stats.rbi ?? 0,
                bb: (stats.bb ?? 0) + (stats.ibb ?? 0),
                so: stats.so ?? 0,
                avg: stats.avg ?? 0,
                ops: stats.ops ?? 0,
              };
            }
          }
          return {
            order: s.slot,
            playerId: s.player_id,
            playerName: p?.name ?? "—",
            position: s.position ?? p?.positions?.[0] ?? "—",
            bats: p?.bats ?? null,
            confidence: "medium" as const,
            tags: [] as ("POWER" | "CONTACT" | "SPEED" | "EYE" | "CLUTCH")[],
            trend,
            platoon,
            recentStats,
          };
        });
    }
  }

  return (
    <CoachTodayClient
      game={gameInfo}
      recommendedLineup={recommendedLineup}
      alerts={[]}
      matchupSummary={[]}
    />
  );
}
