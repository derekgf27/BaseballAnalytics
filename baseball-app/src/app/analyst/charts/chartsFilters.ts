import type { SprayResultFilterKey } from "@/lib/sprayChartFilters";
import { isRisp } from "@/lib/compute/battingStats";
import {
  isValidSprayHitDirection,
  sprayResultMatchesFilter,
} from "@/lib/sprayChartFilters";
import type { Game } from "@/lib/types";
import type { HitDirection } from "@/lib/types";
import type {
  ChartPaRow,
  ChartUrlFilters,
  ChartsFilterChip,
  DateRangeKey,
  InningBucketKey,
  PitchHandFilter,
  SprayChartRow,
} from "./chartTypes";

const CHART_CONTACT_BIP_RESULTS = new Set([
  "single",
  "double",
  "triple",
  "hr",
  "out",
  "foul_out",
  "gidp",
  "fielders_choice",
  "reached_on_error",
  "other",
]);

export function isChartContactBipResult(result: string): boolean {
  return CHART_CONTACT_BIP_RESULTS.has(result);
}

export function hasTaggedBattedBallType(type: ChartPaRow["batted_ball_type"]): boolean {
  return (
    type === "ground_ball" ||
    type === "line_drive" ||
    type === "fly_ball" ||
    type === "infield_fly"
  );
}

export function summarizeBattedBallCoverage(pas: ChartPaRow[]) {
  let contactBip = 0;
  let untagged = 0;
  let tagged = 0;
  for (const pa of pas) {
    if (hasTaggedBattedBallType(pa.batted_ball_type)) tagged += 1;
    if (!isChartContactBipResult(pa.result)) continue;
    contactBip += 1;
    if (!hasTaggedBattedBallType(pa.batted_ball_type)) untagged += 1;
  }
  return { contactBip, untagged, tagged };
}

export function parseDateRangeKey(raw: string | null): DateRangeKey {
  return raw === "last30" || raw === "last7" ? raw : "season";
}

export function parseInningBucket(raw: string | null): InningBucketKey {
  return raw === "1-3" || raw === "4-6" || raw === "7+" ? raw : "all";
}

export function parsePitchHand(raw: string | null): PitchHandFilter {
  return raw === "L" || raw === "R" ? raw : "all";
}

export function parseLeaderSort(raw: string | null): "pa" | "ops" | "avg" {
  return raw === "ops" || raw === "avg" ? raw : "pa";
}

export function inInningBucket(inning: number | null, bucket: InningBucketKey): boolean {
  if (bucket === "all") return true;
  if (inning == null) return false;
  if (bucket === "1-3") return inning >= 1 && inning <= 3;
  if (bucket === "4-6") return inning >= 4 && inning <= 6;
  return inning >= 7;
}

export function cutoffForRange(range: DateRangeKey): Date | null {
  if (range === "season") return null;
  const now = new Date();
  now.setDate(now.getDate() - (range === "last7" ? 7 : 30));
  return now;
}

export function gamePassesDate(game: Game, cutoff: Date | null): boolean {
  if (cutoff == null || !game.date) return true;
  const d = new Date(game.date);
  return !Number.isNaN(d.getTime()) && d >= cutoff;
}

export function gamePassesOpp(game: Game, opp: string): boolean {
  if (opp === "all") return true;
  const gOpp = game.our_side === "home" ? game.away_team : game.home_team;
  return gOpp === opp;
}

export function sprayResultLabel(spray: SprayResultFilterKey): string {
  if (spray === "hits") return "Hits";
  if (spray === "outs") return "Outs";
  return "Hits + outs";
}

export function buildChartsFilterChips(f: ChartUrlFilters): ChartsFilterChip[] {
  const inning =
    f.inning === "all"
      ? "All innings"
      : f.inning === "1-3"
        ? "Innings 1–3"
        : f.inning === "4-6"
          ? "Innings 4–6"
          : "Inning 7+";
  const range =
    f.range === "season" ? "Season" : f.range === "last30" ? "Last 30 days" : "Last 7 days";
  return [
    { label: "Spray", value: sprayResultLabel(f.spray) },
    { label: "Range", value: range },
    { label: "Inning", value: inning },
    { label: "Opponent", value: f.opp === "all" ? "All opponents" : f.opp },
    { label: "Pitcher", value: f.phand === "all" ? "All" : f.phand === "L" ? "LHP" : "RHP" },
    { label: "RISP", value: f.rispOnly ? "Runners on 2nd/3rd only" : "Off" },
  ];
}

export function buildChartsFilterSummary(f: ChartUrlFilters): string {
  return buildChartsFilterChips(f)
    .map((c) => `${c.label}: ${c.value}`)
    .join(" · ");
}

export function chartsFiltersAreDefault(f: ChartUrlFilters): boolean {
  return (
    f.spray === "both" &&
    f.range === "season" &&
    f.inning === "all" &&
    f.opp === "all" &&
    !f.rispOnly &&
    f.phand === "all"
  );
}

export function stripDefaultSearchParams(sp: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(sp.toString());
  if (!next.has("spray") || next.get("spray") === "both") next.delete("spray");
  if (!next.has("range") || next.get("range") === "season") next.delete("range");
  if (!next.has("inning") || next.get("inning") === "all") next.delete("inning");
  if (!next.has("opp") || next.get("opp") === "all") next.delete("opp");
  if (next.get("risp") !== "1") next.delete("risp");
  if (!next.has("phand") || next.get("phand") === "all") next.delete("phand");
  if (!next.has("leaderSort") || next.get("leaderSort") === "pa") next.delete("leaderSort");
  next.delete("minPa");
  return next;
}

export function formatPtsDelta(currentRate: number | null, baselineRate: number | null): string | null {
  if (currentRate == null || baselineRate == null) return null;
  const d = (currentRate - baselineRate) * 100;
  if (Math.abs(d) < 0.05) return "0.0 pts";
  return `${d >= 0 ? "+" : ""}${d.toFixed(1)} pts`;
}

export function bbPerKRatio(walks: number, strikeouts: number): number | null {
  if (strikeouts > 0) return walks / strikeouts;
  return null;
}

export function formatBbPerKDisplay(walks: number, strikeouts: number): string {
  if (strikeouts > 0) return (walks / strikeouts).toFixed(2);
  if (walks > 0) return "∞";
  return "—";
}

export function formatRatioDelta(current: number | null, baseline: number | null): string | null {
  if (current == null || baseline == null) return null;
  const d = current - baseline;
  if (Math.abs(d) < 0.005) return "0.00";
  return `${d >= 0 ? "+" : ""}${d.toFixed(2)}`;
}

export function filterSprayValidated(
  rows: SprayChartRow[],
  gameById: Map<string, Game>,
  f: ChartUrlFilters
): (SprayChartRow & { hit_direction: HitDirection })[] {
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

export function filterChartPasRows(
  rows: ChartPaRow[],
  gameById: Map<string, Game>,
  f: ChartUrlFilters
): ChartPaRow[] {
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

export function effectiveBatterHand(
  bats: "L" | "R" | "S" | undefined,
  pitcherHand: "L" | "R" | null
): "L" | "R" | null {
  if (bats === "L" || bats === "R") return bats;
  if (bats === "S") {
    if (pitcherHand === "L") return "R";
    if (pitcherHand === "R") return "L";
    return null;
  }
  return null;
}

export function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
