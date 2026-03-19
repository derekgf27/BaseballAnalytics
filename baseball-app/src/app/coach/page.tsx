import { getGames, getGameLineup, getPlayersByIds, getBattingStatsWithSplitsForPlayers, getPlateAppearancesByBatters } from "@/lib/db/queries";
import { battingStatsFromPAs } from "@/lib/compute/battingStats";
import { trendFromRecentPAs } from "@/lib/compute/trends";
import { platoonFromSplits } from "@/lib/compute/platoon";
import { CoachTodayClient } from "./CoachTodayClient";

/**
 * Coach Today: real game + lineup from DB, with trend (hot/cold) and platoon (vs LHP/RHP).
 */
export const dynamic = "force-dynamic";
// Demo presentation mode: force a visible hot/cold mix in lineup intelligence.
const DEMO_FORCE_TRENDS = true;

export default async function CoachPage() {
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
            const last20 = recentPAs.slice(0, 20);
            const stats = battingStatsFromPAs(last20);
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

      if (DEMO_FORCE_TRENDS && recommendedLineup.length > 0) {
        // Keep it deterministic for demos: first two hot, next two cold, rest neutral.
        recommendedLineup = recommendedLineup.map((slot, idx) => {
          if (idx < 2) {
            return {
              ...slot,
              trend: "hot" as const,
              recentStats: {
                pa: 20,
                ab: 17,
                h: 8,
                double: 2,
                triple: 0,
                hr: 1,
                rbi: 5,
                bb: 3,
                so: 3,
                avg: 0.471,
                ops: 1.08,
              },
            };
          }
          if (idx < 4) {
            return {
              ...slot,
              trend: "cold" as const,
              recentStats: {
                pa: 20,
                ab: 18,
                h: 3,
                double: 0,
                triple: 0,
                hr: 0,
                rbi: 1,
                bb: 2,
                so: 7,
                avg: 0.167,
                ops: 0.49,
              },
            };
          }
          return slot;
        });
      }
    }
  }

  return (
    <CoachTodayClient
      game={gameInfo}
      recommendedLineup={recommendedLineup}
    />
  );
}
