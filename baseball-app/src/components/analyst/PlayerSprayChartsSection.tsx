"use client";

import { useMemo, useState } from "react";
import { TeamSprayChart } from "@/components/analyst/TeamSprayChart";
import {
  SPRAY_CHART_HIT_RESULTS,
  SPRAY_CHART_OUT_RESULTS,
  sprayResultMatchesFilter,
  type SprayResultFilterKey,
} from "@/lib/sprayChartFilters";
import type { AnalystPlayerSpraySplits } from "@/lib/analystPlayerSpraySplits";
import type { HitDirection } from "@/lib/types";

function filterSprayRows(
  rows: { hit_direction: HitDirection; result: string }[],
  filter: SprayResultFilterKey
) {
  return rows.filter((r) => sprayResultMatchesFilter(r.result, filter));
}

function sprayRowCounts(rows: { result: string }[] | null | undefined) {
  const list = rows ?? [];
  const n = list.length;
  const hits = list.filter((r) => SPRAY_CHART_HIT_RESULTS.has(r.result)).length;
  const outs = list.filter((r) => SPRAY_CHART_OUT_RESULTS.has(r.result)).length;
  return { n, hits, outs };
}

function toSprayChartData(rows: { hit_direction: HitDirection; result: string }[] | null | undefined) {
  return (rows ?? []).map(({ hit_direction }) => ({ hit_direction }));
}

function buildFilteredSpray(
  spraySplits: AnalystPlayerSpraySplits,
  sprayResultFilter: SprayResultFilterKey
) {
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
}

/** Narrow compare view to one platoon chart; profile keeps both. */
export type SprayPlatoonScope = "all" | "vsL" | "vsR";

/** Two-chart grid only — for profile (inside section) or compare (one column per player). */
export function PlayerSprayChartsGrid({
  spraySplits,
  sprayResultFilter,
  isSwitch = false,
  platoonScope = "all",
  chartCompact = true,
}: {
  spraySplits: AnalystPlayerSpraySplits;
  sprayResultFilter: SprayResultFilterKey;
  isSwitch?: boolean;
  /** When `vsL` / `vsR`, show only that matchup chart (compare page sample filter). */
  platoonScope?: SprayPlatoonScope;
  /** `false` on compare page: larger SVG + full width for single-platoon view. */
  chartCompact?: boolean;
}) {
  const filteredSpray = useMemo(
    () => buildFilteredSpray(spraySplits, sprayResultFilter),
    [spraySplits, sprayResultFilter]
  );

  const showL = platoonScope === "all" || platoonScope === "vsL";
  const showR = platoonScope === "all" || platoonScope === "vsR";
  const gridClass =
    showL && showR
      ? "grid gap-6 lg:grid-cols-2"
      : chartCompact
        ? "mx-auto grid w-full max-w-xl gap-6 grid-cols-1"
        : "grid w-full gap-6 grid-cols-1";

  return (
    <div className={gridClass}>
      {spraySplits.mode === "pitching" ? (
        <>
          {showL ? (
          <div className="card-tech min-w-0 rounded-lg border border-[var(--border)] p-4">
            <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-white">vs LHB</h3>
            <p className="mt-1 text-xs tabular-nums">
              <span className="text-[var(--accent)]">{sprayRowCounts(filteredSpray.vsL).n}</span>
              <span className="text-white"> PA: </span>
              <span className="text-[var(--accent)]">{sprayRowCounts(filteredSpray.vsL).hits}</span>
              <span className="text-white"> Hits</span>
              <span className="text-white"> · </span>
              <span className="text-[var(--accent)]">{sprayRowCounts(filteredSpray.vsL).outs}</span>
              <span className="text-white"> Outs</span>
            </p>
            <div className="mt-3">
              <TeamSprayChart data={toSprayChartData(filteredSpray.vsL)} hand={spraySplits.vsL.hand} compact={chartCompact} />
            </div>
          </div>
          ) : null}
          {showR ? (
          <div className="card-tech min-w-0 rounded-lg border border-[var(--border)] p-4">
            <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-white">vs RHB</h3>
            <p className="mt-1 text-xs tabular-nums">
              <span className="text-[var(--accent)]">{sprayRowCounts(filteredSpray.vsR).n}</span>
              <span className="text-white"> PA: </span>
              <span className="text-[var(--accent)]">{sprayRowCounts(filteredSpray.vsR).hits}</span>
              <span className="text-white"> Hits</span>
              <span className="text-white"> · </span>
              <span className="text-[var(--accent)]">{sprayRowCounts(filteredSpray.vsR).outs}</span>
              <span className="text-white"> Outs</span>
            </p>
            <div className="mt-3">
              <TeamSprayChart data={toSprayChartData(filteredSpray.vsR)} hand={spraySplits.vsR.hand} compact={chartCompact} />
            </div>
          </div>
          ) : null}
        </>
      ) : (
        <>
          {showL ? (
          <div className="card-tech min-w-0 rounded-lg border border-[var(--border)] p-4">
            {spraySplits.vsL ? (
              <>
                <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-white">
                  {isSwitch
                    ? `${spraySplits.vsL.hand === "R" ? "RHB" : "LHB"} vs LHP`
                    : "vs LHP"}
                </h3>
                <p className="mt-1 text-xs tabular-nums">
                  <span className="text-[var(--accent)]">{sprayRowCounts(filteredSpray.vsL ?? []).n}</span>
                  <span className="text-white"> PA: </span>
                  <span className="text-[var(--accent)]">{sprayRowCounts(filteredSpray.vsL ?? []).hits}</span>
                  <span className="text-white"> Hits</span>
                  <span className="text-white"> · </span>
                  <span className="text-[var(--accent)]">{sprayRowCounts(filteredSpray.vsL ?? []).outs}</span>
                  <span className="text-white"> Outs</span>
                </p>
                <div className="mt-3">
                  <TeamSprayChart
                    data={toSprayChartData(filteredSpray.vsL ?? [])}
                    hand={spraySplits.vsL.hand}
                    compact={chartCompact}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No vs LHP spray chart available.</p>
            )}
          </div>
          ) : null}
          {showR ? (
          <div className="card-tech min-w-0 rounded-lg border border-[var(--border)] p-4">
            {spraySplits.vsR ? (
              <>
                <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-white">
                  {isSwitch
                    ? `${spraySplits.vsR.hand === "R" ? "RHB" : "LHB"} vs RHP`
                    : "vs RHP"}
                </h3>
                <p className="mt-1 text-xs tabular-nums">
                  <span className="text-[var(--accent)]">{sprayRowCounts(filteredSpray.vsR ?? []).n}</span>
                  <span className="text-white"> PA: </span>
                  <span className="text-[var(--accent)]">{sprayRowCounts(filteredSpray.vsR ?? []).hits}</span>
                  <span className="text-white"> Hits</span>
                  <span className="text-white"> · </span>
                  <span className="text-[var(--accent)]">{sprayRowCounts(filteredSpray.vsR ?? []).outs}</span>
                  <span className="text-white"> Outs</span>
                </p>
                <div className="mt-3">
                  <TeamSprayChart
                    data={toSprayChartData(filteredSpray.vsR ?? [])}
                    hand={spraySplits.vsR.hand}
                    compact={chartCompact}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No vs RHP spray chart available.</p>
            )}
          </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export interface PlayerSprayChartsSectionProps {
  spraySplits: AnalystPlayerSpraySplits | null;
  /** Switch hitter: adjusts vs LHP / vs RHP labels */
  isSwitch?: boolean;
  /** Controlled filter (e.g. compare page syncs two players) */
  sprayResultFilter?: SprayResultFilterKey;
  onSprayResultFilterChange?: (v: SprayResultFilterKey) => void;
}

export function PlayerSprayChartsSection({
  spraySplits,
  isSwitch = false,
  sprayResultFilter: controlledFilter,
  onSprayResultFilterChange,
}: PlayerSprayChartsSectionProps) {
  const [internalFilter, setInternalFilter] = useState<SprayResultFilterKey>("hits");
  const sprayResultFilter = controlledFilter ?? internalFilter;
  const setSprayResultFilter = onSprayResultFilterChange ?? setInternalFilter;

  if (!spraySplits) return null;

  return (
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
      <PlayerSprayChartsGrid
        spraySplits={spraySplits}
        sprayResultFilter={sprayResultFilter}
        isSwitch={isSwitch}
      />
    </section>
  );
}
