import { battingStatsFromPAs } from "@/lib/compute/battingStats";
import { fmtDecimalNoLeadingZero } from "@/lib/format";
import { pasOurTeamBatting } from "@/lib/reports/postGameSnapshot";
import type { Game, PAResult, PlateAppearance } from "@/lib/types";
import { assignPriority } from "../priority";
import type { Insight } from "../types";
import type { InsightsContext } from "../context";
import { clubBatterIds } from "../context";
import { flatOurBattingPas, metricsForWindow } from "../windows";

const HIT_RESULTS = new Set<PAResult>(["single", "double", "triple", "hr"]);
const REACH_RESULTS = new Set<PAResult>(["single", "double", "triple", "hr", "bb", "ibb", "hbp"]);

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function insight(partial: Omit<Insight, "priority"> & { magnitude?: number; isAlert?: boolean }): Insight {
  const { magnitude, isAlert, ...rest } = partial;
  return {
    ...rest,
    priority: assignPriority({ kind: rest.kind, confidence: rest.confidence, magnitude, isAlert }),
  };
}

function playerName(ctx: InsightsContext, id: string): string {
  return ctx.playersById.get(id)?.name ?? "Unknown";
}

function pasForPlayer(ctx: InsightsContext, playerId: string, games: Game[]): PlateAppearance[] {
  const gameIds = new Set(games.map((g) => g.id));
  return ctx.allPas.filter((p) => p.batter_id === playerId && gameIds.has(p.game_id));
}

/** Per-game: reached base at least once? */
function reachedBaseInGame(pas: PlateAppearance[]): boolean {
  return pas.some((p) => REACH_RESULTS.has(p.result));
}

function hitlessInGame(pas: PlateAppearance[]): boolean {
  const abResults = pas.filter((p) => !["bb", "ibb", "hbp", "sac_fly", "sac", "sac_bunt"].includes(p.result));
  if (abResults.length === 0) return false;
  return !pas.some((p) => HIT_RESULTS.has(p.result));
}

function gameStreaks(
  playerId: string,
  gamesChronological: Game[],
  allPas: PlateAppearance[]
): { reachBaseStreak: number; hitlessStreak: number } {
  let reachBaseStreak = 0;
  let hitlessStreak = 0;
  for (let i = gamesChronological.length - 1; i >= 0; i--) {
    const g = gamesChronological[i]!;
    const byGame = allPas.filter((p) => p.game_id === g.id && p.batter_id === playerId);
    const ourPas = pasOurTeamBatting(g, byGame);
    if (ourPas.length === 0) continue;
    if (reachedBaseInGame(ourPas)) {
      reachBaseStreak += 1;
    } else {
      break;
    }
  }
  for (let i = gamesChronological.length - 1; i >= 0; i--) {
    const g = gamesChronological[i]!;
    const byGame = allPas.filter((p) => p.game_id === g.id && p.batter_id === playerId);
    const ourPas = pasOurTeamBatting(g, byGame);
    if (ourPas.length === 0) continue;
    if (hitlessInGame(ourPas)) {
      hitlessStreak += 1;
    } else {
      break;
    }
  }
  return { reachBaseStreak, hitlessStreak };
}

export function runPlayerRules(ctx: InsightsContext): Insight[] {
  const insights: Insight[] = [];
  const games = ctx.gamesNewestFirst;
  if (games.length === 0) return insights;

  const chronological = [...games].reverse();
  const batterIds = ctx.playerIds?.length
    ? ctx.playerIds.filter((id) => clubBatterIds(ctx).has(id))
    : [...clubBatterIds(ctx)];

  const last3Games = games.slice(0, 3);
  const seasonMetrics = metricsForWindow(games, ctx.allPas, "season");

  for (const pid of batterIds) {
    const last3Pas = pasForPlayer(ctx, pid, last3Games);
    const seasonPas = pasForPlayer(ctx, pid, games);
    const recentStats = battingStatsFromPAs(last3Pas);
    const seasonStats = battingStatsFromPAs(seasonPas);

    if (recentStats && (recentStats.pa ?? 0) >= 6) {
      if (recentStats.ops >= 1.0) {
        insights.push(
          insight({
            id: `player.${pid}.hot_ops`,
            kind: "alert",
            category: "hitter",
            title: `${playerName(ctx, pid)}: OPS ${fmtDecimalNoLeadingZero(recentStats.ops, 3)} over the last ${last3Games.length} games (${recentStats.pa} PA).`,
            evidence: [{ label: "OPS", value: fmtDecimalNoLeadingZero(recentStats.ops, 3) }],
            confidence: (recentStats.pa ?? 0) >= 12 ? "high" : "medium",
            entityIds: { playerId: pid },
            isAlert: true,
            magnitude: recentStats.ops - 1,
          })
        );
      }
      if ((recentStats.kPct ?? 0) >= 0.4 && (recentStats.pa ?? 0) >= 8) {
        insights.push(
          insight({
            id: `player.${pid}.cold_k`,
            kind: "observation",
            category: "hitter",
            title: `${playerName(ctx, pid)}: ${pct(recentStats.kPct ?? 0)} strikeout rate over recent games.`,
            evidence: [{ label: "K%", value: pct(recentStats.kPct ?? 0) }],
            confidence: "medium",
            entityIds: { playerId: pid },
          })
        );
      }
    }

    if (seasonStats && recentStats && (seasonStats.pa ?? 0) >= 15 && (recentStats.pa ?? 0) >= 6) {
      const d = recentStats.ops - seasonStats.ops;
      if (d >= 0.12) {
        insights.push(
          insight({
            id: `player.${pid}.hot_vs_season`,
            kind: "observation",
            category: "hitter",
            title: `${playerName(ctx, pid)} is heating up — recent OPS ${fmtDecimalNoLeadingZero(recentStats.ops, 3)} vs ${fmtDecimalNoLeadingZero(seasonStats.ops, 3)} season.`,
            trend: "up",
            evidence: [
              { label: "Recent OPS", value: fmtDecimalNoLeadingZero(recentStats.ops, 3) },
              { label: "Season OPS", value: fmtDecimalNoLeadingZero(seasonStats.ops, 3) },
            ],
            confidence: "medium",
            entityIds: { playerId: pid },
            magnitude: d,
          })
        );
      } else if (d <= -0.12) {
        insights.push(
          insight({
            id: `player.${pid}.cold_vs_season`,
            kind: "observation",
            category: "hitter",
            title: `${playerName(ctx, pid)} is cooling off — recent OPS ${fmtDecimalNoLeadingZero(recentStats.ops, 3)} vs ${fmtDecimalNoLeadingZero(seasonStats.ops, 3)} season.`,
            trend: "down",
            evidence: [
              { label: "Recent OPS", value: fmtDecimalNoLeadingZero(recentStats.ops, 3) },
              { label: "Season OPS", value: fmtDecimalNoLeadingZero(seasonStats.ops, 3) },
            ],
            confidence: "medium",
            entityIds: { playerId: pid },
            magnitude: Math.abs(d),
          })
        );
      }
    }

    const { reachBaseStreak, hitlessStreak } = gameStreaks(pid, chronological, ctx.allPas);
    if (reachBaseStreak >= 4) {
      insights.push(
        insight({
          id: `player.${pid}.reach_streak`,
          kind: "observation",
          category: "hitter",
          title: `${playerName(ctx, pid)} has reached base in ${reachBaseStreak} consecutive games.`,
          evidence: [{ label: "Games", value: String(reachBaseStreak) }],
          confidence: reachBaseStreak >= 6 ? "high" : "medium",
          entityIds: { playerId: pid },
        })
      );
    }
    if (hitlessStreak >= 3) {
      const recentPas = pasForPlayer(ctx, pid, games.slice(0, hitlessStreak));
      const hits = recentPas.filter((p) => HIT_RESULTS.has(p.result)).length;
      const ab = recentPas.filter(
        (p) => !["bb", "ibb", "hbp", "sac_fly", "sac", "sac_bunt"].includes(p.result)
      ).length;
      insights.push(
        insight({
          id: `player.${pid}.hitless_streak`,
          kind: "alert",
          category: "hitter",
          title: `${playerName(ctx, pid)} is ${hits}-for-${Math.max(ab, recentPas.length)} over the last ${hitlessStreak} games.`,
          evidence: [{ label: "Hitless games", value: String(hitlessStreak) }],
          confidence: "medium",
          entityIds: { playerId: pid },
          isAlert: true,
        })
      );
    }
  }

  void seasonMetrics;
  void flatOurBattingPas;
  return insights;
}

export function playerInsightsForReport(ctx: InsightsContext): {
  hot: Array<{ playerId: string; name: string; line: string }>;
  cold: Array<{ playerId: string; name: string; line: string }>;
} {
  const playerRules = runPlayerRules(ctx);
  const hot: Array<{ playerId: string; name: string; line: string }> = [];
  const cold: Array<{ playerId: string; name: string; line: string }> = [];
  const seenHot = new Set<string>();
  const seenCold = new Set<string>();
  for (const ins of playerRules) {
    const playerId = ins.entityIds?.playerId;
    if (!playerId) continue;
    const name = playerName(ctx, playerId);
    const line = ins.title.replace(`${name}: `, "").replace(`${name} `, "");
    if (ins.trend === "up" || ins.id.includes("hot")) {
      if (seenHot.has(playerId)) continue;
      seenHot.add(playerId);
      hot.push({ playerId, name, line });
    } else if (ins.trend === "down" || ins.id.includes("cold") || ins.id.includes("hitless")) {
      if (seenCold.has(playerId)) continue;
      seenCold.add(playerId);
      cold.push({ playerId, name, line });
    }
  }
  return { hot: hot.slice(0, 4), cold: cold.slice(0, 4) };
}
