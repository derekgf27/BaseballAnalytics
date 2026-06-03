import type { ChartsFilterChip } from "./chartTypes";

export function ChartsPdfFilters({ chips }: { chips: ChartsFilterChip[] }) {
  return (
    <dl className="charts-pdf-filters-grid">
      {chips.map(({ label, value }) => (
        <div key={label} className="charts-pdf-filter-chip">
          <dt className="charts-pdf-filter-label font-display uppercase tracking-wider text-[var(--neo-accent)]">
            {label}
          </dt>
          <dd className="charts-pdf-filter-value font-medium text-[var(--text)]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
