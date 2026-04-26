import { battingStatsFromPAs, isRisp } from "@/lib/compute/battingStats";
import { runsOnPaForLinescore } from "@/lib/compute/boxScore";
import { ourTeamName } from "@/lib/opponentUtils";
import type { Game, PlateAppearance, Player } from "@/lib/types";

export type PostGameSnapshot = {
  finalScore: { ours: number; opp: number } | null;
  runsByInning: { inning: number; runs: number }[];
  maxInning: number;
  teamOffense: {
    avg: number;
    obp: number;
    slg: number;
    ops: number;
    kPct: number;
    bbPct: number;
    rispLine: string;
  } | null;
  plateDiscipline: {
    fpsPct: number | null;
    pPa: number | null;
  };
  situational: {
    rispHits: number;
    rispPa: number;
    productiveOuts: number;
    gidp: number;
  };
  gameChangers: {
    bestHitter: { name: string; ops: number; line: string } | null;
    worstAbsNote: string;
    clutch: { name: string; avgRisp: string; pa: number } | null;
  };
  keyMoment: string;
  analystNotes: string[];
};

export function pasOurTeamBatting(game: Game, pas: PlateAppearance[]): PlateAppearance[] {
  const half = game.our_side === "home" ? "bottom" : "top";
  return pas.filter((p) => p.inning_half === half);
}

function fmt3(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(3);
}

function ordinalInning(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

export function buildPostGameSnapshot(
  game: Game,
  pas: PlateAppearance[],
  playersById: Map<string, Player>
): PostGameSnapshot {
  const ourHalf = game.our_side === "home" ? "bottom" : "top";
  const pasOur = pasOurTeamBatting(game, pas);
  const teamStats = battingStatsFromPAs(pasOur);

  const pasOurRisp = pasOur.filter((p) => isRisp(p.base_state));
  const rispStats = pasOurRisp.length > 0 ? battingStatsFromPAs(pasOurRisp) : null;
  const rispLine =
    rispStats && (rispStats.pa ?? 0) > 0
      ? `${rispStats.h ?? 0}/${rispStats.pa ?? 0} PA`
      : "0/0 PA";

  const inningNums = pas.length > 0 ? pas.map((p) => p.inning) : [1];
  const maxInning = Math.max(1, ...inningNums);
  const runsByInning: { inning: number; runs: number }[] = [];
  for (let i = 1; i <= maxInning; i++) {
    let r = 0;
    for (const p of pas) {
      if (p.inning === i && p.inning_half === ourHalf) r += runsOnPaForLinescore(p);
    }
    runsByInning.push({ inning: i, runs: r });
  }

  const finalScore =
    game.final_score_home != null &&
    game.final_score_away != null &&
    !Number.isNaN(game.final_score_home) &&
    !Number.isNaN(game.final_score_away)
      ? {
          ours: game.our_side === "home" ? game.final_score_home : game.final_score_away,
          opp: game.our_side === "home" ? game.final_score_away : game.final_score_home,
        }
      : null;

  const fpsDenom = pasOur.filter((p) => p.first_pitch_strike != null).length;
  const fpsNum = pasOur.filter((p) => p.first_pitch_strike === true).length;
  const fpsPct = fpsDenom > 0 ? fpsNum / fpsDenom : null;

  const pPa = teamStats?.pPa ?? null;

  const byBatter = new Map<string, PlateAppearance[]>();
  for (const p of pasOur) {
    const list = byBatter.get(p.batter_id) ?? [];
    list.push(p);
    byBatter.set(p.batter_id, list);
  }

  let bestHitterFull: { name: string; ops: number; line: string } | null = null;
  let bestOps = -1;
  for (const [id, list] of byBatter) {
    const s = battingStatsFromPAs(list);
    if (!s || (s.pa ?? 0) < 2) continue;
    if (s.ops > bestOps) {
      bestOps = s.ops;
      bestHitterFull = {
        name: playersById.get(id)?.name ?? "Unknown",
        ops: s.ops,
        line: `${fmt3(s.avg)} / ${fmt3(s.obp)} / ${fmt3(s.slg)} · ${s.pa} PA`,
      };
    }
  }

  let clutch: { name: string; avgRisp: string; pa: number } | null = null;
  let bestRispAvg = -1;
  const rispByBatter = new Map<string, PlateAppearance[]>();
  for (const p of pasOurRisp) {
    const list = rispByBatter.get(p.batter_id) ?? [];
    list.push(p);
    rispByBatter.set(p.batter_id, list);
  }
  for (const [id, list] of rispByBatter) {
    const s = battingStatsFromPAs(list);
    if (!s || (s.pa ?? 0) < 2 || (s.ab ?? 0) < 1) continue;
    if (s.avg > bestRispAvg) {
      bestRispAvg = s.avg;
      clutch = {
        name: playersById.get(id)?.name ?? "Unknown",
        avgRisp: fmt3(s.avg),
        pa: s.pa ?? 0,
      };
    }
  }

  const gidp = pasOur.filter((p) => p.result === "gidp").length;
  const productiveOuts =
    pasOur.filter((p) => p.result === "sac_fly" || p.result === "sac_bunt" || p.result === "sac").length;

  const peakInning = runsByInning.reduce(
    (best, row) => (row.runs > best.runs ? row : best),
    { inning: 1, runs: 0 }
  );
  const ourLabel = ourTeamName(game);
  const keyMoment =
    peakInning.runs > 0
      ? `${peakInning.runs} run${peakInning.runs === 1 ? "" : "s"} plated in the ${ordinalInning(peakInning.inning)} inning (${ourLabel}).`
      : pasOur.length === 0
        ? `No offensive PAs logged for ${ourLabel} yet.`
        : "Spread-out scoring — no single big inning from the linescore.";

  const analystNotes: string[] = [];
  if (rispStats && (rispStats.pa ?? 0) >= 3 && (rispStats.avg ?? 0) < 0.2) {
    analystNotes.push("Struggled with RISP in this game.");
  }
  if (teamStats && (teamStats.pa ?? 0) >= 8 && (teamStats.bbPct ?? 0) < 0.06) {
    analystNotes.push("Low walk rate — worth reviewing early-count approaches.");
  }
  if (teamStats && (teamStats.kPct ?? 0) > 0.33) {
    analystNotes.push("Strikeouts were a big part of this offensive line.");
  }
  if (fpsPct != null && fpsPct < 0.45 && pasOur.length >= 6) {
    analystNotes.push("Fell behind in the count often (first-pitch strike % below typical).");
  }
  if (analystNotes.length === 0) {
    analystNotes.push("No auto-flags from the box — add film-based bullets below.");
  }

  const kLeaders = [...byBatter.entries()]
    .map(([id, list]) => ({
      id,
      k: list.filter((p) => p.result === "so" || p.result === "so_looking").length,
      pa: list.length,
    }))
    .filter((x) => x.pa >= 2)
    .sort((a, b) => b.k - a.k);
  const worstAbsNote =
    kLeaders[0] && kLeaders[0].k > 0
      ? `${playersById.get(kLeaders[0].id)?.name ?? "A hitter"}: ${kLeaders[0].k} K in ${kLeaders[0].pa} PA.`
      : "No multi-K night stood out in the sample.";

  return {
    finalScore,
    runsByInning,
    maxInning,
    teamOffense: teamStats
      ? {
          avg: teamStats.avg,
          obp: teamStats.obp,
          slg: teamStats.slg,
          ops: teamStats.ops,
          kPct: teamStats.kPct ?? 0,
          bbPct: teamStats.bbPct ?? 0,
          rispLine,
        }
      : null,
    plateDiscipline: { fpsPct, pPa },
    situational: {
      rispHits: rispStats?.h ?? 0,
      rispPa: rispStats?.pa ?? 0,
      productiveOuts,
      gidp,
    },
    gameChangers: {
      bestHitter: bestHitterFull,
      worstAbsNote,
      clutch,
    },
    keyMoment,
    analystNotes,
  };
}
