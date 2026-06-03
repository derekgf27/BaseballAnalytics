import { formatPtsDelta } from "./chartsFilters";

type ChartsKpiStripProps = {
  filteredPaCount: number;
  totalBatterBip: number;
  batterHitPct: number | null;
  baselineBatterHitPct: number | null;
  teamKPct: number | null;
  baselineKPct: number | null;
  teamBBPct: number | null;
};

export function ChartsKpiStrip({
  filteredPaCount,
  totalBatterBip,
  batterHitPct,
  baselineBatterHitPct,
  teamKPct,
  baselineKPct,
  teamBBPct,
}: ChartsKpiStripProps) {
  return (
    <div
      id="charts-kpis"
      className="charts-pdf-block charts-pdf-kpis grid gap-3 scroll-mt-28 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-[inset_0_0_0_1px_rgba(255,204,0,.16)]">
        <div className="text-[10px] uppercase tracking-wider text-[var(--neo-accent)]">Plate appearances</div>
        <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--neo-accent)]">{filteredPaCount}</div>
        <p className="mt-1 text-[10px] text-[var(--text-faint)]">Snapshot filters (not spray result)</p>
      </div>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-[inset_0_0_0_1px_rgba(255,204,0,.16)]">
        <div className="text-[10px] uppercase tracking-wider text-[var(--neo-accent)]">Batter BIP</div>
        <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--neo-accent)]">{totalBatterBip}</div>
        <p className="mt-1 text-[10px] tabular-nums text-[var(--text-faint)]">
          Hit% on BIP{" "}
          <span className="text-[var(--text-muted)]">
            {totalBatterBip > 0 && batterHitPct != null ? `${(batterHitPct * 100).toFixed(1)}%` : "—"}
          </span>
          {formatPtsDelta(batterHitPct, baselineBatterHitPct) ? (
            <span> · Δ {formatPtsDelta(batterHitPct, baselineBatterHitPct)} vs season</span>
          ) : null}
        </p>
      </div>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-[inset_0_0_0_1px_rgba(255,204,0,.16)]">
        <div className="text-[10px] uppercase tracking-wider text-[var(--neo-accent)]">Team K%</div>
        <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--neo-accent)]">
          {teamKPct != null ? `${(teamKPct * 100).toFixed(1)}%` : "—"}
        </div>
        {formatPtsDelta(teamKPct, baselineKPct) && (
          <p className="mt-1 text-[10px] text-[var(--text-faint)]">
            Δ {formatPtsDelta(teamKPct, baselineKPct)} vs season (same snapshot filters)
          </p>
        )}
      </div>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-[inset_0_0_0_1px_rgba(255,204,0,.16)]">
        <div className="text-[10px] uppercase tracking-wider text-[var(--neo-accent)]">Team BB%</div>
        <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--neo-accent)]">
          {teamBBPct != null ? `${(teamBBPct * 100).toFixed(1)}%` : "—"}
        </div>
        <p className="mt-1 text-[10px] text-[var(--text-faint)]">Walk rate on filtered PAs</p>
      </div>
    </div>
  );
}
