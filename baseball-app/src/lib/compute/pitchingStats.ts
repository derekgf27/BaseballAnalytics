/**
 * Pitching stats from plate appearances where `pitcher_id` matches the player.
 */

import { isDemoId } from "@/lib/db/mockData";
import { REGULATION_INNINGS } from "@/lib/leagueConfig";
import type { Bats, PAResult, PitchingStats, PitchingStatsWithSplits, PitchingRateLine, PlateAppearance } from "@/lib/types";

/** Scale for ERA-style stats (FIP constant is calibrated vs MLB 9-inning ERA). */
const MLB_ERA_SCALE_INNINGS = 9;

/** Typical FIP constant to scale to ERA-like numbers (replace with league-specific if needed). */
const FIP_CONSTANT = 3.1;

const HIT_RESULTS = new Set<PAResult>(["single", "double", "triple", "hr"]);

/** Outs recorded against the pitcher on this PA (for IP). */
export function outsRecordedAgainstPitcher(result: PAResult): number {
  if (result === "gidp") return 2;
  if (
    result === "out" ||
    result === "so" ||
    result === "so_looking" ||
    result === "sac_fly" ||
    result === "sac_bunt" ||
    result === "sac" ||
    result === "fielders_choice"
  ) {
    return 1;
  }
  return 0;
}

function countByResult(pas: PlateAppearance[], result: PAResult): number {
  return pas.filter((pa) => pa.result === result).length;
}

/** Baseball IP display: whole innings + .1 / .2 for ⅓ and ⅔. */
export function formatInningsPitched(totalOuts: number): string {
  if (totalOuts <= 0) return "0";
  const whole = Math.floor(totalOuts / 3);
  const rem = totalOuts % 3;
  if (rem === 0) return String(whole);
  return `${whole}.${rem}`;
}

function accumulatePitchingCounts(pas: PlateAppearance[]) {
  let totalOuts = 0;
  let h = 0;
  let hr = 0;
  let r = 0;
  let er = 0;

  for (const pa of pas) {
    totalOuts += outsRecordedAgainstPitcher(pa.result);
    if (HIT_RESULTS.has(pa.result)) {
      h += 1;
      if (pa.result === "hr") hr += 1;
    }
    const runsOnPlay = pa.runs_scored_player_ids?.length ?? 0;
    r += runsOnPlay;
    er += runsOnPlay;
  }

  const bb = countByResult(pas, "bb") + countByResult(pas, "ibb");
  const hbp = countByResult(pas, "hbp");
  const so = countByResult(pas, "so") + countByResult(pas, "so_looking");

  const ip = totalOuts / 3;
  const paCount = pas.length;

  let pitchSum = 0;
  let pitchPaCount = 0;
  for (const pa of pas) {
    const pv = pa.pitches_seen;
    if (pv != null && !Number.isNaN(pv)) {
      pitchSum += pv;
      pitchPaCount += 1;
    }
  }
  const pPa = pitchPaCount > 0 ? pitchSum / pitchPaCount : null;

  return {
    totalOuts,
    h,
    hr,
    r,
    er,
    bb,
    hbp,
    so,
    ip,
    paCount,
    pPa,
  };
}

function buildRateLine(pas: PlateAppearance[]) {
  const c = accumulatePitchingCounts(pas);
  const { ip, paCount, so, bb, h, hr, pPa } = c;

  let strikeSum = 0;
  let pitchSumStrike = 0;
  let fpsNumer = 0;
  let fpsDenom = 0;
  for (const pa of pas) {
    const pv = pa.pitches_seen;
    const st = pa.strikes_thrown;
    if (pv != null && st != null && !Number.isNaN(pv) && !Number.isNaN(st) && pv > 0 && st >= 0 && st <= pv) {
      pitchSumStrike += pv;
      strikeSum += st;
    }
    if (pa.first_pitch_strike != null && pa.pitches_seen != null && pa.pitches_seen >= 1) {
      fpsDenom += 1;
      if (pa.first_pitch_strike) fpsNumer += 1;
    }
  }

  const rate = REGULATION_INNINGS;
  return {
    pa: paCount,
    ip,
    k7: ip > 0 ? (rate * so) / ip : 0,
    bb7: ip > 0 ? (rate * bb) / ip : 0,
    h7: ip > 0 ? (rate * h) / ip : 0,
    hr7: ip > 0 ? (rate * hr) / ip : 0,
    kPct: paCount > 0 ? so / paCount : 0,
    bbPct: paCount > 0 ? bb / paCount : 0,
    pPa,
    strikePct: pitchSumStrike > 0 ? strikeSum / pitchSumStrike : null,
    fpsPct: fpsDenom > 0 ? fpsNumer / fpsDenom : null,
  };
}

function batsLetter(bats: Bats | null | undefined): "L" | "R" | "S" | null {
  if (bats == null) return null;
  const ch = String(bats).trim().toUpperCase()[0];
  if (ch === "L") return "L";
  if (ch === "R") return "R";
  if (ch === "S") return "S";
  return null;
}

/**
 * One pitching line: `pas` are all PAs credited to this pitcher.
 * `starterGameIds` — games where this player is listed as SP on `games`; **GS** only counts games
 * that also appear in `pas` (at least one PA recorded as pitcher). **G** is games with ≥1 such PA.
 * For platoon splits pass an empty set so G = games in this split only and GS = 0.
 */
function buildPitchingStatsLine(pas: PlateAppearance[], starterGameIds: Set<string>): PitchingStats | null {
  if (pas.length === 0 && starterGameIds.size === 0) return null;

  const gamesFromPas = new Set(pas.map((p) => p.game_id));
  let gs = 0;
  for (const gameId of starterGameIds) {
    if (gamesFromPas.has(gameId)) gs += 1;
  }
  const g = gamesFromPas.size;

  if (pas.length === 0) {
    return {
      g,
      gs,
      ip: 0,
      ipDisplay: "0",
      h: 0,
      r: 0,
      er: 0,
      era: 0,
      hr: 0,
      so: 0,
      bb: 0,
      hbp: 0,
      fip: 0,
      whip: 0,
      rates: {
        pa: 0,
        ip: 0,
        k7: 0,
        bb7: 0,
        h7: 0,
        hr7: 0,
        kPct: 0,
        bbPct: 0,
        pPa: null,
        strikePct: null,
        fpsPct: null,
      },
    };
  }

  const core = accumulatePitchingCounts(pas);
  const { totalOuts, h, hr, r, er, bb, hbp, so, ip } = core;
  const ipDisplay = formatInningsPitched(totalOuts);

  const era = ip > 0 ? (REGULATION_INNINGS * er) / ip : 0;
  const whip = ip > 0 ? (h + bb) / ip : 0;
  const fipRaw =
    ip > 0 ? (13 * hr + 3 * (bb + hbp) - 2 * so) / ip + FIP_CONSTANT : 0;
  const fip =
    ip > 0 ? fipRaw * (REGULATION_INNINGS / MLB_ERA_SCALE_INNINGS) : 0;

  const rates = buildRateLine(pas);

  return {
    g,
    gs,
    ip,
    ipDisplay,
    h,
    r,
    er,
    era,
    hr,
    so,
    bb,
    hbp,
    fip,
    whip,
    rates,
  };
}

/**
 * Overall + vs LHB / vs RHB lines (batters with `bats` L or R only; switch excluded from platoon splits).
 */
export function pitchingStatsFromPAs(
  pas: PlateAppearance[],
  starterGameIds: Set<string>,
  batterBatsById: Map<string, Bats | null | undefined>
): PitchingStatsWithSplits | null {
  if (pas.length === 0 && starterGameIds.size === 0) return null;

  const overall = buildPitchingStatsLine(pas, starterGameIds);
  if (!overall) return null;

  const pasL = pas.filter((pa) => batsLetter(batterBatsById.get(pa.batter_id)) === "L");
  const pasR = pas.filter((pa) => batsLetter(batterBatsById.get(pa.batter_id)) === "R");

  const vsLHB = pasL.length > 0 ? buildPitchingStatsLine(pasL, new Set()) : null;
  const vsRHB = pasR.length > 0 ? buildPitchingStatsLine(pasR, new Set()) : null;

  return { overall, vsLHB, vsRHB };
}

function emptyRateLine(): PitchingRateLine {
  return {
    pa: 0,
    ip: 0,
    k7: 0,
    bb7: 0,
    h7: 0,
    hr7: 0,
    kPct: 0,
    bbPct: 0,
    pPa: null,
    strikePct: null,
    fpsPct: null,
  };
}

function emptyPitchingStatsWithSplits(): PitchingStatsWithSplits {
  return {
    overall: {
      g: 0,
      gs: 0,
      ip: 0,
      ipDisplay: "0",
      h: 0,
      r: 0,
      er: 0,
      era: 0,
      hr: 0,
      so: 0,
      bb: 0,
      hbp: 0,
      fip: 0,
      whip: 0,
      rates: emptyRateLine(),
    },
    vsLHB: null,
    vsRHB: null,
  };
}

/**
 * Per-pitcher {@link PitchingStatsWithSplits} from a filtered PA list (e.g. one opponent or one batter).
 * Safe for client use (no DB).
 */
export function computePitchingStatsWithSplitsForRoster(
  pitcherIds: string[],
  pas: PlateAppearance[],
  starterGameIdsByPlayer: Map<string, Set<string>>,
  batterBatsById: Map<string, Bats | null | undefined>
): Record<string, PitchingStatsWithSplits> {
  const byPitcher = new Map<string, PlateAppearance[]>();
  for (const pa of pas) {
    if (!pa.pitcher_id || isDemoId(pa.pitcher_id)) continue;
    const list = byPitcher.get(pa.pitcher_id) ?? [];
    list.push(pa);
    byPitcher.set(pa.pitcher_id, list);
  }

  const result: Record<string, PitchingStatsWithSplits> = {};
  for (const playerId of pitcherIds) {
    if (isDemoId(playerId)) continue;
    const list = byPitcher.get(playerId) ?? [];
    const starters = starterGameIdsByPlayer.get(playerId) ?? new Set<string>();
    const stats = pitchingStatsFromPAs(list, starters, batterBatsById);
    result[playerId] = stats ?? emptyPitchingStatsWithSplits();
  }
  return result;
}
