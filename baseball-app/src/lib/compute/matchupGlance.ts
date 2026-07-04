import { battingStatsFromPAs, isRisp } from "@/lib/compute/battingStats";
import { formatBatterGameStatLine } from "@/lib/format/batterGameLine";
import { fmtDecimalNoLeadingZero } from "@/lib/format";
import type { PlateAppearance } from "@/lib/types";

function rateLabel(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return fmtDecimalNoLeadingZero(v, 3);
}

export type BatterGlanceSlice = {
  pa: number;
  ab: number;
  h: number;
  bb: number;
  so: number;
  hr: number;
  rbi: number;
  /** e.g. `0-3` */
  hab: string;
  line: string;
  avgLabel: string;
  obpLabel: string;
  slgLabel: string;
  opsLabel: string;
  kPctLabel: string;
  /** e.g. `0-1` or `—` when no RISP PAs */
  rispHab: string;
  fpsLabel: string;
  ppaLabel: string;
};

function formatPct(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  const pct = Math.round(rate * 1000) / 10;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

export function pasForMatchup(
  pas: PlateAppearance[],
  batterId: string,
  pitcherId: string
): PlateAppearance[] {
  return pas.filter((p) => p.batter_id === batterId && p.pitcher_id === pitcherId);
}

export function mergeMatchupPas(
  careerPas: PlateAppearance[],
  gamePas: PlateAppearance[],
  batterId: string,
  pitcherId: string
): PlateAppearance[] {
  const byId = new Map<string, PlateAppearance>();
  for (const pa of careerPas) byId.set(pa.id, pa);
  for (const pa of pasForMatchup(gamePas, batterId, pitcherId)) byId.set(pa.id, pa);
  return [...byId.values()];
}

function fpsAndPpaFromPas(pas: PlateAppearance[]): { fpsLabel: string; ppaLabel: string } {
  let fpsNum = 0;
  let fpsDen = 0;
  let pitchSum = 0;
  let pitchPa = 0;
  for (const pa of pas) {
    if (pa.first_pitch_strike != null) {
      fpsDen += 1;
      if (pa.first_pitch_strike) fpsNum += 1;
    }
    if (typeof pa.pitches_seen === "number" && pa.pitches_seen >= 0) {
      pitchSum += pa.pitches_seen;
      pitchPa += 1;
    }
  }
  const fpsLabel =
    fpsDen > 0 ? `${fpsNum}/${fpsDen} (${formatPct(fpsNum / fpsDen)})` : "—";
  const ppaLabel = pitchPa > 0 ? (pitchSum / pitchPa).toFixed(1) : "—";
  return { fpsLabel, ppaLabel };
}

export function batterGlanceFromPas(pas: PlateAppearance[]): BatterGlanceSlice | null {
  if (pas.length === 0) return null;
  const stats = battingStatsFromPAs(pas);
  if (!stats) return null;
  const h = stats.h ?? 0;
  const ab = stats.ab ?? 0;
  const rispPas = pas.filter((p) => isRisp(p.base_state));
  const rispStats = rispPas.length > 0 ? battingStatsFromPAs(rispPas) : null;
  const rispHab =
    rispStats != null ? `${rispStats.h ?? 0}-${rispStats.ab ?? 0}` : "—";
  const { fpsLabel, ppaLabel } = fpsAndPpaFromPas(pas);
  return {
    pa: stats.pa ?? pas.length,
    ab,
    h,
    bb: (stats.bb ?? 0) + (stats.ibb ?? 0),
    so: stats.so ?? 0,
    hr: stats.hr ?? 0,
    rbi: stats.rbi ?? 0,
    hab: `${h}-${ab}`,
    line: formatBatterGameStatLine(pas),
    avgLabel: rateLabel(stats.avg),
    obpLabel: rateLabel(stats.obp),
    slgLabel: rateLabel(stats.slg),
    opsLabel: rateLabel(stats.ops),
    kPctLabel: formatPct(stats.kPct),
    rispHab,
    fpsLabel,
    ppaLabel,
  };
}

export function handednessLabel(bats: string | null | undefined, throws: string | null | undefined): {
  batter: string;
  pitcher: string;
  platoon: string;
} {
  const batter =
    bats === "L" ? "LHB" : bats === "R" ? "RHB" : bats === "S" ? "SHB" : "—";
  const pitcher = throws === "L" ? "LHP" : throws === "R" ? "RHP" : "—";
  let platoon = "—";
  if (bats === "S") platoon = "Switch";
  else if ((bats === "L" || bats === "R") && (throws === "L" || throws === "R")) {
    platoon = bats === throws ? "Same side" : "Opposite";
  }
  return { batter, pitcher, platoon };
}
