"use client";

export interface BenchPanelProps {
  benchPlayers?: Array<{ id: string; name: string; jersey?: string | null; position?: string | null; bats?: string | null }>;
  /** Placeholder when no data */
  pinchHit?: string | null;
  pinchRun?: string | null;
  lateDefense?: string | null;
}

export function BenchPanel({
  benchPlayers = [],
  pinchHit = null,
  pinchRun = null,
  lateDefense = null,
}: BenchPanelProps) {
  const rows = [
    { label: "Best pinch hit", value: pinchHit },
    { label: "Best pinch run", value: pinchRun },
    { label: "Best late defender", value: lateDefense },
  ];

  const hasAnySuggestions = pinchHit != null || pinchRun != null || lateDefense != null;
  const hasBench = benchPlayers.length > 0;

  if (!hasAnySuggestions && !hasBench) {
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
      {hasBench ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {benchPlayers.map((p) => (
            <li key={p.id} className="rounded border border-[var(--neo-border)] bg-[var(--neo-bg-elevated)]/35 px-3 py-2 text-sm">
              <div className="truncate font-medium text-[var(--neo-text)]">{p.name}</div>
              <div className="mt-0.5 text-xs text-[var(--neo-text-muted)]">
                {p.jersey ? `#${p.jersey} · ` : ""}
                {p.position ?? "—"} · {p.bats ?? "—"}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {hasAnySuggestions ? (
        <ul className="mt-3 space-y-1.5 text-sm">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-2">
              <span className="text-[var(--neo-text-muted)]">{row.label}</span>
              <span className="text-[var(--neo-text)]">{row.value ?? "—"}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
