"use client";

import { useMemo, useState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { PlayerTagList } from "@/components/ui/PlayerTag";
import { formatPPa } from "@/lib/format";
import { formatHeight } from "@/lib/height";
import { BATTING_STAT_HEADER_TOOLTIPS } from "@/lib/statHeaderTooltips";
import { TeamSprayChart } from "@/components/analyst/TeamSprayChart";
import {
  SPRAY_CHART_HIT_RESULTS,
  SPRAY_CHART_OUT_RESULTS,
  sprayResultMatchesFilter,
  type SprayResultFilterKey,
} from "@/lib/sprayChartFilters";
import type { HitDirection, Player, BattingStatsWithSplits } from "@/lib/types";

const TREND_STYLES = {
  hot: "bg-[var(--decision-hot-dim)] text-[var(--decision-hot)] border-[var(--decision-hot)]/30",
  cold: "bg-[var(--decision-red-dim)] text-[var(--decision-red)] border-[var(--decision-red)]/30",
  neutral: "bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border)]",
} as const;

interface CoachPlayerDetailClientProps {
  player: Player;
  battingSplits: BattingStatsWithSplits | null;
  spraySplits:
    | ({
        mode: "batting";
        vsL: {
          hand: "L" | "R";
          data: { hit_direction: HitDirection; result: string }[];
          line: { pa: number; h: number; ab: number };
        } | null;
        vsR: {
          hand: "L" | "R";
          data: { hit_direction: HitDirection; result: string }[];
          line: { pa: number; h: number; ab: number };
        } | null;
      })
    | {
        mode: "pitching";
        vsL: {
          hand: "L";
          data: { hit_direction: HitDirection; result: string }[];
          line: { pa: number; h: number; ab: number };
        };
        vsR: {
          hand: "R";
          data: { hit_direction: HitDirection; result: string }[];
          line: { pa: number; h: number; ab: number };
        };
      }
    | null;
}

/** Parse YYYY-MM-DD as local date to avoid UTC-off-by-one when displaying. */
function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function normalizeHand(hand: string | null | undefined): string | null {
  if (hand == null || hand === "") return null;
  const code = hand.toUpperCase();
  if (code.startsWith("L")) return "Left";
  if (code.startsWith("R")) return "Right";
  if (code.startsWith("S")) return "Switch";
  return hand;
}

function formatAvg(n: number): string {
  const s = n.toFixed(3);
  return s.startsWith("0.") ? s.slice(1) : s;
}

export function CoachPlayerDetailClient({ player, battingSplits, spraySplits }: CoachPlayerDetailClientProps) {
  const isSwitch = player.bats?.toUpperCase().startsWith("S") ?? false;
  const [sprayResultFilter, setSprayResultFilter] = useState<SprayResultFilterKey>("hits");

  const filterSprayRows = (
    rows: { hit_direction: HitDirection; result: string }[],
    filter: SprayResultFilterKey
  ) => rows.filter((r) => sprayResultMatchesFilter(r.result, filter));

  const sprayRowCounts = (rows: { result: string }[] | null | undefined) => {
    const list = rows ?? [];
    const n = list.length;
    const hits = list.filter((r) => SPRAY_CHART_HIT_RESULTS.has(r.result)).length;
    const outs = list.filter((r) => SPRAY_CHART_OUT_RESULTS.has(r.result)).length;
    return { n, hits, outs };
  };

  const toSprayChartData = (rows: { hit_direction: HitDirection; result: string }[] | null | undefined) =>
    (rows ?? []).map(({ hit_direction }) => ({ hit_direction }));

  const filteredSpray = useMemo(() => {
    if (!spraySplits) return null;
    if (spraySplits.mode === "pitching") {
      return {
        mode: "pitching" as const,
        vsL: filterSprayRows(spraySplits.vsL.data, sprayResultFilter),
        vsR: filterSprayRows(spraySplits.vsR.data, sprayResultFilter),
      };
    }
    return {
      mode: "batting" as const,
      vsL: spraySplits.vsL ? filterSprayRows(spraySplits.vsL.data, sprayResultFilter) : null,
      vsR: spraySplits.vsR ? filterSprayRows(spraySplits.vsR.data, sprayResultFilter) : null,
    };
  }, [spraySplits, sprayResultFilter]);

  const trend = "neutral";
  const trendStyle = TREND_STYLES[trend];
  const trendLabel = "Neutral";

  const today = new Date();
  const age =
    player.birth_date != null && player.birth_date !== ""
      ? (() => {
          const b = parseLocalDate(player.birth_date);
          let a = today.getFullYear() - b.getFullYear();
          if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate()))
            a--;
          return a;
        })()
      : null;

  const formatBirthDate = (d: string) => {
    const date = parseLocalDate(d);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const batsLabel = normalizeHand(player.bats);
  const throwsLabel = normalizeHand(player.throws);

  const info = {
    jersey: player.jersey != null && player.jersey !== "" ? `#${player.jersey}` : null,
    positions: player.positions?.length ? player.positions.join(", ") : null,
    batsThrows:
      batsLabel != null || throwsLabel != null
        ? `${batsLabel ?? "—"} / ${throwsLabel ?? "—"}`
        : null,
    heightWeight:
      player.height_in != null || player.weight_lb != null
        ? `${player.height_in != null ? formatHeight(player.height_in) : ""}${
            player.height_in != null && player.weight_lb != null ? " " : ""
          }${player.weight_lb != null ? `${player.weight_lb} lb` : ""}`.trim()
        : null,
    hometown: player.hometown?.trim() || null,
    birthday: player.birth_date ? formatBirthDate(player.birth_date) : null,
    age: age != null ? `${age} yrs` : null,
  };

  const rows = [
    info.jersey && { label: "Jersey", value: info.jersey },
    info.positions && { label: "Positions", value: info.positions },
    info.batsThrows && { label: "Bats / Throws", value: info.batsThrows },
    info.heightWeight && { label: "Height · Weight", value: info.heightWeight },
    info.hometown && { label: "Hometown", value: info.hometown },
    info.birthday && { label: "Birthday", value: info.birthday },
    info.age && { label: "Age", value: info.age },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="space-y-6 pb-8">
      {/* Profile header – mirror Analyst player profile layout */}
      <section className="card-tech flex flex-col gap-5 p-4 sm:flex-row sm:items-start">
        <div className="flex shrink-0 flex-row items-center gap-4 sm:w-36 sm:flex-col sm:items-center sm:gap-2">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[var(--accent-coach-dim)] text-xl font-bold text-[var(--accent-coach)] sm:h-24 sm:w-24 sm:text-2xl">
            {player.name
              .split(/\s+/)
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 sm:flex sm:w-full sm:flex-col sm:items-center sm:gap-2">
            <p className="text-left text-base font-semibold text-[var(--text)] sm:text-center sm:text-lg">
              {player.name}
            </p>
            <span
              className={`mt-1 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium sm:mt-0 ${trendStyle}`}
            >
              {trendLabel}
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
            {rows.map(({ label, value }) => (
              <div key={label} className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  {label}
                </p>
                <p className="mt-0.5 break-words text-sm font-semibold text-[var(--text)] sm:text-base">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <PlayerTagList tags={[]} />
          </div>
        </div>
      </section>

      {/* Season stats summary row (same columns as batting stats table) */}
      {battingSplits && (
        <section className="card-tech rounded-lg border border-[var(--border)] p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
            Season line
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text)]">
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.pa} className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wider">PA</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.ab} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">AB</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.h} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">H</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.double} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">2B</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.triple} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">3B</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.hr} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">HR</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.rbi} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">RBI</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.r} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">R</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.sb} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">SB</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.cs} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">CS</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.sbPct} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">SB%</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.bb} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">BB</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.ibb} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">IBB</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.hbp} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">HBP</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.so} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">SO</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.pPa} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">P/PA</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.kPct} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">K%</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.bbPct} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">BB%</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.avg} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">AVG</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.obp} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">OBP</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.slg} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">SLG</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.ops} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">OPS</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.opsPlus} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">OPS+</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.woba} className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">wOBA</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 pr-3 text-left tabular-nums text-[var(--text)]">
                    {battingSplits.overall.pa ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.ab ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.h ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.double ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.triple ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.hr ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.rbi ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.r ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.sb ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.cs ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.sbPct != null
                      ? `${(battingSplits.overall.sbPct * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.bb ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.ibb ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.hbp ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.so ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.pPa != null ? formatPPa(battingSplits.overall.pPa) : "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.kPct != null ? `${(battingSplits.overall.kPct * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.bbPct != null ? `${(battingSplits.overall.bbPct * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {formatAvg(battingSplits.overall.avg)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {formatAvg(battingSplits.overall.obp)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {formatAvg(battingSplits.overall.slg)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {formatAvg(battingSplits.overall.ops)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.opsPlus ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {formatAvg(battingSplits.overall.woba)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Card>
        <CardTitle>Strengths & weaknesses</CardTitle>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Add notes in Analyst → Players for strengths and watch list.
        </p>
      </Card>

      {/* Batting splits table (same as Analyst view) */}
      {battingSplits && (
        <div className="card-tech rounded-lg border border-[var(--border)] p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
            Batting splits
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text)]">
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.split} className="py-2 pr-4 font-semibold">Split</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.pa} className="py-2 px-2 text-right">PA</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.pPa} className="py-2 px-2 text-right">P/PA</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.avg} className="py-2 px-2 text-right">AVG</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.obp} className="py-2 px-2 text-right">OBP</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.slg} className="py-2 px-2 text-right">SLG</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.ops} className="py-2 px-2 text-right">OPS</th>
                  <th title={BATTING_STAT_HEADER_TOOLTIPS.woba} className="py-2 px-2 text-right">wOBA</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Overall", s: battingSplits.overall },
                  { label: "vs LHP", s: battingSplits.vsL },
                  { label: "vs RHP", s: battingSplits.vsR },
                  { label: "RISP", s: battingSplits.risp },
                ].map(({ label, s }) => (
                  <tr key={label} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 pr-4 font-medium text-[var(--text)]">{label}</td>
                    {s ? (
                      <>
                        <td className="py-2 px-2 text-right tabular-nums text-[var(--text)]">{s.pa ?? "—"}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-[var(--text)]">
                          {s.pPa != null ? formatPPa(s.pPa) : "—"}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums text-[var(--text)]">{formatAvg(s.avg)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-[var(--text)]">{formatAvg(s.obp)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-[var(--text)]">{formatAvg(s.slg)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-[var(--text)]">{formatAvg(s.ops)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-[var(--text)]">{formatAvg(s.woba)}</td>
                      </>
                    ) : (
                      <>
                        <td colSpan={7} className="py-2 px-2 text-right text-[var(--text-faint)]">
                          No PAs
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {spraySplits && filteredSpray && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Spray charts</h2>
            <label className="flex items-center gap-2 text-xs">
              <span className="font-display uppercase tracking-wider text-white">Filter</span>
              <select
                value={sprayResultFilter}
                onChange={(e) => setSprayResultFilter(e.target.value as SprayResultFilterKey)}
                className="rounded border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                aria-label="Spray chart result filter"
              >
                <option value="hits">Hits</option>
                <option value="outs">Outs</option>
                <option value="both">Hits + Outs</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {spraySplits.mode === "pitching"
              ? "Balls in play allowed as pitcher, split by batter handedness (switch hitters use the side they batted from vs you)."
              : "Balls in play as a batter, split by opposing pitcher handedness (switch hitters use the side they batted from)."}
          </p>
          <div className="grid gap-6 lg:grid-cols-2">
            {spraySplits.mode === "pitching" ? (
              <>
                <div className="card-tech min-w-0 rounded-lg border border-[var(--border)] p-4">
                  <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-white">vs LHB</h3>
                  <p className="mt-1 text-xs tabular-nums">
                    <span className="text-[var(--neo-accent)]">{sprayRowCounts(filteredSpray.vsL).n}</span>
                    <span className="text-white"> PA: </span>
                    <span className="text-[var(--neo-accent)]">{sprayRowCounts(filteredSpray.vsL).hits}</span>
                    <span className="text-white"> Hits</span>
                    <span className="text-white"> · </span>
                    <span className="text-[var(--neo-accent)]">{sprayRowCounts(filteredSpray.vsL).outs}</span>
                    <span className="text-white"> Outs</span>
                  </p>
                  <div className="mt-3">
                    <TeamSprayChart data={toSprayChartData(filteredSpray.vsL)} hand={spraySplits.vsL.hand} compact />
                  </div>
                </div>
                <div className="card-tech min-w-0 rounded-lg border border-[var(--border)] p-4">
                  <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-white">vs RHB</h3>
                  <p className="mt-1 text-xs tabular-nums">
                    <span className="text-[var(--neo-accent)]">{sprayRowCounts(filteredSpray.vsR).n}</span>
                    <span className="text-white"> PA: </span>
                    <span className="text-[var(--neo-accent)]">{sprayRowCounts(filteredSpray.vsR).hits}</span>
                    <span className="text-white"> Hits</span>
                    <span className="text-white"> · </span>
                    <span className="text-[var(--neo-accent)]">{sprayRowCounts(filteredSpray.vsR).outs}</span>
                    <span className="text-white"> Outs</span>
                  </p>
                  <div className="mt-3">
                    <TeamSprayChart data={toSprayChartData(filteredSpray.vsR)} hand={spraySplits.vsR.hand} compact />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="card-tech min-w-0 rounded-lg border border-[var(--border)] p-4">
                  {spraySplits.vsL ? (
                    <>
                      <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-white">
                        {isSwitch
                          ? `${spraySplits.vsL.hand === "R" ? "RHB" : "LHB"} vs LHP`
                          : "vs LHP"}
                      </h3>
                      <p className="mt-1 text-xs tabular-nums">
                        <span className="text-[var(--neo-accent)]">{sprayRowCounts(filteredSpray.vsL ?? []).n}</span>
                        <span className="text-white"> PA: </span>
                        <span className="text-[var(--neo-accent)]">{sprayRowCounts(filteredSpray.vsL ?? []).hits}</span>
                        <span className="text-white"> Hits</span>
                        <span className="text-white"> · </span>
                        <span className="text-[var(--neo-accent)]">{sprayRowCounts(filteredSpray.vsL ?? []).outs}</span>
                        <span className="text-white"> Outs</span>
                      </p>
                      <div className="mt-3">
                        <TeamSprayChart
                          data={toSprayChartData(filteredSpray.vsL ?? [])}
                          hand={spraySplits.vsL.hand}
                          compact
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">No vs LHP spray chart available.</p>
                  )}
                </div>
                <div className="card-tech min-w-0 rounded-lg border border-[var(--border)] p-4">
                  {spraySplits.vsR ? (
                    <>
                      <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-white">
                        {isSwitch
                          ? `${spraySplits.vsR.hand === "R" ? "RHB" : "LHB"} vs RHP`
                          : "vs RHP"}
                      </h3>
                      <p className="mt-1 text-xs tabular-nums">
                        <span className="text-[var(--neo-accent)]">{sprayRowCounts(filteredSpray.vsR ?? []).n}</span>
                        <span className="text-white"> PA: </span>
                        <span className="text-[var(--neo-accent)]">{sprayRowCounts(filteredSpray.vsR ?? []).hits}</span>
                        <span className="text-white"> Hits</span>
                        <span className="text-white"> · </span>
                        <span className="text-[var(--neo-accent)]">{sprayRowCounts(filteredSpray.vsR ?? []).outs}</span>
                        <span className="text-white"> Outs</span>
                      </p>
                      <div className="mt-3">
                        <TeamSprayChart
                          data={toSprayChartData(filteredSpray.vsR ?? [])}
                          hand={spraySplits.vsR.hand}
                          compact
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">No vs RHP spray chart available.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
