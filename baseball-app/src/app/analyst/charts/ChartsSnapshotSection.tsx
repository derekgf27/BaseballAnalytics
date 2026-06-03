"use client";

import type { CSSProperties } from "react";
import { fmtDecimalNoLeadingZero } from "@/lib/format";
import type { LeaderSortKey } from "./chartTypes";
import { CHARTS_SAMPLE_WARNING_BIP, CHARTS_SAMPLE_WARNING_PA } from "./chartTypes";
import { formatBbPerKDisplay } from "./chartsFilters";
import { ChartsPlayerLeaders } from "./ChartsPlayerLeaders";
import type { ChartsDerivedData, PlayerLeaderRow } from "./useChartsDerivedData";

function BattedBallMixRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : null;
  const barPct = total > 0 && value > 0 ? (value / total) * 100 : 0;

  return (
    <div className="grid grid-cols-[minmax(4.5rem,5.75rem)_1fr_auto] items-center gap-2">
      <span className="text-[var(--text-muted)]">{label}</span>
      <div className="h-2 rounded-full bg-[var(--bg-card)]">
        <div
          className="h-2 rounded-full bg-[var(--neo-accent)]/80"
          style={{ width: `${barPct}%` } as CSSProperties}
        />
      </div>
      <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-[var(--neo-accent)]">
        {value}
        {pct != null ? <span className="text-[var(--text)]"> ({pct}%)</span> : null}
      </div>
    </div>
  );
}

function PlateDisciplineStatCard({
  label,
  value,
  sample,
}: {
  label: string;
  value: string;
  sample?: string;
}) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
      <div className="text-[var(--text-muted)]">{label}</div>
      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        <div className="text-sm font-semibold text-[var(--neo-accent)]">{value}</div>
        {sample ? (
          <div className="shrink-0 text-right text-[10px] leading-snug text-[var(--text-faint)]">{sample}</div>
        ) : null}
      </div>
    </div>
  );
}

type ChartsSnapshotSectionProps = {
  filteredPaCount: number;
  snapshotSmallSample: boolean;
  teamKPct: number | null;
  data: Pick<
    ChartsDerivedData,
    | "battedBallCounts"
    | "battedBallTotal"
    | "battedBallContactBip"
    | "battedBallSmallSample"
    | "battedBallGbRate"
    | "rispHits"
    | "rispAb"
    | "rispPas"
    | "lateObjectiveHits"
    | "lateObjectiveAb"
    | "lateObjectivePas"
    | "pitchOutcomeTotals"
    | "filteredChartPas"
  >;
  playerObjectiveLeaders: PlayerLeaderRow[];
  leaderSort: LeaderSortKey;
  controlsDisabled?: boolean;
  onLeaderSortChange: (sort: LeaderSortKey) => void;
};

export function ChartsSnapshotSection({
  filteredPaCount,
  snapshotSmallSample,
  teamKPct,
  data,
  playerObjectiveLeaders,
  leaderSort,
  controlsDisabled,
  onLeaderSortChange,
}: ChartsSnapshotSectionProps) {
  const {
    battedBallCounts,
    battedBallTotal,
    battedBallContactBip,
    battedBallSmallSample,
    battedBallGbRate,
    rispHits,
    rispAb,
    rispPas,
    lateObjectiveHits,
    lateObjectiveAb,
    lateObjectivePas,
    pitchOutcomeTotals,
    filteredChartPas,
  } = data;

  return (
    <section
      id="charts-snapshot"
      data-pdf-avoid-break
      className="charts-pdf-block scroll-mt-28 overflow-visible rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,var(--bg-elevated),var(--bg-card))] p-4 md:p-5"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <h3 className="font-display text-base font-semibold tracking-wide text-[var(--neo-accent)]">Objective Team Snapshot</h3>
          {snapshotSmallSample ? (
            <p className="mt-1 text-xs text-amber-300">
              Small sample: fewer than {CHARTS_SAMPLE_WARNING_PA} plate appearances in this filter.
            </p>
          ) : null}
        </div>
        <div className="rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
          Sample PAs: <span className="font-semibold text-[var(--neo-accent)]">{filteredPaCount}</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-3">
            <div className="charts-snapshot-card-header mb-2 flex flex-nowrap items-center justify-between gap-2">
              <div className="charts-snapshot-section-title shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[var(--neo-accent)]">
                Batted-Ball Mix
              </div>
              <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-[var(--neo-accent)]">
                {battedBallContactBip} BIP
              </div>
            </div>
            {battedBallSmallSample ? (
              <p className="mb-2 text-[10px] text-amber-300">
                Small sample: fewer than {CHARTS_SAMPLE_WARNING_BIP} tagged balls in play.
              </p>
            ) : null}
            {battedBallGbRate != null && battedBallGbRate >= 0.45 ? (
              <p className="mb-2 text-[10px] text-[var(--text-muted)]">Ground-ball heavy contact profile.</p>
            ) : null}
            <div className="space-y-2 text-xs tabular-nums">
              {[
                { label: "Ground ball", value: battedBallCounts.gb },
                { label: "Line drive", value: battedBallCounts.ld },
                { label: "Fly ball", value: battedBallCounts.fb },
                { label: "Infield fly", value: battedBallCounts.iffb },
              ].map((item) => (
                <BattedBallMixRow key={item.label} label={item.label} value={item.value} total={battedBallTotal} />
              ))}
            </div>
          </div>

          <ChartsPlayerLeaders
            leaders={playerObjectiveLeaders}
            leaderSort={leaderSort}
            controlsDisabled={controlsDisabled}
            onLeaderSortChange={onLeaderSortChange}
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-3">
            <div className="charts-snapshot-section-title mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--neo-accent)]">
              Situational Results
            </div>
            <div className="space-y-2 text-xs tabular-nums">
              <div className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
                <div className="text-[var(--text-muted)]">RISP</div>
                <div className="mt-0.5 flex items-baseline justify-between gap-2">
                  <div className="text-sm font-semibold text-[var(--neo-accent)]">
                    {rispHits}/{rispAb}
                    <span className="ml-1 text-xs text-[var(--text)]">
                      ({rispAb > 0 ? fmtDecimalNoLeadingZero(rispHits / rispAb, 3) : "—"})
                    </span>
                  </div>
                  <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-[var(--neo-accent)]">
                    {rispPas.length} PAs
                  </div>
                </div>
              </div>
              <div className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
                <div className="text-[var(--text-muted)]">Inning 7+</div>
                <div className="mt-0.5 flex items-baseline justify-between gap-2">
                  <div className="text-sm font-semibold text-[var(--neo-accent)]">
                    {lateObjectiveHits}/{lateObjectiveAb}
                    <span className="ml-1 text-xs text-[var(--text)]">
                      ({lateObjectiveAb > 0 ? fmtDecimalNoLeadingZero(lateObjectiveHits / lateObjectiveAb, 3) : "—"})
                    </span>
                  </div>
                  <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-[var(--neo-accent)]">
                    {lateObjectivePas.length} PAs
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-3">
            <div className="charts-snapshot-section-title mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--neo-accent)]">
              Plate Discipline ({filteredChartPas.length} PAs)
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
              <PlateDisciplineStatCard
                label="Strike%"
                value={
                  pitchOutcomeTotals.totalPitches > 0
                    ? `${((pitchOutcomeTotals.totalStrikes / pitchOutcomeTotals.totalPitches) * 100).toFixed(1)}%`
                    : "—"
                }
              />
              <PlateDisciplineStatCard
                label="FPS%"
                value={
                  pitchOutcomeTotals.firstPitchOpportunities > 0
                    ? `${((pitchOutcomeTotals.firstPitchStrikes / pitchOutcomeTotals.firstPitchOpportunities) * 100).toFixed(1)}%`
                    : "—"
                }
                sample={
                  pitchOutcomeTotals.firstPitchOpportunities > 0
                    ? `${pitchOutcomeTotals.firstPitchStrikes}/${pitchOutcomeTotals.firstPitchOpportunities} PAs`
                    : undefined
                }
              />
              <PlateDisciplineStatCard
                label="K%"
                value={teamKPct != null ? `${(teamKPct * 100).toFixed(1)}%` : "—"}
                sample={
                  filteredChartPas.length > 0 ? String(pitchOutcomeTotals.strikeouts) : undefined
                }
              />
              <PlateDisciplineStatCard
                label="BB%"
                value={
                  filteredChartPas.length > 0
                    ? `${((pitchOutcomeTotals.walks / filteredChartPas.length) * 100).toFixed(1)}%`
                    : "—"
                }
                sample={filteredChartPas.length > 0 ? String(pitchOutcomeTotals.walks) : undefined}
              />
              <PlateDisciplineStatCard
                label="BB/K"
                value={formatBbPerKDisplay(pitchOutcomeTotals.walks, pitchOutcomeTotals.strikeouts)}
                sample={
                  pitchOutcomeTotals.strikeouts > 0
                    ? `${pitchOutcomeTotals.walks} BB / ${pitchOutcomeTotals.strikeouts} K`
                    : pitchOutcomeTotals.walks > 0
                      ? `${pitchOutcomeTotals.walks} BB / 0 K`
                      : undefined
                }
              />
              <PlateDisciplineStatCard
                label="P/PA"
                value={
                  pitchOutcomeTotals.totalPaWithPitchCount > 0
                    ? (pitchOutcomeTotals.totalPitches / pitchOutcomeTotals.totalPaWithPitchCount).toFixed(2)
                    : "—"
                }
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
