"use client";

export interface BenchPanelProps {
  /** Placeholder when no data */
  pinchHit?: string | null;
  pinchRun?: string | null;
  lateDefense?: string | null;
}

export function BenchPanel({
  pinchHit = null,
  pinchRun = null,
  lateDefense = null,
}: BenchPanelProps) {
  const rows = [
    { label: "Best pinch hit", value: pinchHit },
    { label: "Best pinch run", value: pinchRun },
    { label: "Best late defender", value: lateDefense },
  ];

  const hasAny = pinchHit != null || pinchRun != null || lateDefense != null;

  if (!hasAny) {
    return (
      <section className="neo-card px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="section-label mb-0">Bench</span>
          <p className="text-right text-xs text-[var(--neo-text-muted)]">
            Pinch-hit / run / late-DP suggestions when roster data is wired.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="neo-card p-4">
      <div className="section-label mb-2">Bench</div>
      <ul className="space-y-1.5 text-sm">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-2">
            <span className="text-[var(--neo-text-muted)]">{row.label}</span>
            <span className="text-[var(--neo-text)]">{row.value ?? "—"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
