import { battingStatsFromPAs, isRisp } from "@/lib/compute/battingStats";
import { pasOurTeamBatting } from "@/lib/reports/postGameSnapshot";
import type { Game, PlateAppearance } from "@/lib/types";
import type { TrendDirection } from "./types";

export type GameWindow = "last_game" | "last_3" | "last_5" | "season";

export type OffenseWindowMetrics = {
  games: number;
  pa: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  kPct: number;
  bbPct: number;
  rispAvg: number | null;
  rispPa: number;
  rispOps: number | null;
};

export function flatOurBattingPas(gamesChronological: Game[], allPas: PlateAppearance[]): PlateAppearance[] {
  const byGame = new Map<string, PlateAppearance[]>();
  for (const p of allPas) {
    const list = byGame.get(p.game_id) ?? [];
    list.push(p);
    byGame.set(p.game_id, list);
  }
  const out: PlateAppearance[] = [];
  for (const g of gamesChronological) {
    const chunk = byGame.get(g.id);
    if (chunk?.length) out.push(...pasOurTeamBatting(g, chunk));
  }
  return out;
}

export function offenseMetricsFromPas(pas: PlateAppearance[]): OffenseWindowMetrics | null {
  if (pas.length === 0) return null;
  const s = battingStatsFromPAs(pas);
  if (!s) return null;
  const rispPas = pas.filter((p) => isRisp(p.base_state));
  const rispStats = rispPas.length > 0 ? battingStatsFromPAs(rispPas) : null;
  return {
    games: 0,
    pa: s.pa ?? pas.length,
    avg: s.avg,
    obp: s.obp,
    slg: s.slg,
    ops: s.ops,
    kPct: s.kPct ?? 0,
    bbPct: s.bbPct ?? 0,
    rispAvg: rispStats && (rispStats.ab ?? 0) >= 1 ? rispStats.avg : null,
    rispPa: rispStats?.pa ?? rispPas.length,
    rispOps: rispStats && (rispStats.pa ?? 0) >= 1 ? rispStats.ops : null,
  };
}

export function sliceGamesNewestFirst(gamesNewestFirst: Game[], window: GameWindow): Game[] {
  if (window === "last_game") return gamesNewestFirst.slice(0, 1);
  if (window === "last_3") return gamesNewestFirst.slice(0, 3);
  if (window === "last_5") return gamesNewestFirst.slice(0, 5);
  return gamesNewestFirst;
}

export function metricsForWindow(
  gamesNewestFirst: Game[],
  allPas: PlateAppearance[],
  window: GameWindow
): OffenseWindowMetrics | null {
  const slice = sliceGamesNewestFirst(gamesNewestFirst, window);
  if (slice.length === 0) return null;
  const chronological = [...slice].reverse();
  const pas = flatOurBattingPas(chronological, allPas);
  const m = offenseMetricsFromPas(pas);
  if (!m) return null;
  return { ...m, games: slice.length };
}

export function compareMetricDelta(
  current: number | null | undefined,
  baseline: number | null | undefined,
  threshold: number
): TrendDirection {
  if (current == null || baseline == null || !Number.isFinite(current) || !Number.isFinite(baseline)) {
    return "stable";
  }
  const d = current - baseline;
  if (d > threshold) return "up";
  if (d < -threshold) return "down";
  return "stable";
}
