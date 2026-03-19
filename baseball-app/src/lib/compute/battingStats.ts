/**
 * Compute traditional and advanced batting stats (AVG, OBP, SLG, OPS, OPS+, wOBA) from plate appearance events.
 */

import type { BattingStats, PAResult, PlateAppearance } from "@/lib/types";

function countByResult(pas: PlateAppearance[], result: PAResult): number {
  return pas.filter((pa) => pa.result === result).length;
}

const DEFAULT_LEAGUE_OPS = 0.73;

/** wOBA linear weights (typical run environment; adjust per league if needed) */
const WOBA_WEIGHTS = {
  bb: 0.69,
  hbp: 0.72,
  single: 0.89,
  double: 1.27,
  triple: 1.62,
  hr: 2.1,
} as const;

/**
 * Compute AVG, OBP, SLG, OPS, OPS+, wOBA from a player's plate appearances.
 * wOBA denominator = AB + BB + HBP + SF (sac_fly; legacy 'sac' treated as SF).
 */
export function battingStatsFromPAs(
  pas: PlateAppearance[],
  leagueOPS = DEFAULT_LEAGUE_OPS
): BattingStats | null {
  if (pas.length === 0) return null;

  const pa = pas.length;
  const bb = countByResult(pas, "bb");
  const ibb = countByResult(pas, "ibb");
  const hbp = countByResult(pas, "hbp");
  const sac = countByResult(pas, "sac");
  const sacFly = countByResult(pas, "sac_fly");
  const sacBunt = countByResult(pas, "sac_bunt");
  const single = countByResult(pas, "single");
  const double = countByResult(pas, "double");
  const triple = countByResult(pas, "triple");
  const hr = countByResult(pas, "hr");
  const so = countByResult(pas, "so") + countByResult(pas, "so_looking");
  const rbi = pas.reduce((sum, p) => sum + (p.rbi ?? 0), 0);
  const sb = pas.reduce((sum, p) => sum + (p.stolen_bases ?? 0), 0);

  const sf = sacFly + sac; // legacy 'sac' counted as sac fly for wOBA
  const sh = sacBunt;
  const ab = pa - bb - ibb - hbp - sf - sh;
  const walks = bb + ibb;

  const h = single + double + triple + hr;
  const tb = single + 2 * double + 3 * triple + 4 * hr;

  const obp = pa > 0 ? (h + walks + hbp) / pa : 0;
  const slg = ab >= 1 ? tb / ab : 0;
  const avg = ab >= 1 ? h / ab : 0;
  const ops = obp + slg;
  const opsPlus = leagueOPS > 0 ? Math.round(100 * (ops / leagueOPS)) : 100;

  const wobaDenom = ab + bb + hbp + sf;
  const woba =
    wobaDenom >= 1
      ? (WOBA_WEIGHTS.bb * walks +
          WOBA_WEIGHTS.hbp * hbp +
          WOBA_WEIGHTS.single * single +
          WOBA_WEIGHTS.double * double +
          WOBA_WEIGHTS.triple * triple +
          WOBA_WEIGHTS.hr * hr) /
        wobaDenom
      : 0;

  const kPct = pa > 0 ? so / pa : 0;
  const bbPct = pa > 0 ? walks / pa : 0;

  return {
    avg,
    obp,
    slg,
    ops,
    opsPlus,
    woba,
    pa,
    ab,
    h,
    double,
    triple,
    hr,
    rbi,
    sb,
    bb,
    ibb,
    hbp,
    so,
    sf,
    sh,
    kPct,
    bbPct,
  };
}

export type LineupAggregateRates = Pick<BattingStats, "avg" | "obp" | "slg" | "ops" | "opsPlus" | "woba">;

/**
 * True combined rates for a lineup: sum counting stats across batters, then apply the same
 * formulas as single-player stats (AVG, OBP, SLG, OPS, OPS+, wOBA). Falls back to simple
 * averages of each rate if PA totals are missing (e.g. legacy rows without counts).
 */
export function lineupAggregateFromBattingStats(
  batters: BattingStats[],
  leagueOPS = DEFAULT_LEAGUE_OPS
): LineupAggregateRates | null {
  if (batters.length === 0) return null;

  const pa = batters.reduce((s, b) => s + (b.pa ?? 0), 0);
  const ab = batters.reduce((s, b) => s + (b.ab ?? 0), 0);

  if (pa >= 1 && ab >= 0) {
    const bb = batters.reduce((s, b) => s + (b.bb ?? 0), 0);
    const ibb = batters.reduce((s, b) => s + (b.ibb ?? 0), 0);
    const hbp = batters.reduce((s, b) => s + (b.hbp ?? 0), 0);
    const sf = batters.reduce((s, b) => s + (b.sf ?? 0), 0);
    const double = batters.reduce((s, b) => s + (b.double ?? 0), 0);
    const triple = batters.reduce((s, b) => s + (b.triple ?? 0), 0);
    const hr = batters.reduce((s, b) => s + (b.hr ?? 0), 0);
    const h =
      batters.reduce((s, b) => s + (b.h ?? 0), 0) ||
      double + triple + hr;

    const walks = bb + ibb;
    const obp = pa > 0 ? (h + walks + hbp) / pa : 0;
    const single = Math.max(0, h - double - triple - hr);
    const tb = single + 2 * double + 3 * triple + 4 * hr;
    const slg = ab >= 1 ? tb / ab : 0;
    const avg = ab >= 1 ? h / ab : 0;
    const ops = obp + slg;
    const opsPlus = leagueOPS > 0 ? Math.round(100 * (ops / leagueOPS)) : 100;

    const wobaDenom = ab + bb + hbp + sf;
    const woba =
      wobaDenom >= 1
        ? (WOBA_WEIGHTS.bb * walks +
            WOBA_WEIGHTS.hbp * hbp +
            WOBA_WEIGHTS.single * single +
            WOBA_WEIGHTS.double * double +
            WOBA_WEIGHTS.triple * triple +
            WOBA_WEIGHTS.hr * hr) /
          wobaDenom
        : 0;

    return { avg, obp, slg, ops, opsPlus, woba };
  }

  const n = batters.length;
  const mean = (key: keyof BattingStats): number =>
    batters.reduce((s, b) => s + Math.max(0, Number(b[key]) || 0), 0) / n;
  const avg = mean("avg");
  const obp = mean("obp");
  const slg = mean("slg");
  const ops = mean("ops");
  const opsPlus = Math.round(mean("opsPlus"));
  const woba = mean("woba");
  return { avg, obp, slg, ops, opsPlus, woba };
}
