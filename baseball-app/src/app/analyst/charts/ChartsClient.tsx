"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { TeamSprayChart } from "@/components/analyst/TeamSprayChart";
import { isRisp } from "@/lib/compute/battingStats";
import type { HitDirection } from "@/lib/types";
import type { Game, Player } from "@/lib/types";
import {
  isValidSprayHitDirection,
  SPRAY_CHART_HIT_RESULTS,
  SPRAY_CHART_OUT_RESULTS,
  sprayResultMatchesFilter,
  type SprayResultFilterKey,
  parseSprayResultFilterKey,
} from "@/lib/sprayChartFilters";

type SprayChartRow = {
  game_id: string;
  batter_id: string;
  hit_direction: string;
  result: string;
  pitcher_hand: "L" | "R" | null;
  inning: number | null;
  base_state: string | null;
};

export interface ChartsClientProps {
  sprayData: SprayChartRow[];
  pitchingSprayData: SprayChartRow[];
  chartPas: {
    game_id: string;
    batter_id: string;
    result: string;
    inning: number | null;
    base_state: string | null;
    pitcher_hand: "L" | "R" | null;
    batted_ball_type: "ground_ball" | "line_drive" | "fly_ball" | "infield_fly" | null | undefined;
    pitches_seen: number | null;
    strikes_thrown: number | null;
    first_pitch_strike: boolean | null;
  }[];
  players: Player[];
  games: Game[];
}

type DateRangeKey = "season" | "last30" | "last7";
type InningBucketKey = "all" | "1-3" | "4-6" | "7+";
type PitchHandFilter = "all" | "L" | "R";

type ChartUrlFilters = {
  spray: SprayResultFilterKey;
  range: DateRangeKey;
  inning: InningBucketKey;
  opp: string;
  rispOnly: boolean;
  phand: PitchHandFilter;
};

function effectiveBatterHand(bats: "L" | "R" | "S" | undefined, pitcherHand: "L" | "R" | null): "L" | "R" | null {
  if (bats === "L" || bats === "R") return bats;
  if (bats === "S") {
    if (pitcherHand === "L") return "R";
    if (pitcherHand === "R") return "L";
    return null;
  }
  return null;
}

function parseDateRangeKey(raw: string | null): DateRangeKey {
  return raw === "last30" || raw === "last7" ? raw : "season";
}

function parseInningBucket(raw: string | null): InningBucketKey {
  return raw === "1-3" || raw === "4-6" || raw === "7+" ? raw : "all";
}

function parsePitchHand(raw: string | null): PitchHandFilter {
  return raw === "L" || raw === "R" ? raw : "all";
}

function inInningBucket(inning: number | null, bucket: InningBucketKey): boolean {
  if (bucket === "all") return true;
  if (inning == null) return false;
  if (bucket === "1-3") return inning >= 1 && inning <= 3;
  if (bucket === "4-6") return inning >= 4 && inning <= 6;
  return inning >= 7;
}

function cutoffForRange(range: DateRangeKey): Date | null {
  if (range === "season") return null;
  const now = new Date();
  now.setDate(now.getDate() - (range === "last7" ? 7 : 30));
  return now;
}

function gamePassesDate(game: Game, cutoff: Date | null): boolean {
  if (cutoff == null || !game.date) return true;
  const d = new Date(game.date);
  return !Number.isNaN(d.getTime()) && d >= cutoff;
}

function gamePassesOpp(game: Game, opp: string): boolean {
  if (opp === "all") return true;
  const gOpp = game.our_side === "home" ? game.away_team : game.home_team;
  return gOpp === opp;
}

function stripDefaultSearchParams(sp: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(sp.toString());
  if (!next.has("spray") || next.get("spray") === "both") next.delete("spray");
  if (!next.has("range") || next.get("range") === "season") next.delete("range");
  if (!next.has("inning") || next.get("inning") === "all") next.delete("inning");
  if (!next.has("opp") || next.get("opp") === "all") next.delete("opp");
  if (next.get("risp") !== "1") next.delete("risp");
  if (!next.has("phand") || next.get("phand") === "all") next.delete("phand");
  return next;
}

function formatPtsDelta(currentRate: number | null, baselineRate: number | null): string | null {
  if (currentRate == null || baselineRate == null) return null;
  const d = (currentRate - baselineRate) * 100;
  if (Math.abs(d) < 0.05) return "0.0 pts";
  return `${d >= 0 ? "+" : ""}${d.toFixed(1)} pts`;
}

function filterSprayValidated(
  rows: SprayChartRow[],
  gameById: Map<string, Game>,
  f: ChartUrlFilters
): { game_id: string; batter_id: string; hit_direction: HitDirection; result: string; pitcher_hand: "L" | "R" | null; inning: number | null; base_state: string | null }[] {
  const cutoff = cutoffForRange(f.range);
  return rows.filter(
    (pa): pa is SprayChartRow & { hit_direction: HitDirection } => {
      if (!isValidSprayHitDirection(pa.hit_direction)) return false;
      if (!sprayResultMatchesFilter(pa.result, f.spray)) return false;
      if (!inInningBucket(pa.inning, f.inning)) return false;
      if (f.rispOnly && !isRisp(pa.base_state)) return false;
      if (f.phand !== "all" && pa.pitcher_hand !== f.phand) return false;
      const game = gameById.get(pa.game_id);
      if (!game) return false;
      if (!gamePassesOpp(game, f.opp)) return false;
      if (!gamePassesDate(game, cutoff)) return false;
      return true;
    }
  );
}

function filterChartPasRows(
  rows: ChartsClientProps["chartPas"],
  gameById: Map<string, Game>,
  f: ChartUrlFilters
): ChartsClientProps["chartPas"] {
  const cutoff = cutoffForRange(f.range);
  return rows.filter((pa) => {
    if (!inInningBucket(pa.inning, f.inning)) return false;
    if (f.rispOnly && !isRisp(pa.base_state)) return false;
    if (f.phand !== "all" && pa.pitcher_hand !== f.phand) return false;
    const game = gameById.get(pa.game_id);
    if (!game) return false;
    if (!gamePassesOpp(game, f.opp)) return false;
    if (!gamePassesDate(game, cutoff)) return false;
    return true;
  });
}

export function ChartsClient({ sprayData, pitchingSprayData, chartPas, players, games }: ChartsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlFilters: ChartUrlFilters = useMemo(
    () => ({
      spray: parseSprayResultFilterKey(searchParams.get("spray")),
      range: parseDateRangeKey(searchParams.get("range")),
      inning: parseInningBucket(searchParams.get("inning")),
      opp: searchParams.get("opp") ?? "all",
      rispOnly: searchParams.get("risp") === "1",
      phand: parsePitchHand(searchParams.get("phand")),
    }),
    [searchParams]
  );

  const baselineContextFilters: ChartUrlFilters = useMemo(
    () => ({
      spray: urlFilters.spray,
      range: "season",
      inning: "all",
      opp: "all",
      rispOnly: false,
      phand: "all",
    }),
    [urlFilters.spray]
  );

  const pushSearch = useCallback(
    (next: URLSearchParams) => {
      const cleaned = stripDefaultSearchParams(next);
      const qs = cleaned.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  const setManyParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === "") sp.delete(k);
        else sp.set(k, v);
      }
      pushSearch(sp);
    },
    [pushSearch, searchParams]
  );

  const resetFilters = useCallback(() => {
    pushSearch(new URLSearchParams());
  }, [pushSearch]);

  const [leaderCap, setLeaderCap] = useState(6);

  const exportToPdf = useCallback(() => {
    window.print();
  }, []);

  const batsByPlayerId = new Map<string, "L" | "R" | "S">();
  players.forEach((p) => {
    const b = p.bats?.toUpperCase();
    if (b === "L" || b === "R" || b === "S") batsByPlayerId.set(p.id, b as "L" | "R" | "S");
  });
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

  const rhbPAs = filteredBatterSprayPAs.filter((pa) => {
    const bats = batsByPlayerId.get(pa.batter_id);
    return effectiveBatterHand(bats, pa.pitcher_hand) === "R";
  });
  const rhbData: { hit_direction: HitDirection }[] = rhbPAs.map(({ hit_direction }) => ({ hit_direction }));
  const rhbHits = rhbPAs.filter((pa) => SPRAY_CHART_HIT_RESULTS.has(pa.result)).length;
  const rhbOuts = rhbPAs.filter((pa) => SPRAY_CHART_OUT_RESULTS.has(pa.result)).length;

  const lhbPAs = filteredBatterSprayPAs.filter((pa) => {
    const bats = batsByPlayerId.get(pa.batter_id);
    return effectiveBatterHand(bats, pa.pitcher_hand) === "L";
  });
  const lhbData: { hit_direction: HitDirection }[] = lhbPAs.map(({ hit_direction }) => ({ hit_direction }));
  const lhbHits = lhbPAs.filter((pa) => SPRAY_CHART_HIT_RESULTS.has(pa.result)).length;
  const lhbOuts = lhbPAs.filter((pa) => SPRAY_CHART_OUT_RESULTS.has(pa.result)).length;

  const pitchingLhbPAs = filteredPitchingSprayPAs.filter((pa) => {
    const bats = batsByPlayerId.get(pa.batter_id);
    return effectiveBatterHand(bats, pa.pitcher_hand) === "L";
  });
  const pitchingVsLhbData: { hit_direction: HitDirection }[] = pitchingLhbPAs.map(({ hit_direction }) => ({
    hit_direction,
  }));
  const pitchingLhbHits = pitchingLhbPAs.filter((pa) => SPRAY_CHART_HIT_RESULTS.has(pa.result)).length;
  const pitchingLhbOuts = pitchingLhbPAs.filter((pa) => SPRAY_CHART_OUT_RESULTS.has(pa.result)).length;

  const pitchingRhbPAs = filteredPitchingSprayPAs.filter((pa) => {
    const bats = batsByPlayerId.get(pa.batter_id);
    return effectiveBatterHand(bats, pa.pitcher_hand) === "R";
  });
  const pitchingVsRhbData: { hit_direction: HitDirection }[] = pitchingRhbPAs.map(({ hit_direction }) => ({
    hit_direction,
  }));
  const pitchingRhbHits = pitchingRhbPAs.filter((pa) => SPRAY_CHART_HIT_RESULTS.has(pa.result)).length;
  const pitchingRhbOuts = pitchingRhbPAs.filter((pa) => SPRAY_CHART_OUT_RESULTS.has(pa.result)).length;

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

  const sampleWarning = 25;
  const objectiveHitResults = new Set(["single", "double", "triple", "hr"]);
  const objectiveStrikeoutResults = new Set(["so", "so_looking"]);
  const objectiveWalkResults = new Set(["bb", "ibb"]);
  const objectiveAbResults = new Set([
    "single",
    "double",
    "triple",
    "hr",
    "out",
    "so",
    "so_looking",
    "fielders_choice",
    "gidp",
    "reached_on_error",
    "other",
  ]);

  const battedBallCounts = filteredChartPas.reduce(
    (acc, pa) => {
      if (pa.batted_ball_type === "ground_ball") acc.gb += 1;
      else if (pa.batted_ball_type === "line_drive") acc.ld += 1;
      else if (pa.batted_ball_type === "fly_ball") acc.fb += 1;
      else if (pa.batted_ball_type === "infield_fly") acc.iffb += 1;
      return acc;
    },
    { gb: 0, ld: 0, fb: 0, iffb: 0 }
  );
  const battedBallTotal = battedBallCounts.gb + battedBallCounts.ld + battedBallCounts.fb + battedBallCounts.iffb;

  const pitchOutcomeTotals = filteredChartPas.reduce(
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
    {
      totalPitches: 0,
      totalStrikes: 0,
      totalPaWithPitchCount: 0,
      firstPitchOpportunities: 0,
      firstPitchStrikes: 0,
      strikeouts: 0,
      walks: 0,
    }
  );

  const baselineChartPas = useMemo(
    () => filterChartPasRows(chartPas, gameById, baselineContextFilters),
    [chartPas, gameById, baselineContextFilters]
  );
  const baselinePitchTotals = baselineChartPas.reduce(
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
    {
      totalPitches: 0,
      totalStrikes: 0,
      totalPaWithPitchCount: 0,
      firstPitchOpportunities: 0,
      firstPitchStrikes: 0,
      strikeouts: 0,
      walks: 0,
    }
  );

  const strikePct =
    pitchOutcomeTotals.totalPitches > 0 ? pitchOutcomeTotals.totalStrikes / pitchOutcomeTotals.totalPitches : null;
  const baselineStrikePct =
    baselinePitchTotals.totalPitches > 0 ? baselinePitchTotals.totalStrikes / baselinePitchTotals.totalPitches : null;
  const kPct = filteredChartPas.length > 0 ? pitchOutcomeTotals.strikeouts / filteredChartPas.length : null;
  const baselineKPct =
    baselineChartPas.length > 0 ? baselinePitchTotals.strikeouts / baselineChartPas.length : null;

  const rispPas = filteredChartPas.filter((pa) => isRisp(pa.base_state));
  const rispHits = rispPas.filter((pa) => objectiveHitResults.has(pa.result)).length;
  const rispAb = rispPas.filter((pa) => objectiveAbResults.has(pa.result)).length;
  const lateObjectivePas = filteredChartPas.filter((pa) => (pa.inning ?? 0) >= 7);
  const lateObjectiveHits = lateObjectivePas.filter((pa) => objectiveHitResults.has(pa.result)).length;
  const lateObjectiveAb = lateObjectivePas.filter((pa) => objectiveAbResults.has(pa.result)).length;

  const playerObjectiveLeaders = useMemo(() => {
    const map = new Map<
      string,
      { pa: number; ab: number; h: number; so: number; bb: number; fpsOpp: number; fps: number; pitches: number; strikes: number }
    >();
    for (const pa of filteredChartPas) {
      const cur = map.get(pa.batter_id) ?? { pa: 0, ab: 0, h: 0, so: 0, bb: 0, fpsOpp: 0, fps: 0, pitches: 0, strikes: 0 };
      cur.pa += 1;
      if (objectiveAbResults.has(pa.result)) cur.ab += 1;
      if (objectiveHitResults.has(pa.result)) cur.h += 1;
      if (objectiveStrikeoutResults.has(pa.result)) cur.so += 1;
      if (objectiveWalkResults.has(pa.result)) cur.bb += 1;
      if (pa.first_pitch_strike != null) {
        cur.fpsOpp += 1;
        if (pa.first_pitch_strike) cur.fps += 1;
      }
      const seen = pa.pitches_seen ?? 0;
      const strikes = pa.strikes_thrown ?? 0;
      if (seen > 0) {
        cur.pitches += seen;
        cur.strikes += Math.max(0, Math.min(strikes, seen));
      }
      map.set(pa.batter_id, cur);
    }
    return [...map.entries()]
      .map(([playerId, s]) => ({
        playerId,
        name: playerNameById.get(playerId) ?? "Unknown",
        pa: s.pa,
        avg: s.ab > 0 ? s.h / s.ab : 0,
        kPct: s.pa > 0 ? s.so / s.pa : 0,
        bbPct: s.pa > 0 ? s.bb / s.pa : 0,
        fpsPct: s.fpsOpp > 0 ? s.fps / s.fpsOpp : 0,
      }))
      .sort((a, b) => b.pa - a.pa);
  }, [filteredChartPas, playerNameById]);

  useEffect(() => {
    setLeaderCap(6);
  }, [urlFilters, searchParams]);

  const chartsEmpty =
    filteredBatterSprayPAs.length === 0 &&
    filteredPitchingSprayPAs.length === 0 &&
    filteredChartPas.length === 0;

  const selectFocusClass =
    "rounded border border-[var(--border)] bg-[var(--bg-base)] px-1.5 py-1 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40";

  return (
    <div className="charts-page space-y-8">
      <div className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-base)]/92 py-3 backdrop-blur-md print:static print:border-0 print:bg-transparent print:backdrop-blur-none">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--text)] md:text-3xl">Charts</h1>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">Filters sync to the URL for sharing.</p>
          </div>
          <div className="charts-print-hide print:hidden">
            <button
              type="button"
              onClick={exportToPdf}
              className="rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-[var(--neo-accent)] transition hover:border-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
            >
              Export to PDF
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
          <div className="flex flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
            <label htmlFor="charts-filter-spray" className="font-display text-[10px] uppercase tracking-wider text-[var(--neo-accent)]">
              Result
            </label>
            <select
              id="charts-filter-spray"
              value={urlFilters.spray}
              onChange={(e) => {
                const v = e.target.value as SprayResultFilterKey;
                setManyParams({ spray: v === "both" ? null : v });
              }}
              className={selectFocusClass}
            >
              <option value="hits">Hits</option>
              <option value="outs">Outs</option>
              <option value="both">Hits + Outs</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
            <label htmlFor="charts-filter-range" className="font-display text-[10px] uppercase tracking-wider text-[var(--neo-accent)]">
              Range
            </label>
            <select
              id="charts-filter-range"
              value={urlFilters.range}
              onChange={(e) => {
                const v = e.target.value as DateRangeKey;
                setManyParams({ range: v === "season" ? null : v });
              }}
              className={selectFocusClass}
            >
              <option value="season">Season</option>
              <option value="last30">Last 30</option>
              <option value="last7">Last 7</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
            <label htmlFor="charts-filter-inning" className="font-display text-[10px] uppercase tracking-wider text-[var(--neo-accent)]">
              Inning
            </label>
            <select
              id="charts-filter-inning"
              value={urlFilters.inning}
              onChange={(e) => {
                const v = e.target.value as InningBucketKey;
                setManyParams({ inning: v === "all" ? null : v });
              }}
              className={selectFocusClass}
            >
              <option value="all">All</option>
              <option value="1-3">1-3</option>
              <option value="4-6">4-6</option>
              <option value="7+">7+</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
            <label htmlFor="charts-filter-opp" className="font-display text-[10px] uppercase tracking-wider text-[var(--neo-accent)]">
              Opponent
            </label>
            <select
              id="charts-filter-opp"
              value={urlFilters.opp}
              onChange={(e) => setManyParams({ opp: e.target.value === "all" ? null : e.target.value })}
              className={selectFocusClass}
            >
              <option value="all">All</option>
              {opponents.map((opp) => (
                <option key={opp} value={opp}>
                  {opp}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
            <label htmlFor="charts-filter-phand" className="font-display text-[10px] uppercase tracking-wider text-[var(--neo-accent)]">
              Pitcher
            </label>
            <select
              id="charts-filter-phand"
              value={urlFilters.phand}
              onChange={(e) =>
                setManyParams({ phand: e.target.value === "all" ? null : (e.target.value as PitchHandFilter) })
              }
              className={selectFocusClass}
            >
              <option value="all">All</option>
              <option value="L">LHP</option>
              <option value="R">RHP</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
            <span className="font-display text-[10px] uppercase tracking-wider text-[var(--neo-accent)]">RISP</span>
            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[var(--text)]">
              <input
                type="checkbox"
                checked={urlFilters.rispOnly}
                onChange={(e) => setManyParams({ risp: e.target.checked ? "1" : null })}
                className="rounded border-[var(--border)] text-[var(--neo-accent)] focus:ring-[var(--accent)]"
              />
              Runners 2nd/3rd
            </label>
          </div>
        </div>
      </div>

      {chartsEmpty ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-6 py-12 text-center">
          <p className="font-display text-sm font-semibold text-[var(--text)]">No data for this filter</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Try widening the date range, clearing RISP or pitcher filters, or resetting all filters.
          </p>
          <button
            type="button"
            className="mt-4 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--neo-accent)] hover:border-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
            onClick={resetFilters}
          >
            Reset filters
          </button>
        </div>
      ) : null}

      {!chartsEmpty && (
        <>
          <div id="charts-kpis" className="grid gap-3 scroll-mt-28 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-[inset_0_0_0_1px_rgba(255,204,0,.16)]">
              <div className="text-[10px] uppercase tracking-wider text-[var(--neo-accent)]">Batter BIP</div>
              <div className="mt-1 text-xl font-semibold text-[var(--neo-accent)] tabular-nums">{totalBatterBip}</div>
              <p className="mt-1 text-[10px] text-[var(--text-faint)]">Balls in play in filter</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-[inset_0_0_0_1px_rgba(255,204,0,.16)]">
              <div className="text-[10px] uppercase tracking-wider text-[var(--neo-accent)]">Batter Hit%</div>
              <div className="mt-1 text-xl font-semibold text-[var(--neo-accent)] tabular-nums">
                {totalBatterBip > 0 ? `${((totalBatterHitsOnBip / totalBatterBip) * 100).toFixed(1)}%` : "—"}
              </div>
              {formatPtsDelta(batterHitPct, baselineBatterHitPct) && (
                <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                  Δ {formatPtsDelta(batterHitPct, baselineBatterHitPct)} vs season (same spray filter)
                </p>
              )}
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-[inset_0_0_0_1px_rgba(255,204,0,.16)]">
              <div className="text-[10px] uppercase tracking-wider text-[var(--neo-accent)]">Pitching BIP Allowed</div>
              <div className="mt-1 text-xl font-semibold text-[var(--neo-accent)] tabular-nums">{totalPitchingBip}</div>
              <p className="mt-1 text-[10px] text-[var(--text-faint)]">Balls in play in filter</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-[inset_0_0_0_1px_rgba(255,204,0,.16)]">
              <div className="text-[10px] uppercase tracking-wider text-[var(--neo-accent)]">Pitching Hit%</div>
              <div className="mt-1 text-xl font-semibold text-[var(--neo-accent)] tabular-nums">
                {totalPitchingBip > 0 ? `${((totalPitchingHitsOnBip / totalPitchingBip) * 100).toFixed(1)}%` : "—"}
              </div>
              {formatPtsDelta(pitchingHitPct, baselinePitchingHitPct) && (
                <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                  Δ {formatPtsDelta(pitchingHitPct, baselinePitchingHitPct)} vs season (same spray filter)
                </p>
              )}
            </div>
          </div>

          <div id="charts-spray-batter" className="scroll-mt-28 space-y-3">
            <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-white)]">
              Team batter — balls in play
            </h2>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card-tech rounded-lg border border-[var(--border)] p-5">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Right-handed batters</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Balls in play from RHB and switch hitters when batting right (vs LHP). Wedges = LF, CF, RF (pull side is left field).
          </p>
                <p className="mt-1 text-xs tabular-nums">
                  <span className="text-[var(--accent)]">{rhbPAs.length}</span>
                  <span className="text-white"> BIP · </span>
                  <span className="text-[var(--accent)]">{rhbHits}</span>
                  <span className="text-white"> hits · </span>
                  <span className="text-[var(--accent)]">{rhbOuts}</span>
                  <span className="text-white"> outs</span>
                </p>
                {rhbPAs.length < sampleWarning && (
                  <p className="mt-2 text-xs text-amber-300">Small sample ({rhbPAs.length} BIP).</p>
                )}
                {rhbPAs.length === 0 && <p className="mt-2 text-xs text-[var(--text-muted)]">No BIP in this filter.</p>}
          <div className="mt-4 min-h-[280px]">
            <TeamSprayChart data={rhbData} hand="R" />
          </div>
        </section>
        <section className="card-tech rounded-lg border border-[var(--border)] p-5">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Left-handed batters</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Balls in play from LHB and switch hitters when batting left (vs RHP). Wedges = LF, CF, RF (pull side is right field).
          </p>
                <p className="mt-1 text-xs tabular-nums">
                  <span className="text-[var(--accent)]">{lhbPAs.length}</span>
                  <span className="text-white"> BIP · </span>
                  <span className="text-[var(--accent)]">{lhbHits}</span>
                  <span className="text-white"> hits · </span>
                  <span className="text-[var(--accent)]">{lhbOuts}</span>
                  <span className="text-white"> outs</span>
                </p>
                {lhbPAs.length < sampleWarning && (
                  <p className="mt-2 text-xs text-amber-300">Small sample ({lhbPAs.length} BIP).</p>
                )}
                {lhbPAs.length === 0 && <p className="mt-2 text-xs text-[var(--text-muted)]">No BIP in this filter.</p>}
          <div className="mt-4 min-h-[280px]">
            <TeamSprayChart data={lhbData} hand="L" />
          </div>
        </section>
      </div>
          </div>

          <div id="charts-spray-pitching" className="scroll-mt-28 space-y-3">
            <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-white)]">
              Team pitching — balls in play allowed
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Splits by opposing batter (this pitcher on the mound). Switch hitters use the side they batted from in each PA.
            </p>
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="card-tech rounded-lg border border-[var(--border)] p-5">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-white">vs LHB</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Left-handed batters and switch hitters batting left (vs RHP).</p>
                <p className="mt-1 text-xs tabular-nums">
                  <span className="text-[var(--accent)]">{pitchingLhbPAs.length}</span>
                  <span className="text-white"> BIP · </span>
                  <span className="text-[var(--accent)]">{pitchingLhbHits}</span>
                  <span className="text-white"> hits · </span>
                  <span className="text-[var(--accent)]">{pitchingLhbOuts}</span>
                  <span className="text-white"> outs</span>
                </p>
                {pitchingLhbPAs.length < sampleWarning && (
                  <p className="mt-2 text-xs text-amber-300">Small sample ({pitchingLhbPAs.length} BIP).</p>
                )}
                {pitchingLhbPAs.length === 0 && <p className="mt-2 text-xs text-[var(--text-muted)]">No BIP in this filter.</p>}
                <div className="mt-4 min-h-[280px]">
                  <TeamSprayChart data={pitchingVsLhbData} hand="L" />
                </div>
              </section>
              <section className="card-tech rounded-lg border border-[var(--border)] p-5">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-white">vs RHB</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Right-handed batters and switch hitters batting right (vs LHP).</p>
                <p className="mt-1 text-xs tabular-nums">
                  <span className="text-[var(--accent)]">{pitchingRhbPAs.length}</span>
                  <span className="text-white"> BIP · </span>
                  <span className="text-[var(--accent)]">{pitchingRhbHits}</span>
                  <span className="text-white"> hits · </span>
                  <span className="text-[var(--accent)]">{pitchingRhbOuts}</span>
                  <span className="text-white"> outs</span>
                </p>
                {pitchingRhbPAs.length < sampleWarning && (
                  <p className="mt-2 text-xs text-amber-300">Small sample ({pitchingRhbPAs.length} BIP).</p>
                )}
                {pitchingRhbPAs.length === 0 && <p className="mt-2 text-xs text-[var(--text-muted)]">No BIP in this filter.</p>}
                <div className="mt-4 min-h-[280px]">
                  <TeamSprayChart data={pitchingVsRhbData} hand="R" />
                </div>
              </section>
            </div>
          </div>

          <section
            id="charts-snapshot"
            className="scroll-mt-28 rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,var(--bg-elevated),var(--bg-card))] p-4 md:p-5 charts-print-area"
          >
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="font-display text-base font-semibold tracking-wide text-[var(--neo-accent)]">Objective Team Snapshot</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Contact mix, plate discipline proxies, situational results, and top-player lines ({filteredChartPas.length} PAs).
                </p>
              </div>
              <div className="rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                Sample PAs: <span className="font-semibold text-[var(--neo-accent)]">{filteredChartPas.length}</span>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
              <div className="space-y-4">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--neo-accent)]">Batted-Ball Mix</div>
                    <div
                      className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] tabular-nums text-[var(--text-muted)]"
                      title="Balls in play with a recorded batted-ball type in this filter (percentages sum to 100%)."
                    >
                      Total <span className="font-semibold text-[var(--neo-accent)]">{battedBallTotal}</span> tagged BIP
                    </div>
                  </div>
                  <div className="space-y-2 text-xs tabular-nums">
                    {[
                      { label: "GB", value: battedBallCounts.gb },
                      { label: "LD", value: battedBallCounts.ld },
                      { label: "FB", value: battedBallCounts.fb },
                      { label: "IFFB", value: battedBallCounts.iffb },
                    ].map((item) => (
                      <div key={item.label} className="grid grid-cols-[3rem_1fr_4.5rem] items-center gap-2">
                        <span className="text-[var(--text-muted)]">{item.label}</span>
                        <div className="h-2 rounded-full bg-[var(--bg-card)]">
                          <div
                            className="h-2 rounded-full bg-[var(--neo-accent)]/80"
                            style={
                              {
                                width: battedBallTotal > 0 ? `${Math.max(6, (item.value / battedBallTotal) * 100)}%` : "0%",
                              } as CSSProperties
                            }
                          />
                        </div>
                        <span className="text-right text-[var(--neo-accent)]">
                          {item.value} {battedBallTotal > 0 ? `(${((item.value / battedBallTotal) * 100).toFixed(0)}%)` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-3">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--neo-accent)]">
                    Plate Discipline Proxy ({filteredChartPas.length} PAs)
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
                    <div className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
                      <div className="text-[var(--text-muted)]">Strike%</div>
                      <div className="text-sm font-semibold text-[var(--neo-accent)]">
                        {pitchOutcomeTotals.totalPitches > 0
                          ? `${((pitchOutcomeTotals.totalStrikes / pitchOutcomeTotals.totalPitches) * 100).toFixed(1)}%`
                          : "—"}
                      </div>
                      {formatPtsDelta(strikePct, baselineStrikePct) && (
                        <div className="mt-0.5 text-[10px] text-[var(--text-faint)]">Δ {formatPtsDelta(strikePct, baselineStrikePct)} vs season</div>
                      )}
                    </div>
                    <div className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
                      <div className="text-[var(--text-muted)]">FPS%</div>
                      <div className="text-sm font-semibold text-[var(--neo-accent)]">
                        {pitchOutcomeTotals.firstPitchOpportunities > 0
                          ? `${((pitchOutcomeTotals.firstPitchStrikes / pitchOutcomeTotals.firstPitchOpportunities) * 100).toFixed(1)}%`
                          : "—"}
                      </div>
                      <div className="mt-0.5 text-[10px] text-[var(--text-faint)]">
                        {pitchOutcomeTotals.firstPitchOpportunities > 0
                          ? `${pitchOutcomeTotals.firstPitchStrikes}/${pitchOutcomeTotals.firstPitchOpportunities} PAs`
                          : "—"}
                      </div>
                    </div>
                    <div className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
                      <div className="text-[var(--text-muted)]">K%</div>
                      <div className="text-sm font-semibold text-[var(--neo-accent)]">
                        {filteredChartPas.length > 0
                          ? `${((pitchOutcomeTotals.strikeouts / filteredChartPas.length) * 100).toFixed(1)}%`
                          : "—"}
                      </div>
                      {formatPtsDelta(kPct, baselineKPct) && (
                        <div className="mt-0.5 text-[10px] text-[var(--text-faint)]">Δ {formatPtsDelta(kPct, baselineKPct)} vs season</div>
                      )}
                    </div>
                    <div className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
                      <div className="text-[var(--text-muted)]">BB%</div>
                      <div className="text-sm font-semibold text-[var(--neo-accent)]">
                        {filteredChartPas.length > 0
                          ? `${((pitchOutcomeTotals.walks / filteredChartPas.length) * 100).toFixed(1)}%`
                          : "—"}
                      </div>
                      <div className="mt-0.5 text-[10px] text-[var(--text-faint)]">
                        {filteredChartPas.length > 0 ? `${pitchOutcomeTotals.walks}/${filteredChartPas.length} PAs` : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-[var(--text-muted)] tabular-nums">
                    P/PA{" "}
                    <span className="font-semibold text-[var(--neo-accent)]">
                      {pitchOutcomeTotals.totalPaWithPitchCount > 0
                        ? (pitchOutcomeTotals.totalPitches / pitchOutcomeTotals.totalPaWithPitchCount).toFixed(2)
                        : "—"}
                    </span>
                    {pitchOutcomeTotals.totalPaWithPitchCount > 0 && (
                      <span className="text-[var(--text-faint)]">
                        {" "}
                        ({pitchOutcomeTotals.totalPitches} pitches / {pitchOutcomeTotals.totalPaWithPitchCount} PAs)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-3">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--neo-accent)]">
                    Situational Results
                  </div>
                  <div className="space-y-2 text-xs tabular-nums">
                    <div className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
                      <div className="text-[var(--text-muted)]">RISP</div>
                      <div className="mt-0.5 text-sm font-semibold text-[var(--neo-accent)]">
                        {rispHits}/{rispAb}
                        <span className="ml-1 text-xs text-[var(--text)]">
                          ({rispAb > 0 ? (rispHits / rispAb).toFixed(3).replace(/^0/, "") : "—"})
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-[var(--text-faint)]">{rispPas.length} PAs with RISP</div>
                    </div>
                    <div className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
                      <div className="text-[var(--text-muted)]">Inning 7+</div>
                      <div className="mt-0.5 text-sm font-semibold text-[var(--neo-accent)]">
                        {lateObjectiveHits}/{lateObjectiveAb}
                        <span className="ml-1 text-xs text-[var(--text)]">
                          ({lateObjectiveAb > 0 ? (lateObjectiveHits / lateObjectiveAb).toFixed(3).replace(/^0/, "") : "—"})
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-[var(--text-faint)]">{lateObjectivePas.length} PAs inning 7+</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-3">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--neo-accent)]">
                    Player Leaders (Current Filter)
                  </div>
                  <div className="max-h-[280px] space-y-1 overflow-y-auto pr-1">
                    {playerObjectiveLeaders.slice(0, leaderCap).map((p, i) => (
                      <div
                        key={p.playerId}
                        className="grid grid-cols-[1.3rem_minmax(0,1fr)] gap-2 rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-xs"
                      >
                        <span className="text-center tabular-nums text-[var(--neo-accent)]">{i + 1}</span>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-[var(--text)]">{p.name}</div>
                          <div className="truncate tabular-nums text-[var(--text-muted)]">
                            PA {p.pa} · AVG {p.avg.toFixed(3).replace(/^0/, "")} · K% {(p.kPct * 100).toFixed(1)} · BB% {(p.bbPct * 100).toFixed(1)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {playerObjectiveLeaders.length === 0 && (
                      <p className="text-xs text-[var(--text-muted)]">No player samples in this filter.</p>
                    )}
          </div>
                  {playerObjectiveLeaders.length > leaderCap && (
                    <button
                      type="button"
                      className="mt-2 w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--neo-accent)] hover:border-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                      onClick={() => setLeaderCap((c) => c + 10)}
                    >
                      Show more
                    </button>
                  )}
          </div>
        </div>
      </div>
          </section>
        </>
      )}
    </div>
  );
}
