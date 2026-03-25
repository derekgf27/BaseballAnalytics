/**
 * Per-game pitching box: group PAs by pitcher and defense team (who was on the mound).
 */

import { formatInningsPitched, pitchingStatsFromPAs } from "@/lib/compute/pitchingStats";
import { REGULATION_INNINGS } from "@/lib/leagueConfig";
import type { PlateAppearance, Player } from "@/lib/types";

/** Team playing defense on this PA: top = away bats, home fields; bottom = home bats, away fields. */
export function pitchingDefenseSide(pa: PlateAppearance): "home" | "away" {
  return pa.inning_half === "top" ? "home" : "away";
}

/** All PAs where `side` is on the mound (same filter as the pitching box score for that team). */
export function plateAppearancesForPitchingSide(
  allPas: PlateAppearance[],
  side: "home" | "away"
): PlateAppearance[] {
  return allPas.filter((p) => pitchingDefenseSide(p) === side);
}

function paChronological(a: PlateAppearance, b: PlateAppearance): number {
  if (a.inning !== b.inning) return a.inning - b.inning;
  const ha = a.inning_half === "top" ? 0 : 1;
  const hb = b.inning_half === "top" ? 0 : 1;
  if (ha !== hb) return ha - hb;
  const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
  const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
  return ta - tb;
}

export interface GamePitchingBoxRow {
  playerId: string;
  name: string;
  ip: string;
  h: number;
  r: number;
  er: number;
  bb: number;
  k: number;
  hr: number;
  era: string;
}

export interface GamePitchingBoxTotals {
  ip: string;
  h: number;
  r: number;
  er: number;
  bb: number;
  k: number;
  hr: number;
  era: string;
}

/**
 * Pitchers who appeared for `side` (home or away defense), in order of first PA credited to them.
 */
export function computeGamePitchingBox(
  pas: PlateAppearance[],
  side: "home" | "away",
  playerById: Map<string, Player>
): { rows: GamePitchingBoxRow[]; totals: GamePitchingBoxTotals } {
  const sorted = [...pas].sort(paChronological);
  const order: string[] = [];
  const seen = new Set<string>();
  for (const pa of sorted) {
    if (!pa.pitcher_id) continue;
    if (pitchingDefenseSide(pa) !== side) continue;
    if (seen.has(pa.pitcher_id)) continue;
    seen.add(pa.pitcher_id);
    order.push(pa.pitcher_id);
  }

  const forSide = pas.filter((p) => p.pitcher_id && pitchingDefenseSide(p) === side);

  const rows: GamePitchingBoxRow[] = [];
  let sumIpDecimal = 0;
  let sumH = 0;
  let sumR = 0;
  let sumEr = 0;
  let sumBb = 0;
  let sumK = 0;
  let sumHr = 0;

  for (const pid of order) {
    const pitcherPas = forSide.filter((p) => p.pitcher_id === pid);
    const stats = pitchingStatsFromPAs(pitcherPas, new Set(), new Map())?.overall;
    if (!stats) continue;
    const name = playerById.get(pid)?.name ?? "Unknown player";
    rows.push({
      playerId: pid,
      name,
      ip: stats.ipDisplay,
      h: stats.h,
      r: stats.r,
      er: stats.er,
      bb: stats.bb,
      k: stats.so,
      hr: stats.hr,
      era: stats.ip > 0 ? stats.era.toFixed(2) : "—",
    });
    sumIpDecimal += stats.ip;
    sumH += stats.h;
    sumR += stats.r;
    sumEr += stats.er;
    sumBb += stats.bb;
    sumK += stats.so;
    sumHr += stats.hr;
  }

  const totalOuts = Math.round(sumIpDecimal * 3);
  const teamEra =
    sumIpDecimal > 0 ? ((REGULATION_INNINGS * sumEr) / sumIpDecimal).toFixed(2) : "—";

  const totals: GamePitchingBoxTotals = {
    ip: totalOuts > 0 ? formatInningsPitched(totalOuts) : "0",
    h: sumH,
    r: sumR,
    er: sumEr,
    bb: sumBb,
    k: sumK,
    hr: sumHr,
    era: teamEra,
  };

  return { rows, totals };
}
