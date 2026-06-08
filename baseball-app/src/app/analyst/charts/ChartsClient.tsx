"use client";

import dynamic from "next/dynamic";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { parseSprayResultFilterKey } from "@/lib/sprayChartFilters";
import { unmountCaptureStyles } from "@/lib/reports/htmlElementPdf";
import { downloadChartsReportPdf } from "@/lib/reports/chartsReportPdf";
import type { Game, Player } from "@/lib/types";
import type { ChartPaRow, ChartUrlFilters, LeaderSortKey, SprayChartRow } from "./chartTypes";
import {
  buildChartsFilterChips,
  buildChartsFilterSummary,
  chartsFiltersAreDefault,
  parseDateRangeKey,
  parseInningBucket,
  parseLeaderSort,
  parsePitchHand,
  stripDefaultSearchParams,
  waitForNextPaint,
} from "./chartsFilters";
import { ChartsFilterBar } from "./ChartsFilterBar";
import { ChartsKpiStrip } from "./ChartsKpiStrip";
import { ChartsPdfFilters } from "./ChartsPdfFilters";
import { ChartsSpraySection } from "./ChartsSpraySection";
import { useChartsDerivedData } from "./useChartsDerivedData";
import { useDeferredMount } from "./useDeferredMount";
import { usePlayerProfileHref } from "@/lib/usePlayerProfileHref";

const ChartsSnapshotSection = dynamic(
  () => import("./ChartsSnapshotSection").then((m) => ({ default: m.ChartsSnapshotSection })),
  {
    loading: () => (
      <div
        className="animate-pulse rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-8"
        aria-label="Loading team snapshot"
      />
    ),
  }
);

export interface ChartsClientProps {
  sprayData: SprayChartRow[];
  pitchingSprayData: SprayChartRow[];
  chartPas: ChartPaRow[];
  players: Player[];
  games: Game[];
}

export function ChartsClient({
  sprayData,
  pitchingSprayData,
  chartPas,
  players,
  games,
}: ChartsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const playerProfileHref = usePlayerProfileHref();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlFilters: ChartUrlFilters = useMemo(
    () => ({
      spray: parseSprayResultFilterKey(searchParams.get("spray")),
      range: parseDateRangeKey(searchParams.get("range")),
      inning: parseInningBucket(searchParams.get("inning")),
      opp: searchParams.get("opp") ?? "all",
      rispOnly: searchParams.get("risp") === "1",
      phand: parsePitchHand(searchParams.get("phand")),
    }),
    [searchParams]
  );

  const leaderSort = parseLeaderSort(searchParams.get("leaderSort"));

  const filterChips = useMemo(() => buildChartsFilterChips(urlFilters), [urlFilters]);
  const filterSummary = useMemo(() => buildChartsFilterSummary(urlFilters), [urlFilters]);
  const filtersAtDefault = chartsFiltersAreDefault(urlFilters);

  const baselineContextFilters: ChartUrlFilters = useMemo(
    () => ({
      spray: urlFilters.spray,
      range: "season",
      inning: "all",
      opp: "all",
      rispOnly: false,
      phand: "all",
    }),
    [urlFilters.spray]
  );

  const derived = useChartsDerivedData({
    sprayData,
    pitchingSprayData,
    chartPas,
    players,
    games,
    urlFilters,
    baselineContextFilters,
    leaderSort,
  });

  const pushSearch = useCallback(
    (next: URLSearchParams) => {
      const cleaned = stripDefaultSearchParams(next);
      const qs = cleaned.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router]
  );

  const setManyParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === "") sp.delete(k);
        else sp.set(k, v);
      }
      pushSearch(sp);
    },
    [pushSearch, searchParams]
  );

  const resetFilters = useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    for (const key of ["spray", "range", "inning", "opp", "risp", "phand", "leaderSort", "minPa"]) {
      sp.delete(key);
    }
    pushSearch(sp);
  }, [pushSearch, searchParams]);

  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastExportMode, setLastExportMode] = useState<"full" | "snapshot" | null>(null);
  const [snapshotForceMount, setSnapshotForceMount] = useState(false);

  const fullCaptureRef = useRef<HTMLDivElement>(null);
  const snapshotCaptureRef = useRef<HTMLDivElement>(null);
  const { sentinelRef: snapshotSentinelRef, ready: snapshotDeferredReady } = useDeferredMount("320px");
  const snapshotReady = snapshotDeferredReady || snapshotForceMount;

  useEffect(() => () => unmountCaptureStyles(), []);

  const controlsDisabled = exportingPdf;

  const runExport = useCallback(
    async (mode: "full" | "snapshot") => {
      if (derived.chartsEmpty) {
        setExportError("No chart data for the current filters.");
        return;
      }
      setSnapshotForceMount(true);
      await waitForNextPaint();
      const root = mode === "snapshot" ? snapshotCaptureRef.current : fullCaptureRef.current;
      if (!root) {
        setExportError(mode === "snapshot" ? "Snapshot is not ready to export." : "Charts are not ready to export.");
        return;
      }
      setExportError(null);
      setLastExportMode(mode);
      flushSync(() => setExportingPdf(true));
      await waitForNextPaint();
      try {
        await downloadChartsReportPdf(root, filterSummary, mode);
      } catch (err) {
        const detail = err instanceof Error ? err.message : null;
        setExportError(detail ? `Could not build charts PDF: ${detail}` : "Could not build charts PDF.");
      } finally {
        setExportingPdf(false);
      }
    },
    [derived.chartsEmpty, filterSummary]
  );

  const {
    totalBatterBip,
    totalBatterHitsOnBip,
    batterHitPct,
    baselineBatterHitPct,
    teamKPct,
    teamBBPct,
    baselineKPct,
    filteredChartPas,
    chartsEmpty,
    snapshotSmallSample,
    rhb,
    lhb,
    pitchingLhb,
    pitchingRhb,
    playerObjectiveLeaders,
    battedBallCounts,
    battedBallTotal,
    rispHits,
    rispAb,
    rispPas,
    lateObjectiveHits,
    lateObjectiveAb,
    lateObjectivePas,
    pitchOutcomeTotals,
  } = derived;

  return (
    <div className={`charts-page space-y-8${isPending ? " opacity-95" : ""}`}>
      <ChartsFilterBar
        urlFilters={urlFilters}
        opponents={derived.opponents}
        filtersAtDefault={filtersAtDefault}
        controlsDisabled={controlsDisabled}
        isPending={isPending}
        exportError={exportError}
        exportingPdf={exportingPdf}
        chartsEmpty={chartsEmpty}
        onReset={resetFilters}
        onSetManyParams={setManyParams}
        onExportFull={() => void runExport("full")}
        onExportSnapshot={() => void runExport("snapshot")}
        onRetryExport={() => lastExportMode && void runExport(lastExportMode)}
        lastExportMode={lastExportMode}
      />

      {chartsEmpty ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-6 py-12 text-center">
          <p className="font-display text-sm font-semibold text-[var(--text)]">No data for this filter</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Try widening the date range, clearing RISP or pitcher filters, or resetting all filters.
          </p>
          <button
            type="button"
            className="mt-4 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--neo-accent)] hover:border-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
            onClick={resetFilters}
          >
            Reset filters
          </button>
        </div>
      ) : null}

      {!chartsEmpty && (
        <div
          ref={fullCaptureRef}
          className={`charts-report-root space-y-8${exportingPdf && lastExportMode === "full" ? " reports-print-area reports-pdf-capture" : ""}`}
        >
          <header
            className={`charts-pdf-header border-b border-[var(--border)] pb-4${exportingPdf ? "" : " sr-only"}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--text)]">Team charts</h1>
              <p className="text-[10px] tabular-nums text-[var(--text-muted)]">
                Exported {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <p className="charts-pdf-applied-label mt-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--neo-accent)]">
              Applied filters
            </p>
            <ChartsPdfFilters chips={filterChips} />
            <p className="charts-pdf-samples mt-3 text-xs leading-relaxed text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text)]">Sample in this export: </span>
              <span className="tabular-nums text-[var(--neo-accent)]">{totalBatterBip}</span> batter BIP ·{" "}
              <span className="tabular-nums text-[var(--neo-accent)]">{derived.totalPitchingBip}</span> pitching BIP ·{" "}
              <span className="tabular-nums text-[var(--neo-accent)]">{filteredChartPas.length}</span> plate appearances
            </p>
          </header>

          <ChartsKpiStrip
            filteredPaCount={filteredChartPas.length}
            totalBatterBip={totalBatterBip}
            batterHitPct={batterHitPct}
            baselineBatterHitPct={baselineBatterHitPct}
            teamKPct={teamKPct}
            baselineKPct={baselineKPct}
            teamBBPct={teamBBPct}
          />

          <ChartsSpraySection
            spray={urlFilters.spray}
            rhb={rhb}
            lhb={lhb}
            pitchingLhb={pitchingLhb}
            pitchingRhb={pitchingRhb}
          />

          <div ref={snapshotSentinelRef} className="h-px w-full" aria-hidden />

          {snapshotReady ? (
            <div
              ref={snapshotCaptureRef}
              className={
                exportingPdf && lastExportMode === "snapshot"
                  ? "charts-report-root reports-print-area reports-pdf-capture"
                  : undefined
              }
            >
              <ChartsSnapshotSection
                filteredPaCount={filteredChartPas.length}
                snapshotSmallSample={snapshotSmallSample}
                teamKPct={teamKPct}
                data={{
                  battedBallCounts,
                  battedBallTotal,
                  battedBallContactBip: derived.battedBallContactBip,
                  battedBallSmallSample: derived.battedBallSmallSample,
                  battedBallGbRate: derived.battedBallGbRate,
                  rispHits,
                  rispAb,
                  rispPas,
                  lateObjectiveHits,
                  lateObjectiveAb,
                  lateObjectivePas,
                  pitchOutcomeTotals,
                  filteredChartPas,
                }}
                playerObjectiveLeaders={playerObjectiveLeaders}
                leaderSort={leaderSort}
                controlsDisabled={controlsDisabled}
                onLeaderSortChange={(sort) => setManyParams({ leaderSort: sort === "pa" ? null : sort })}
                playerProfileHref={playerProfileHref}
              />
            </div>
          ) : (
            <div
              className="animate-pulse rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-8"
              aria-label="Loading team snapshot"
            />
          )}
        </div>
      )}
    </div>
  );
}
