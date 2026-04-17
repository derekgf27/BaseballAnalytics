/**
 * Pitching stats from plate appearances where `pitcher_id` matches the player.
 * R/ER can credit a different pitcher per scorer via `runs_scored_charged_pitcher_by_scorer`.
 */

import {
  fieldingErrorsByPlayerFromPas,
  isBasesEmpty,
  isBasesLoaded,
  isRisp,
  isRunnersOn,
} from "@/lib/compute/battingStats";
import {
  FINAL_COUNT_PAIRS,
  finalCountBucketKey,
  pasMatchFinalCount,
} from "@/lib/compute/battingStatsWithSplitsFromPas";
import { groupPitchEventsByPaId, mergeContactProfileIntoPitchingRates } from "@/lib/compute/contactProfileFromPas";
import { isDemoId } from "@/lib/db/mockData";
import { REGULATION_INNINGS } from "@/lib/leagueConfig";
import type {
  BattingFinalCountBucketKey,
  Bats,
  PAResult,
  PitchEvent,
  PitchingRateLine,
  PitchingRunnerSituationSplit,
  PitchingStats,
  PitchingStatsWithSplits,
  PlateAppearance,
} from "@/lib/types";

/** Scale for ERA-style stats (FIP constant is calibrated vs MLB 9-inning ERA). */
const MLB_ERA_SCALE_INNINGS = 9;

/** Typical FIP constant to scale to ERA-like numbers (replace with league-specific if needed). */
const FIP_CONSTANT = 3.1;

const HIT_RESULTS = new Set<PAResult>(["single", "double", "triple", "hr"]);

/** Earned runs credited on this PA (each scorer in `runs_scored_player_ids` is earned unless listed in `unearned_runs_scored_player_ids`). */
export function earnedRunsOnPlateAppearance(pa: PlateAppearance): number {
  const scorers = pa.runs_scored_player_ids ?? [];
  if (scorers.length === 0) return 0;
  const unearned = new Set(pa.unearned_runs_scored_player_ids ?? []);
  let n = 0;
  for (const id of scorers) {
    if (!unearned.has(id)) n += 1;
  }
  return n;
}

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

/** Opponent AB while facing this pitcher (mirrors batting `ab` in `battingStatsFromPAs`). */
function atBatsAgainst(pas: PlateAppearance[]): number {
  const pa = pas.length;
  const bb = countByResult(pas, "bb");
  const ibb = countByResult(pas, "ibb");
  const hbp = countByResult(pas, "hbp");
  const sf = countByResult(pas, "sac_fly") + countByResult(pas, "sac");
  const sh = countByResult(pas, "sac_bunt");
  return Math.max(0, pa - bb - ibb - hbp - sf - sh);
}

/** Baseball IP display: whole innings + .1 / .2 for ⅓ and ⅔. */
export function formatInningsPitched(totalOuts: number): string {
  if (totalOuts <= 0) return "0";
  const whole = Math.floor(totalOuts / 3);
  const rem = totalOuts % 3;
  if (rem === 0) return String(whole);
  return `${whole}.${rem}`;
}

function accumulatePitchingNonRunCounts(pas: PlateAppearance[]) {
  let totalOuts = 0;
  let h = 0;
  let hr = 0;

  for (const pa of pas) {
    totalOuts += outsRecordedAgainstPitcher(pa.result);
    if (HIT_RESULTS.has(pa.result)) {
      h += 1;
      if (pa.result === "hr") hr += 1;
    }
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
    bb,
    hbp,
    so,
    ip,
    paCount,
    pPa,
  };
}

function legacyRunsErFromPas(pas: PlateAppearance[]): { r: number; er: number } {
  let r = 0;
  let er = 0;
  for (const pa of pas) {
    r += pa.runs_scored_player_ids?.length ?? 0;
    er += earnedRunsOnPlateAppearance(pa);
  }
  return { r, er };
}

function inferPitcherIdForRunCharge(pas: PlateAppearance[]): string | null {
  let id: string | null = null;
  for (const pa of pas) {
    const p = pa.pitcher_id;
    if (!p || isDemoId(p)) continue;
    if (id == null) id = p;
    else if (id !== p) return null;
  }
  return id;
}

/** Pitcher credited for this scorer’s R/ER on the PA (default: `pa.pitcher_id`). */
export function pitcherChargedForScoredRun(pa: PlateAppearance, scorerPlayerId: string): string | null {
  const raw = pa.runs_scored_charged_pitcher_by_scorer;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const v = (raw as Record<string, unknown>)[scorerPlayerId];
    if (typeof v === "string" && v.trim()) return v;
  }
  return pa.pitcher_id ?? null;
}

function paChronologicalForInherited(a: PlateAppearance, b: PlateAppearance): number {
  const ga = String(a.game_id ?? "");
  const gb = String(b.game_id ?? "");
  if (ga !== gb) return ga.localeCompare(gb);
  if (a.inning !== b.inning) return a.inning - b.inning;
  const ha = a.inning_half === "top" ? 0 : 1;
  const hb = b.inning_half === "top" ? 0 : 1;
  if (ha !== hb) return ha - hb;
  const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
  const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
  return ta - tb;
}

/** Runners on base before the PA from `base_state` bits (1st / 2nd / 3rd). */
export function runnersOnBaseBeforePaFromState(baseState: string | null | undefined): number {
  const bits = String(baseState ?? "")
    .replace(/[^01]/g, "0")
    .padStart(3, "0")
    .slice(0, 3);
  return (bits.match(/1/g) || []).length;
}

/**
 * Total inherited runners for one pitcher: at each new mound appearance (first PA of the outing
 * or first PA after another pitcher), count runners on base from that PA’s `base_state`.
 */
export function inheritedRunnersBequeathedForPitcher(
  pitcherId: string,
  allPasInScope: PlateAppearance[]
): number {
  if (!pitcherId || isDemoId(pitcherId)) return 0;
  const byGame = new Map<string, PlateAppearance[]>();
  for (const pa of allPasInScope) {
    const gid = pa.game_id;
    if (!gid) continue;
    const arr = byGame.get(gid) ?? [];
    arr.push(pa);
    byGame.set(gid, arr);
  }
  let total = 0;
  for (const arr of byGame.values()) {
    arr.sort(paChronologicalForInherited);
    for (let i = 0; i < arr.length; i++) {
      const pa = arr[i]!;
      if (pa.pitcher_id !== pitcherId) continue;
      const prev = i > 0 ? arr[i - 1]! : null;
      const newMoundAppearance = prev == null || prev.pitcher_id !== pitcherId;
      if (!newMoundAppearance) continue;
      total += runnersOnBaseBeforePaFromState(pa.base_state);
    }
  }
  return total;
}

/** Sum for a staff: each roster pitcher’s inherited-runner total (full-game PA lists per game). */
export function inheritedRunnersBequeathedTeamTotal(
  rosterPitcherIds: Iterable<string>,
  allPasForGames: PlateAppearance[]
): number {
  let sum = 0;
  for (const pid of rosterPitcherIds) {
    if (!pid || isDemoId(pid)) continue;
    sum += inheritedRunnersBequeathedForPitcher(pid, allPasForGames);
  }
  return sum;
}

/**
 * Runs that scored on these PAs but were charged to a different pitcher than `pitcher_id`
 * (inherited runners scoring on the reliever’s watch).
 */
export function inheritedRunnersScoredInPasList(pas: PlateAppearance[]): number {
  let n = 0;
  for (const pa of pas) {
    const mound = pa.pitcher_id;
    if (!mound) continue;
    for (const sid of pa.runs_scored_player_ids ?? []) {
      const ch = pitcherChargedForScoredRun(pa, sid);
      if (ch != null && ch !== mound) n += 1;
    }
  }
  return n;
}

export function runsAndEarnedCreditedToPitcherFromPa(
  pa: PlateAppearance,
  pitcherId: string
): { r: number; er: number } {
  let r = 0;
  let er = 0;
  const unearned = new Set(pa.unearned_runs_scored_player_ids ?? []);
  for (const sid of pa.runs_scored_player_ids ?? []) {
    if (pitcherChargedForScoredRun(pa, sid) === pitcherId) {
      r += 1;
      if (!unearned.has(sid)) er += 1;
    }
  }
  return { r, er };
}

function sumRunsAttributedToPitcher(
  allPas: PlateAppearance[],
  pitcherId: string,
  paPredicate?: (pa: PlateAppearance) => boolean
): { r: number; er: number } {
  let r = 0;
  let er = 0;
  const pred = paPredicate ?? (() => true);
  for (const pa of allPas) {
    if (!pred(pa)) continue;
    const x = runsAndEarnedCreditedToPitcherFromPa(pa, pitcherId);
    r += x.r;
    er += x.er;
  }
  return { r, er };
}

export type PitchingStatsFromPasOptions = {
  /** Defaults to `pasThisPitcher` when omitted. */
  allPasForRunCharges?: PlateAppearance[];
  /**
   * When `null`, merged staff-style line: R/ER from runs on `pasThisPitcher` only (ignores charge map).
   * When omitted, inferred if every PA shares the same `pitcher_id`.
   */
  pitcherIdForRunCharge?: string | null;
};

function resolveRunChargeParams(
  pasThisPitcher: PlateAppearance[],
  options?: PitchingStatsFromPasOptions
): { pitcherIdForRunCharge: string | null; allPasForRunCharges: PlateAppearance[] } {
  const allPasForRunCharges = options?.allPasForRunCharges ?? pasThisPitcher;
  const pitcherIdForRunCharge =
    options?.pitcherIdForRunCharge !== undefined
      ? options.pitcherIdForRunCharge
      : inferPitcherIdForRunCharge(pasThisPitcher);
  return { pitcherIdForRunCharge, allPasForRunCharges };
}

type RunChargeSlice = {
  pitcherId: string;
  allPas: PlateAppearance[];
  paPredicate?: (pa: PlateAppearance) => boolean;
};

function buildRateLine(pas: PlateAppearance[]) {
  const c = accumulatePitchingNonRunCounts(pas);
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
function buildPitchingStatsLine(
  pas: PlateAppearance[],
  starterGameIds: Set<string>,
  eventsByPaId: Map<string, PitchEvent[]>,
  runCharge?: RunChargeSlice | null
): PitchingStats | null {
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
      abAgainst: 0,
      r: 0,
      ir: 0,
      irs: 0,
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

  const core = accumulatePitchingNonRunCounts(pas);
  const { totalOuts, h, hr, bb, hbp, so, ip } = core;
  const { r, er } =
    runCharge != null
      ? sumRunsAttributedToPitcher(runCharge.allPas, runCharge.pitcherId, runCharge.paPredicate)
      : legacyRunsErFromPas(pas);
  const abAgainst = atBatsAgainst(pas);
  const ipDisplay = formatInningsPitched(totalOuts);

  const era = ip > 0 ? (REGULATION_INNINGS * er) / ip : 0;
  const whip = ip > 0 ? (h + bb) / ip : 0;
  const fipRaw =
    ip > 0 ? (13 * hr + 3 * (bb + hbp) - 2 * so) / ip + FIP_CONSTANT : 0;
  const fip =
    ip > 0 ? fipRaw * (REGULATION_INNINGS / MLB_ERA_SCALE_INNINGS) : 0;

  const rates = buildRateLine(pas);
  mergeContactProfileIntoPitchingRates(rates, pas, eventsByPaId);

  const irs = inheritedRunnersScoredInPasList(pas);
  const moundSingle = inferPitcherIdForRunCharge(pas);
  let ir: number | undefined;
  if (
    runCharge &&
    !runCharge.paPredicate &&
    moundSingle &&
    runCharge.pitcherId === moundSingle
  ) {
    ir = inheritedRunnersBequeathedForPitcher(moundSingle, runCharge.allPas);
  }

  return {
    g,
    gs,
    ip,
    ipDisplay,
    h,
    abAgainst,
    r,
    ...(ir !== undefined ? { ir } : {}),
    irs,
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

/** PAs vs L/R batters only (switch hitters excluded from platoon buckets). */
export function platoonPitchingPasSplits(
  pas: PlateAppearance[],
  batterBatsById: Map<string, Bats | null | undefined>
): { pasL: PlateAppearance[]; pasR: PlateAppearance[] } {
  const pasL = pas.filter((pa) => batsLetter(batterBatsById.get(pa.batter_id)) === "L");
  const pasR = pas.filter((pa) => batsLetter(batterBatsById.get(pa.batter_id)) === "R");
  return { pasL, pasR };
}

function pitchingRunnerSituationSplitForPitcher(
  pas: PlateAppearance[],
  pred: (pa: PlateAppearance) => boolean,
  starterGameIds: Set<string>,
  batterBatsById: Map<string, Bats | null | undefined>,
  eventsByPaId: Map<string, PitchEvent[]>,
  pitcherId: string,
  allPasForRunCharges: PlateAppearance[]
): PitchingRunnerSituationSplit {
  const sub = pas.filter(pred);
  if (sub.length === 0) return { combined: null, vsLHB: null, vsRHB: null };
  const { pasL, pasR } = platoonPitchingPasSplits(sub, batterBatsById);
  const runSlice: RunChargeSlice = { pitcherId, allPas: allPasForRunCharges, paPredicate: pred };
  const combined = buildPitchingStatsLine(sub, starterGameIds, eventsByPaId, runSlice);
  const vsLHB =
    pasL.length > 0
      ? buildPitchingStatsLine(pasL, new Set(), eventsByPaId, {
          pitcherId,
          allPas: allPasForRunCharges,
          paPredicate: (pa) => pred(pa) && batsLetter(batterBatsById.get(pa.batter_id)) === "L",
        })
      : null;
  const vsRHB =
    pasR.length > 0
      ? buildPitchingStatsLine(pasR, new Set(), eventsByPaId, {
          pitcherId,
          allPas: allPasForRunCharges,
          paPredicate: (pa) => pred(pa) && batsLetter(batterBatsById.get(pa.batter_id)) === "R",
        })
      : null;
  const eSub = fieldingErrorsByPlayerFromPas(sub)[pitcherId] ?? 0;
  const eL = fieldingErrorsByPlayerFromPas(pasL)[pitcherId] ?? 0;
  const eR = fieldingErrorsByPlayerFromPas(pasR)[pitcherId] ?? 0;
  if (combined) combined.e = eSub;
  if (vsLHB) vsLHB.e = eL;
  if (vsRHB) vsRHB.e = eR;
  return { combined, vsLHB, vsRHB };
}

/** Base-state buckets for pitching (same PA `base_state` as batting). */
export function buildPitchingRunnerSituationsForPitcher(
  pas: PlateAppearance[],
  starterGameIds: Set<string>,
  batterBatsById: Map<string, Bats | null | undefined>,
  eventsByPaId: Map<string, PitchEvent[]>,
  pitcherId: string,
  allPasForRunCharges: PlateAppearance[] = pas
): NonNullable<PitchingStatsWithSplits["runnerSituations"]> {
  return {
    basesEmpty: pitchingRunnerSituationSplitForPitcher(
      pas,
      (pa) => isBasesEmpty(pa.base_state),
      starterGameIds,
      batterBatsById,
      eventsByPaId,
      pitcherId,
      allPasForRunCharges
    ),
    runnersOn: pitchingRunnerSituationSplitForPitcher(
      pas,
      (pa) => isRunnersOn(pa.base_state),
      starterGameIds,
      batterBatsById,
      eventsByPaId,
      pitcherId,
      allPasForRunCharges
    ),
    risp: pitchingRunnerSituationSplitForPitcher(
      pas,
      (pa) => isRisp(pa.base_state),
      starterGameIds,
      batterBatsById,
      eventsByPaId,
      pitcherId,
      allPasForRunCharges
    ),
    basesLoaded: pitchingRunnerSituationSplitForPitcher(
      pas,
      (pa) => isBasesLoaded(pa.base_state),
      starterGameIds,
      batterBatsById,
      eventsByPaId,
      pitcherId,
      allPasForRunCharges
    ),
  };
}

/**
 * Overall + vs LHB / vs RHB lines (batters with `bats` L or R only; switch excluded from platoon splits).
 */
export function pitchingStatsFromPAs(
  pasThisPitcher: PlateAppearance[],
  starterGameIds: Set<string>,
  batterBatsById: Map<string, Bats | null | undefined>,
  eventsByPaId: Map<string, PitchEvent[]> = new Map(),
  options?: PitchingStatsFromPasOptions
): PitchingStatsWithSplits | null {
  if (pasThisPitcher.length === 0 && starterGameIds.size === 0) return null;

  const { pitcherIdForRunCharge, allPasForRunCharges } = resolveRunChargeParams(pasThisPitcher, options);
  const runSlice: RunChargeSlice | undefined =
    pitcherIdForRunCharge != null
      ? { pitcherId: pitcherIdForRunCharge, allPas: allPasForRunCharges }
      : undefined;

  const overall = buildPitchingStatsLine(pasThisPitcher, starterGameIds, eventsByPaId, runSlice);
  if (!overall) return null;

  const pasL = pasThisPitcher.filter((pa) => batsLetter(batterBatsById.get(pa.batter_id)) === "L");
  const pasR = pasThisPitcher.filter((pa) => batsLetter(batterBatsById.get(pa.batter_id)) === "R");

  const vsLHB =
    pasL.length > 0
      ? buildPitchingStatsLine(
          pasL,
          new Set(),
          eventsByPaId,
          pitcherIdForRunCharge != null
            ? {
                pitcherId: pitcherIdForRunCharge,
                allPas: allPasForRunCharges,
                paPredicate: (pa) => batsLetter(batterBatsById.get(pa.batter_id)) === "L",
              }
            : undefined
        )
      : null;
  const vsRHB =
    pasR.length > 0
      ? buildPitchingStatsLine(
          pasR,
          new Set(),
          eventsByPaId,
          pitcherIdForRunCharge != null
            ? {
                pitcherId: pitcherIdForRunCharge,
                allPas: allPasForRunCharges,
                paPredicate: (pa) => batsLetter(batterBatsById.get(pa.batter_id)) === "R",
              }
            : undefined
        )
      : null;

  return { overall, vsLHB, vsRHB };
}

/**
 * Per–final-count lines for overall and platoon splits (same PA buckets as batting).
 */
export function buildPitchingStatsByFinalCountForSplits(
  pasList: PlateAppearance[],
  pasVsL: PlateAppearance[],
  pasVsR: PlateAppearance[],
  starterGameIds: Set<string>,
  batterBatsById: Map<string, Bats | null | undefined>,
  eventsByPaId: Map<string, PitchEvent[]>,
  options?: PitchingStatsFromPasOptions
): NonNullable<PitchingStatsWithSplits["statsByFinalCount"]> {
  const overall: Partial<Record<BattingFinalCountBucketKey, PitchingStats | null>> = {};
  const vsLHB: Partial<Record<BattingFinalCountBucketKey, PitchingStats | null>> = {};
  const vsRHB: Partial<Record<BattingFinalCountBucketKey, PitchingStats | null>> = {};
  const pitcherId = pasList.find((p) => p.pitcher_id)?.pitcher_id ?? null;
  const { pitcherIdForRunCharge, allPasForRunCharges } = resolveRunChargeParams(pasList, options);
  for (const [b, s] of FINAL_COUNT_PAIRS) {
    const key = finalCountBucketKey(b, s);
    const subAll = pasList.filter((pa) => pasMatchFinalCount(pa, b, s));
    const subL = pasVsL.filter((pa) => pasMatchFinalCount(pa, b, s));
    const subR = pasVsR.filter((pa) => pasMatchFinalCount(pa, b, s));
    overall[key] =
      subAll.length > 0
        ? buildPitchingStatsLine(
            subAll,
            starterGameIds,
            eventsByPaId,
            pitcherIdForRunCharge != null
              ? {
                  pitcherId: pitcherIdForRunCharge,
                  allPas: allPasForRunCharges,
                  paPredicate: (pa) => pasMatchFinalCount(pa, b, s),
                }
              : undefined
          )
        : null;
    vsLHB[key] =
      subL.length > 0
        ? buildPitchingStatsLine(
            subL,
            new Set(),
            eventsByPaId,
            pitcherIdForRunCharge != null
              ? {
                  pitcherId: pitcherIdForRunCharge,
                  allPas: allPasForRunCharges,
                  paPredicate: (pa) =>
                    pasMatchFinalCount(pa, b, s) && batsLetter(batterBatsById.get(pa.batter_id)) === "L",
                }
              : undefined
          )
        : null;
    vsRHB[key] =
      subR.length > 0
        ? buildPitchingStatsLine(
            subR,
            new Set(),
            eventsByPaId,
            pitcherIdForRunCharge != null
              ? {
                  pitcherId: pitcherIdForRunCharge,
                  allPas: allPasForRunCharges,
                  paPredicate: (pa) =>
                    pasMatchFinalCount(pa, b, s) && batsLetter(batterBatsById.get(pa.batter_id)) === "R",
                }
              : undefined
          )
        : null;
    if (pitcherId) {
      if (overall[key]) overall[key]!.e = fieldingErrorsByPlayerFromPas(subAll)[pitcherId] ?? 0;
      if (vsLHB[key]) vsLHB[key]!.e = fieldingErrorsByPlayerFromPas(subL)[pitcherId] ?? 0;
      if (vsRHB[key]) vsRHB[key]!.e = fieldingErrorsByPlayerFromPas(subR)[pitcherId] ?? 0;
    }
  }
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

function emptyPitchingRunnerSituationSplit(): PitchingRunnerSituationSplit {
  return { combined: null, vsLHB: null, vsRHB: null };
}

function emptyPitchingStatsWithSplits(): PitchingStatsWithSplits {
  return {
    overall: {
      g: 0,
      gs: 0,
      ip: 0,
      ipDisplay: "0",
      h: 0,
      abAgainst: 0,
      r: 0,
      irs: 0,
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
    runnerSituations: {
      basesEmpty: emptyPitchingRunnerSituationSplit(),
      runnersOn: emptyPitchingRunnerSituationSplit(),
      risp: emptyPitchingRunnerSituationSplit(),
      basesLoaded: emptyPitchingRunnerSituationSplit(),
    },
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
  batterBatsById: Map<string, Bats | null | undefined>,
  pitchEvents: PitchEvent[] = []
): Record<string, PitchingStatsWithSplits> {
  const eventsByPaId = groupPitchEventsByPaId(pitchEvents);
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
  const { pasL, pasR } = platoonPitchingPasSplits(list, batterBatsById);
    const stats = pitchingStatsFromPAs(list, starters, batterBatsById, eventsByPaId, {
      allPasForRunCharges: pas,
    });
    const base = stats ?? emptyPitchingStatsWithSplits();
    result[playerId] = {
      ...base,
      runnerSituations: buildPitchingRunnerSituationsForPitcher(
        list,
        starters,
        batterBatsById,
        eventsByPaId,
        playerId,
        pas
      ),
      statsByFinalCount: buildPitchingStatsByFinalCountForSplits(
        list,
        pasL,
        pasR,
        starters,
        batterBatsById,
        eventsByPaId,
        { allPasForRunCharges: pas }
      ),
    };
  }
  return result;
}

function weightedRateByPa(
  lines: PitchingStats[],
  getter: (r: PitchingRateLine) => number | null | undefined
): number | null {
  let num = 0;
  let den = 0;
  for (const l of lines) {
    const w = l.rates.pa;
    if (w <= 0) continue;
    const v = getter(l.rates);
    if (v == null || Number.isNaN(v)) continue;
    num += v * w;
    den += w;
  }
  return den > 0 ? num / den : null;
}

/** One roster row: sum counting stats and recompute ERA / WHIP / FIP / rates like a single staff line. */
export function aggregatePitchingTeamLine(lines: PitchingStats[]): PitchingStats | null {
  const L = lines.filter((l) => l != null);
  if (L.length === 0) return null;

  // G / GS are not summed: Σ pitcher appearances ≠ team games. Team row shows — for those columns.
  const g = 0;
  const gs = 0;
  const ip = L.reduce((s, l) => s + l.ip, 0);
  const totalOuts = L.reduce((s, l) => s + Math.round(l.ip * 3 + 1e-9), 0);
  const ipDisplay = formatInningsPitched(totalOuts);
  const h = L.reduce((s, l) => s + l.h, 0);
  const abAgainst = L.reduce((s, l) => s + l.abAgainst, 0);
  const r = L.reduce((s, l) => s + l.r, 0);
  const er = L.reduce((s, l) => s + l.er, 0);
  const hr = L.reduce((s, l) => s + l.hr, 0);
  const so = L.reduce((s, l) => s + l.so, 0);
  const bb = L.reduce((s, l) => s + l.bb, 0);
  const hbp = L.reduce((s, l) => s + l.hbp, 0);
  const e = L.reduce((s, l) => s + (l.e ?? 0), 0);
  const ir = L.reduce((s, l) => s + (l.ir ?? 0), 0);
  const irs = L.reduce((s, l) => s + (l.irs ?? 0), 0);

  const era = ip > 0 ? (REGULATION_INNINGS * er) / ip : 0;
  const whip = ip > 0 ? (h + bb) / ip : 0;
  const fipRaw =
    ip > 0 ? (13 * hr + 3 * (bb + hbp) - 2 * so) / ip + FIP_CONSTANT : 0;
  const fip =
    ip > 0 ? fipRaw * (REGULATION_INNINGS / MLB_ERA_SCALE_INNINGS) : 0;

  const ratesPa = L.reduce((s, l) => s + l.rates.pa, 0);
  const rate = REGULATION_INNINGS;

  const rates: PitchingRateLine = {
    pa: ratesPa,
    ip,
    k7: ip > 0 ? (rate * so) / ip : 0,
    bb7: ip > 0 ? (rate * bb) / ip : 0,
    h7: ip > 0 ? (rate * h) / ip : 0,
    hr7: ip > 0 ? (rate * hr) / ip : 0,
    kPct: ratesPa > 0 ? so / ratesPa : 0,
    bbPct: ratesPa > 0 ? bb / ratesPa : 0,
    pPa: weightedRateByPa(L, (r) => r.pPa),
    strikePct: weightedRateByPa(L, (r) => r.strikePct),
    fpsPct: weightedRateByPa(L, (r) => r.fpsPct),
    swingPct: weightedRateByPa(L, (r) => r.swingPct) ?? undefined,
    whiffPct: weightedRateByPa(L, (r) => r.whiffPct) ?? undefined,
    foulPct: weightedRateByPa(L, (r) => r.foulPct) ?? undefined,
    gbPct: weightedRateByPa(L, (r) => r.gbPct) ?? undefined,
    ldPct: weightedRateByPa(L, (r) => r.ldPct) ?? undefined,
    fbPct: weightedRateByPa(L, (r) => r.fbPct) ?? undefined,
    iffPct: weightedRateByPa(L, (r) => r.iffPct) ?? undefined,
  };

  return {
    g,
    gs,
    ip,
    ipDisplay,
    h,
    abAgainst,
    r,
    ir,
    irs,
    er,
    era,
    hr,
    so,
    bb,
    hbp,
    fip,
    whip,
    e,
    rates,
  };
}
