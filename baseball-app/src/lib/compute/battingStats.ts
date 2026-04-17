/**
 * Compute traditional and advanced batting stats (AVG, OBP, SLG, OPS, OPS+, wOBA) from plate appearance events.
 */

import { pitchOutcomeStrikesThrownIncrement } from "@/lib/compute/pitchSequence";
import type { BattingStats, PAResult, PitchEvent, PlateAppearance } from "@/lib/types";

function countByResult(pas: PlateAppearance[], result: PAResult): number {
  return pas.filter((pa) => pa.result === result).length;
}

const DEFAULT_LEAGUE_OPS = 0.73;

/** Normalize `base_state` to three chars: 1st, 2nd, 3rd occupied (e.g. `"100"` = 1st only). */
export function normBaseState(baseState: string | null | undefined): string {
  return String(baseState ?? "")
    .replace(/[^01]/g, "0")
    .padStart(3, "0")
    .slice(0, 3);
}

export function isBasesEmpty(baseState: string | null | undefined): boolean {
  return normBaseState(baseState) === "000";
}

/** At least one runner on any base. */
export function isRunnersOn(baseState: string | null | undefined): boolean {
  return !isBasesEmpty(baseState);
}

export function isBasesLoaded(baseState: string | null | undefined): boolean {
  return normBaseState(baseState) === "111";
}

/**
 * Runners in scoring position: **only** if someone is on **2nd and/or 3rd** before the PA.
 * Runner on 1st only (`"100"`) is not RISP; `"110"` / `"101"` / `"011"` / `"111"` are (2nd or 3rd occupied).
 */
export function isRisp(baseState: string | null | undefined): boolean {
  const b = normBaseState(baseState);
  return b[1] === "1" || b[2] === "1";
}

/** Count defensive errors charged per player (`error_fielder_id`), including ROE and hit + extra-base errors. */
export function fieldingErrorsByPlayerFromPas(pas: PlateAppearance[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const pa of pas) {
    const fid = pa.error_fielder_id;
    if (!fid) continue;
    counts[fid] = (counts[fid] ?? 0) + 1;
  }
  return counts;
}

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
  const gidp = countByResult(pas, "gidp");
  const fieldersChoice = countByResult(pas, "fielders_choice");
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

  const hasPitchData = pas.some((p) => p.pitches_seen != null && p.pitches_seen >= 0);
  const pitchesSeenTotal = pas.reduce(
    (sum, p) => sum + (typeof p.pitches_seen === "number" && p.pitches_seen >= 0 ? p.pitches_seen : 0),
    0
  );
  const pPa = hasPitchData && pa > 0 ? pitchesSeenTotal / pa : undefined;

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
    gidp,
    fieldersChoice,
    sf,
    sh,
    kPct,
    bbPct,
    pitchesSeenTotal: hasPitchData ? pitchesSeenTotal : undefined,
    pPa,
  };
}

export type LineupAggregateRates = Pick<BattingStats, "avg" | "obp" | "slg" | "ops" | "opsPlus" | "woba" | "pPa" | "kPct">;

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

    const pitchSum = batters.reduce((s, b) => s + (b.pitchesSeenTotal ?? 0), 0);
    const pPa = pa >= 1 && pitchSum > 0 ? pitchSum / pa : undefined;

    const so = batters.reduce((s, b) => s + (b.so ?? 0), 0);
    const kPct = pa > 0 ? so / pa : 0;

    return { avg, obp, slg, ops, opsPlus, woba, pPa, kPct };
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
  const pPaList = batters.map((b) => b.pPa).filter((x): x is number => typeof x === "number" && !Number.isNaN(x));
  const pPa = pPaList.length > 0 ? pPaList.reduce((a, b) => a + b, 0) / pPaList.length : undefined;
  const totalPa = batters.reduce((s, b) => s + (b.pa ?? 0), 0);
  const totalSo = batters.reduce((s, b) => s + (b.so ?? 0), 0);
  const kPct = totalPa > 0 ? totalSo / totalPa : 0;
  return { avg, obp, slg, ops, opsPlus, woba, pPa, kPct };
}

/**
 * First-pitch strikes and strike rate (strikes ÷ pitches) for a set of PAs — e.g. one team’s trips to the plate.
 * Eligibility matches pitching rate logic (`strikes_thrown` / `pitches_seen`, first-pitch when ≥1 pitch recorded).
 */
export function pitchMixFromPlateAppearances(pas: PlateAppearance[]): {
  firstPitchStrikes: number;
  firstPitchOpportunities: number;
  strikePct: number | null;
  /** FPS / opportunities when opportunities > 0. */
  firstPitchStrikePct: number | null;
  /** Sum of `pitches_seen` on PAs with a numeric pitch count. */
  pitchesTotal: number;
  /** PAs with a recorded `pitches_seen` (incl. 0). */
  plateAppearancesWithPitchCount: number;
  /** Mean pitches per PA among PAs with pitch count (same basis as pitching `rates.pPa`). */
  pitchesPerPA: number | null;
} {
  let strikeSum = 0;
  let pitchSumStrike = 0;
  let fpsNumer = 0;
  let fpsDenom = 0;
  let pitchSumAll = 0;
  let pitchPaCount = 0;

  for (const pa of pas) {
    const pv = pa.pitches_seen;
    const st = pa.strikes_thrown;
    if (pv != null && !Number.isNaN(pv)) {
      pitchSumAll += pv;
      pitchPaCount += 1;
    }
    if (
      pv != null &&
      st != null &&
      !Number.isNaN(pv) &&
      !Number.isNaN(st) &&
      pv > 0 &&
      st >= 0 &&
      st <= pv
    ) {
      pitchSumStrike += pv;
      strikeSum += st;
    }
    if (pa.first_pitch_strike != null && pa.pitches_seen != null && pa.pitches_seen >= 1) {
      fpsDenom += 1;
      if (pa.first_pitch_strike) fpsNumer += 1;
    }
  }

  return {
    firstPitchStrikes: fpsNumer,
    firstPitchOpportunities: fpsDenom,
    strikePct: pitchSumStrike > 0 ? strikeSum / pitchSumStrike : null,
    firstPitchStrikePct: fpsDenom > 0 ? fpsNumer / fpsDenom : null,
    pitchesTotal: pitchSumAll,
    plateAppearancesWithPitchCount: pitchPaCount,
    pitchesPerPA: pitchPaCount > 0 ? pitchSumAll / pitchPaCount : null,
  };
}

export type PitchMixRates = ReturnType<typeof pitchMixFromPlateAppearances>;

/**
 * Same as {@link pitchMixFromPlateAppearances}, but when a PA has a pitch-by-pitch log,
 * uses those rows for rates (FPS, strike %, pitch counts). Fixes empty “Rates” when
 * `pitches_seen` / `first_pitch_strike` were not stored but `pitch_events` exist.
 */
export function pitchMixFromPlateAppearancesOrPitchLog(
  pas: PlateAppearance[],
  eventsByPaId: Map<string, PitchEvent[]>
): PitchMixRates {
  let strikeSum = 0;
  let pitchSumStrike = 0;
  let fpsNumer = 0;
  let fpsDenom = 0;
  let pitchSumAll = 0;
  let pitchPaCount = 0;

  for (const pa of pas) {
    const evs = eventsByPaId.get(pa.id) ?? [];
    if (evs.length > 0) {
      const pv = evs.length;
      pitchSumAll += pv;
      pitchPaCount += 1;
      let stForPa = 0;
      for (const e of evs) {
        stForPa += pitchOutcomeStrikesThrownIncrement(e.outcome);
      }
      strikeSum += stForPa;
      pitchSumStrike += pv;
      fpsDenom += 1;
      const first = evs[0]!;
      if (first.outcome !== "ball") fpsNumer += 1;
    } else {
      const pv = pa.pitches_seen;
      const st = pa.strikes_thrown;
      if (pv != null && !Number.isNaN(pv)) {
        pitchSumAll += pv;
        pitchPaCount += 1;
      }
      if (
        pv != null &&
        st != null &&
        !Number.isNaN(pv) &&
        !Number.isNaN(st) &&
        pv > 0 &&
        st >= 0 &&
        st <= pv
      ) {
        pitchSumStrike += pv;
        strikeSum += st;
      }
      if (pa.first_pitch_strike != null && pa.pitches_seen != null && pa.pitches_seen >= 1) {
        fpsDenom += 1;
        if (pa.first_pitch_strike) fpsNumer += 1;
      }
    }
  }

  return {
    firstPitchStrikes: fpsNumer,
    firstPitchOpportunities: fpsDenom,
    strikePct: pitchSumStrike > 0 ? strikeSum / pitchSumStrike : null,
    firstPitchStrikePct: fpsDenom > 0 ? fpsNumer / fpsDenom : null,
    pitchesTotal: pitchSumAll,
    plateAppearancesWithPitchCount: pitchPaCount,
    pitchesPerPA: pitchPaCount > 0 ? pitchSumAll / pitchPaCount : null,
  };
}
