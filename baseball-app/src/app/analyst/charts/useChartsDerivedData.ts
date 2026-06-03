"use client";

import { useMemo } from "react";
import { battingStatsFromPAs, isRisp } from "@/lib/compute/battingStats";
import {
  CHARTS_SAMPLE_WARNING_BIP,
  CHARTS_SAMPLE_WARNING_PA,
} from "./chartTypes";
import {
  SPRAY_CHART_HIT_RESULTS,
  SPRAY_CHART_OUT_RESULTS,
} from "@/lib/sprayChartFilters";
import type { HitDirection, PlateAppearance, Player } from "@/lib/types";
import type { Game } from "@/lib/types";
import type { ChartPaRow, ChartUrlFilters, LeaderSortKey, SprayChartRow } from "./chartTypes";
import {
  bbPerKRatio,
  effectiveBatterHand,
  filterChartPasRows,
  filterSprayValidated,
  summarizeBattedBallCoverage,
} from "./chartsFilters";

const objectiveStrikeoutResults = new Set(["so", "so_looking"]);
const objectiveWalkResults = new Set(["bb", "ibb"]);
const objectiveHitResults = new Set(["single", "double", "triple", "hr"]);
const objectiveAbResults = new Set([
  "single",
  "double",
  "triple",
  "hr",
  "out",
  "foul_out",
  "so",
  "so_looking",
  "fielders_choice",
  "gidp",
  "reached_on_error",
  "other",
]);

export type PlayerLeaderRow = {
  playerId: string;
  name: string;
  pa: number;
  hits: number;
  avg: number;
  ops: number | null;
  kPct: number;
  bbPct: number;
};

export type ChartsDerivedData = {
  opponents: string[];
  filteredBatterSprayPAs: ReturnType<typeof filterSprayValidated>;
  filteredPitchingSprayPAs: ReturnType<typeof filterSprayValidated>;
  filteredChartPas: ChartPaRow[];
  chartsEmpty: boolean;
  snapshotSmallSample: boolean;
  rhb: { pas: ReturnType<typeof filterSprayValidated>; data: { hit_direction: HitDirection }[]; hits: number; outs: number };
  lhb: { pas: ReturnType<typeof filterSprayValidated>; data: { hit_direction: HitDirection }[]; hits: number; outs: number };
  pitchingLhb: { pas: ReturnType<typeof filterSprayValidated>; data: { hit_direction: HitDirection }[]; hits: number; outs: number };
  pitchingRhb: { pas: ReturnType<typeof filterSprayValidated>; data: { hit_direction: HitDirection }[]; hits: number; outs: number };
  totalBatterBip: number;
  totalPitchingBip: number;
  totalBatterHitsOnBip: number;
  totalPitchingHitsOnBip: number;
  batterHitPct: number | null;
  pitchingHitPct: number | null;
  baselineBatterHitPct: number | null;
  baselinePitchingHitPct: number | null;
  teamKPct: number | null;
  teamBBPct: number | null;
  baselineKPct: number | null;
  teamBbPerK: number | null;
  baselineBbPerK: number | null;
  pitchOutcomeTotals: {
    totalPitches: number;
    totalStrikes: number;
    totalPaWithPitchCount: number;
    firstPitchOpportunities: number;
    firstPitchStrikes: number;
    strikeouts: number;
    walks: number;
  };
  baselinePitchTotals: typeof pitchOutcomeTotalsPlaceholder;
  strikePct: number | null;
  baselineStrikePct: number | null;
  battedBallCounts: { gb: number; ld: number; fb: number; iffb: number };
  battedBallTotal: number;
  battedBallContactBip: number;
  battedBallSmallSample: boolean;
  battedBallGbRate: number | null;
  rispPas: ChartPaRow[];
  rispHits: number;
  rispAb: number;
  lateObjectivePas: ChartPaRow[];
  lateObjectiveHits: number;
  lateObjectiveAb: number;
  playerObjectiveLeaders: PlayerLeaderRow[];
};

const pitchOutcomeTotalsPlaceholder = {
  totalPitches: 0,
  totalStrikes: 0,
  totalPaWithPitchCount: 0,
  firstPitchOpportunities: 0,
  firstPitchStrikes: 0,
  strikeouts: 0,
  walks: 0,
};

function sumPitchOutcomes(pas: ChartPaRow[]) {
  return pas.reduce(
    (acc, pa) => {
      const seen = pa.pitches_seen ?? 0;
      const strikes = pa.strikes_thrown ?? 0;
      if (seen > 0) {
        acc.totalPitches += seen;
        acc.totalStrikes += Math.max(0, Math.min(strikes, seen));
        acc.totalPaWithPitchCount += 1;
      }
      if (pa.first_pitch_strike != null) {
        acc.firstPitchOpportunities += 1;
        if (pa.first_pitch_strike) acc.firstPitchStrikes += 1;
      }
      if (objectiveStrikeoutResults.has(pa.result)) acc.strikeouts += 1;
      if (objectiveWalkResults.has(pa.result)) acc.walks += 1;
      return acc;
    },
    { ...pitchOutcomeTotalsPlaceholder }
  );
}

function splitSprayByHand(
  pas: ReturnType<typeof filterSprayValidated>,
  batsByPlayerId: Map<string, "L" | "R" | "S">,
  hand: "L" | "R"
) {
  const filtered = pas.filter((pa) => effectiveBatterHand(batsByPlayerId.get(pa.batter_id), pa.pitcher_hand) === hand);
  return {
    pas: filtered,
    data: filtered.map(({ hit_direction }) => ({ hit_direction })),
    hits: filtered.filter((pa) => SPRAY_CHART_HIT_RESULTS.has(pa.result)).length,
    outs: filtered.filter((pa) => SPRAY_CHART_OUT_RESULTS.has(pa.result)).length,
  };
}

export function useChartsDerivedData({
  sprayData,
  pitchingSprayData,
  chartPas,
  players,
  games,
  urlFilters,
  baselineContextFilters,
  leaderSort,
}: {
  sprayData: SprayChartRow[];
  pitchingSprayData: SprayChartRow[];
  chartPas: ChartPaRow[];
  players: Player[];
  games: Game[];
  urlFilters: ChartUrlFilters;
  baselineContextFilters: ChartUrlFilters;
  leaderSort: LeaderSortKey;
}): ChartsDerivedData {
  const batsByPlayerId = useMemo(() => {
    const map = new Map<string, "L" | "R" | "S">();
    players.forEach((p) => {
      const b = p.bats?.toUpperCase();
      if (b === "L" || b === "R" || b === "S") map.set(p.id, b as "L" | "R" | "S");
    });
    return map;
  }, [players]);

  const playerNameById = useMemo(() => new Map(players.map((p) => [p.id, p.name])), [players]);
  const gameById = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);

  const opponents = useMemo(() => {
    const set = new Set<string>();
    for (const game of games) {
      const opp = game.our_side === "home" ? game.away_team : game.home_team;
      if (opp) set.add(opp);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [games]);

  const filteredBatterSprayPAs = useMemo(
    () => filterSprayValidated(sprayData, gameById, urlFilters),
    [sprayData, gameById, urlFilters]
  );
  const filteredPitchingSprayPAs = useMemo(
    () => filterSprayValidated(pitchingSprayData, gameById, urlFilters),
    [pitchingSprayData, gameById, urlFilters]
  );
  const filteredChartPas = useMemo(
    () => filterChartPasRows(chartPas, gameById, urlFilters),
    [chartPas, gameById, urlFilters]
  );

  const baselineBatterSprayPAs = useMemo(
    () => filterSprayValidated(sprayData, gameById, baselineContextFilters),
    [sprayData, gameById, baselineContextFilters]
  );
  const baselinePitchingSprayPAs = useMemo(
    () => filterSprayValidated(pitchingSprayData, gameById, baselineContextFilters),
    [pitchingSprayData, gameById, baselineContextFilters]
  );
  const baselineChartPas = useMemo(
    () => filterChartPasRows(chartPas, gameById, baselineContextFilters),
    [chartPas, gameById, baselineContextFilters]
  );

  const rhb = useMemo(
    () => splitSprayByHand(filteredBatterSprayPAs, batsByPlayerId, "R"),
    [filteredBatterSprayPAs, batsByPlayerId]
  );
  const lhb = useMemo(
    () => splitSprayByHand(filteredBatterSprayPAs, batsByPlayerId, "L"),
    [filteredBatterSprayPAs, batsByPlayerId]
  );
  const pitchingLhb = useMemo(
    () => splitSprayByHand(filteredPitchingSprayPAs, batsByPlayerId, "L"),
    [filteredPitchingSprayPAs, batsByPlayerId]
  );
  const pitchingRhb = useMemo(
    () => splitSprayByHand(filteredPitchingSprayPAs, batsByPlayerId, "R"),
    [filteredPitchingSprayPAs, batsByPlayerId]
  );

  const totalBatterBip = filteredBatterSprayPAs.length;
  const totalPitchingBip = filteredPitchingSprayPAs.length;
  const totalBatterHitsOnBip = filteredBatterSprayPAs.filter((pa) => SPRAY_CHART_HIT_RESULTS.has(pa.result)).length;
  const totalPitchingHitsOnBip = filteredPitchingSprayPAs.filter((pa) => SPRAY_CHART_HIT_RESULTS.has(pa.result)).length;

  const batterHitPct = totalBatterBip > 0 ? totalBatterHitsOnBip / totalBatterBip : null;
  const pitchingHitPct = totalPitchingBip > 0 ? totalPitchingHitsOnBip / totalPitchingBip : null;
  const baselineBatterHitPct =
    baselineBatterSprayPAs.length > 0
      ? baselineBatterSprayPAs.filter((pa) => SPRAY_CHART_HIT_RESULTS.has(pa.result)).length / baselineBatterSprayPAs.length
      : null;
  const baselinePitchingHitPct =
    baselinePitchingSprayPAs.length > 0
      ? baselinePitchingSprayPAs.filter((pa) => SPRAY_CHART_HIT_RESULTS.has(pa.result)).length /
        baselinePitchingSprayPAs.length
      : null;

  const pitchOutcomeTotals = useMemo(() => sumPitchOutcomes(filteredChartPas), [filteredChartPas]);
  const baselinePitchTotals = useMemo(() => sumPitchOutcomes(baselineChartPas), [baselineChartPas]);

  const teamKPct = filteredChartPas.length > 0 ? pitchOutcomeTotals.strikeouts / filteredChartPas.length : null;
  const teamBBPct = filteredChartPas.length > 0 ? pitchOutcomeTotals.walks / filteredChartPas.length : null;
  const baselineKPct =
    baselineChartPas.length > 0 ? baselinePitchTotals.strikeouts / baselineChartPas.length : null;

  const teamBbPerK = bbPerKRatio(pitchOutcomeTotals.walks, pitchOutcomeTotals.strikeouts);
  const baselineBbPerK = bbPerKRatio(baselinePitchTotals.walks, baselinePitchTotals.strikeouts);

  const strikePct =
    pitchOutcomeTotals.totalPitches > 0 ? pitchOutcomeTotals.totalStrikes / pitchOutcomeTotals.totalPitches : null;
  const baselineStrikePct =
    baselinePitchTotals.totalPitches > 0 ? baselinePitchTotals.totalStrikes / baselinePitchTotals.totalPitches : null;

  const battedBallCounts = useMemo(
    () =>
      filteredChartPas.reduce(
        (acc, pa) => {
          if (pa.batted_ball_type === "ground_ball") acc.gb += 1;
          else if (pa.batted_ball_type === "line_drive") acc.ld += 1;
          else if (pa.batted_ball_type === "fly_ball") acc.fb += 1;
          else if (pa.batted_ball_type === "infield_fly") acc.iffb += 1;
          return acc;
        },
        { gb: 0, ld: 0, fb: 0, iffb: 0 }
      ),
    [filteredChartPas]
  );
  const battedBallTotal = battedBallCounts.gb + battedBallCounts.ld + battedBallCounts.fb + battedBallCounts.iffb;

  const battedBallCoverage = useMemo(
    () => summarizeBattedBallCoverage(filteredChartPas),
    [filteredChartPas]
  );
  const battedBallContactBip = battedBallCoverage.contactBip;
  const battedBallSmallSample = battedBallTotal > 0 && battedBallTotal < CHARTS_SAMPLE_WARNING_BIP;
  const battedBallGbRate = battedBallTotal > 0 ? battedBallCounts.gb / battedBallTotal : null;

  const rispPas = useMemo(() => filteredChartPas.filter((pa) => isRisp(pa.base_state)), [filteredChartPas]);
  const rispHits = rispPas.filter((pa) => objectiveHitResults.has(pa.result)).length;
  const rispAb = rispPas.filter((pa) => objectiveAbResults.has(pa.result)).length;
  const lateObjectivePas = useMemo(
    () => filteredChartPas.filter((pa) => (pa.inning ?? 0) >= 7),
    [filteredChartPas]
  );
  const lateObjectiveHits = lateObjectivePas.filter((pa) => objectiveHitResults.has(pa.result)).length;
  const lateObjectiveAb = lateObjectivePas.filter((pa) => objectiveAbResults.has(pa.result)).length;

  const playerObjectiveLeaders = useMemo(() => {
    const byPlayer = new Map<string, ChartPaRow[]>();
    for (const pa of filteredChartPas) {
      const list = byPlayer.get(pa.batter_id) ?? [];
      list.push(pa);
      byPlayer.set(pa.batter_id, list);
    }
    const rows: PlayerLeaderRow[] = [];
    for (const [playerId, pas] of byPlayer.entries()) {
      const stats = battingStatsFromPAs(pas as PlateAppearance[]);
      rows.push({
        playerId,
        name: playerNameById.get(playerId) ?? "Unknown",
        pa: pas.length,
        hits: stats?.h ?? 0,
        avg: stats?.avg ?? 0,
        ops: stats?.ops ?? null,
        kPct: stats?.kPct ?? 0,
        bbPct: stats?.bbPct ?? 0,
      });
    }
    const sortKey = leaderSort;
    rows.sort((a, b) => {
      if (sortKey === "ops") return (b.ops ?? -1) - (a.ops ?? -1) || b.pa - a.pa;
      if (sortKey === "avg") return b.avg - a.avg || b.pa - a.pa;
      return b.pa - a.pa;
    });
    return rows;
  }, [filteredChartPas, playerNameById, leaderSort]);

  const chartsEmpty =
    filteredBatterSprayPAs.length === 0 &&
    filteredPitchingSprayPAs.length === 0 &&
    filteredChartPas.length === 0;

  const snapshotSmallSample =
    filteredChartPas.length > 0 && filteredChartPas.length < CHARTS_SAMPLE_WARNING_PA;

  return {
    opponents,
    filteredBatterSprayPAs,
    filteredPitchingSprayPAs,
    filteredChartPas,
    chartsEmpty,
    snapshotSmallSample,
    rhb,
    lhb,
    pitchingLhb,
    pitchingRhb,
    totalBatterBip,
    totalPitchingBip,
    totalBatterHitsOnBip,
    totalPitchingHitsOnBip,
    batterHitPct,
    pitchingHitPct,
    baselineBatterHitPct,
    baselinePitchingHitPct,
    teamKPct,
    teamBBPct,
    baselineKPct,
    teamBbPerK,
    baselineBbPerK,
    pitchOutcomeTotals,
    baselinePitchTotals,
    strikePct,
    baselineStrikePct,
    battedBallCounts,
    battedBallTotal,
    battedBallContactBip,
    battedBallSmallSample,
    battedBallGbRate,
    rispPas,
    rispHits,
    rispAb,
    lateObjectivePas,
    lateObjectiveHits,
    lateObjectiveAb,
    playerObjectiveLeaders,
  };
}
