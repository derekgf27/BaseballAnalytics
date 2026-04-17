import { battingStatsFromPAs } from "@/lib/compute/battingStats";
import { runsOnPaForLinescore } from "@/lib/compute/boxScore";
import { pasOurTeamBatting } from "@/lib/reports/postGameSnapshot";
import type { Game, PlateAppearance } from "@/lib/types";

export type TeamTrendPoint = {
  gameId: string;
  date: string;
  ops: number;
  kPct: number;
  runsScored: number;
};

export function buildTeamTrendSeries(gamesNewestFirst: Game[], allPas: PlateAppearance[]): TeamTrendPoint[] {
  const byGame = new Map<string, PlateAppearance[]>();
  for (const p of allPas) {
    const list = byGame.get(p.game_id) ?? [];
    list.push(p);
    byGame.set(p.game_id, list);
  }
  const chronological = [...gamesNewestFirst].reverse();
  return chronological.map((g) => {
    const gPas = byGame.get(g.id) ?? [];
    const our = pasOurTeamBatting(g, gPas);
    const s = battingStatsFromPAs(our);
    const runsScored = our.reduce((sum, p) => sum + runsOnPaForLinescore(p), 0);
    return {
      gameId: g.id,
      date: g.date,
      ops: s?.ops ?? 0,
      kPct: s?.kPct ?? 0,
      runsScored,
    };
  });
}
