"use client";

import { useCallback, useState } from "react";
import type { SprayResultFilterKey } from "@/lib/sprayChartFilters";
import type { ChartUrlFilters, DateRangeKey, InningBucketKey, PitchHandFilter } from "./chartTypes";
import { chartsSelectClass } from "./chartsUi";

type ChartsFilterBarProps = {
  urlFilters: ChartUrlFilters;
  opponents: string[];
  filtersAtDefault: boolean;
  controlsDisabled: boolean;
  isPending: boolean;
  exportError: string | null;
  exportingPdf: boolean;
  chartsEmpty: boolean;
  onReset: () => void;
  onSetManyParams: (patch: Record<string, string | null | undefined>) => void;
  onExportFull: () => void;
  onExportSnapshot: () => void;
  onRetryExport: () => void;
  lastExportMode: "full" | "snapshot" | null;
};

export function ChartsFilterBar({
  urlFilters,
  opponents,
  filtersAtDefault,
  controlsDisabled,
  isPending,
  exportError,
  exportingPdf,
  chartsEmpty,
  onReset,
  onSetManyParams,
  onExportFull,
  onExportSnapshot,
  onRetryExport,
  lastExportMode,
}: ChartsFilterBarProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "ok" | "fail">("idle");

  const copyFilterLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyStatus("ok");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("fail");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    }
  }, []);

  const filterFields = (
    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
      <div className="flex flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
        <label htmlFor="charts-filter-spray" className="font-display text-[10px] uppercase tracking-wider text-[var(--neo-accent)]">
          Spray result
        </label>
        <select
          id="charts-filter-spray"
          disabled={controlsDisabled}
          value={urlFilters.spray}
          onChange={(e) => {
            const v = e.target.value as SprayResultFilterKey;
            onSetManyParams({ spray: v === "both" ? null : v });
          }}
          className={chartsSelectClass}
        >
          <option value="both">Hits + outs</option>
          <option value="hits">Hits</option>
          <option value="outs">Outs</option>
        </select>
      </div>
      <div className="flex flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
        <label htmlFor="charts-filter-range" className="font-display text-[10px] uppercase tracking-wider text-[var(--neo-accent)]">
          Range
        </label>
        <select
          id="charts-filter-range"
          disabled={controlsDisabled}
          value={urlFilters.range}
          onChange={(e) => {
            const v = e.target.value as DateRangeKey;
            onSetManyParams({ range: v === "season" ? null : v });
          }}
          className={chartsSelectClass}
        >
          <option value="season">Season</option>
          <option value="last30">Last 30</option>
          <option value="last7">Last 7</option>
        </select>
      </div>
      <div className="flex flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
        <label htmlFor="charts-filter-inning" className="font-display text-[10px] uppercase tracking-wider text-[var(--neo-accent)]">
          Inning
        </label>
        <select
          id="charts-filter-inning"
          disabled={controlsDisabled}
          value={urlFilters.inning}
          onChange={(e) => {
            const v = e.target.value as InningBucketKey;
            onSetManyParams({ inning: v === "all" ? null : v });
          }}
          className={chartsSelectClass}
        >
          <option value="all">All</option>
          <option value="1-3">1-3</option>
          <option value="4-6">4-6</option>
          <option value="7+">7+</option>
        </select>
      </div>
      <div className="flex flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
        <label htmlFor="charts-filter-opp" className="font-display text-[10px] uppercase tracking-wider text-[var(--neo-accent)]">
          Opponent
        </label>
        <select
          id="charts-filter-opp"
          disabled={controlsDisabled}
          value={urlFilters.opp}
          onChange={(e) => onSetManyParams({ opp: e.target.value === "all" ? null : e.target.value })}
          className={chartsSelectClass}
        >
          <option value="all">All</option>
          {opponents.map((opp) => (
            <option key={opp} value={opp}>
              {opp}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
        <label htmlFor="charts-filter-phand" className="font-display text-[10px] uppercase tracking-wider text-[var(--neo-accent)]">
          Pitcher
        </label>
        <select
          id="charts-filter-phand"
          disabled={controlsDisabled}
          value={urlFilters.phand}
          onChange={(e) =>
            onSetManyParams({ phand: e.target.value === "all" ? null : (e.target.value as PitchHandFilter) })
          }
          className={chartsSelectClass}
        >
          <option value="all">All</option>
          <option value="L">LHP</option>
          <option value="R">RHP</option>
        </select>
      </div>
      <div className="flex flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
        <span className="font-display text-[10px] uppercase tracking-wider text-[var(--neo-accent)]">RISP</span>
        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[var(--text)]">
          <input
            type="checkbox"
            disabled={controlsDisabled}
            checked={urlFilters.rispOnly}
            onChange={(e) => onSetManyParams({ risp: e.target.checked ? "1" : null })}
            className="rounded border-[var(--border)] text-[var(--neo-accent)] focus:ring-[var(--accent)]"
          />
          Runners 2nd/3rd
        </label>
      </div>
    </div>
  );

  return (
    <div
      data-pdf-exclude="true"
      className="charts-screen-only sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-base)]/92 py-3 backdrop-blur-md"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--text)] md:text-3xl">Charts</h1>
          {isPending ? (
            <p className="mt-0.5 text-[10px] text-[var(--text-muted)]" aria-live="polite">
              Updating charts…
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyFilterLink()}
            disabled={controlsDisabled}
            className="rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copyStatus === "ok" ? "Link copied" : copyStatus === "fail" ? "Copy failed" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={filtersAtDefault || controlsDisabled}
            className="rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset filters
          </button>
          <button
            type="button"
            onClick={onExportSnapshot}
            disabled={chartsEmpty || exportingPdf || controlsDisabled}
            className="rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exportingPdf ? "Building…" : "Snapshot PDF"}
          </button>
          <button
            type="button"
            onClick={onExportFull}
            disabled={chartsEmpty || exportingPdf || controlsDisabled}
            className="rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-[var(--neo-accent)] transition hover:border-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exportingPdf ? "Building PDF…" : "Full PDF"}
          </button>
        </div>
      </div>

      {exportError ? (
        <div className="mt-2 flex flex-wrap items-center gap-2" role="alert">
          <p className="text-sm text-rose-400">{exportError}</p>
          {lastExportMode ? (
            <button
              type="button"
              onClick={onRetryExport}
              className="rounded border border-rose-400/40 px-2 py-0.5 text-xs text-rose-300 hover:bg-rose-400/10"
            >
              Retry {lastExportMode === "snapshot" ? "snapshot" : "full"}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--neo-accent)]"
          aria-expanded={mobileFiltersOpen}
        >
          <span>Filters</span>
          <span aria-hidden>{mobileFiltersOpen ? "▲" : "▼"}</span>
        </button>
        {mobileFiltersOpen ? <div className="mt-2">{filterFields}</div> : null}
      </div>

      <div className="mt-3 hidden lg:block">{filterFields}</div>
    </div>
  );
}
