export default function ChartsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">Charts</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Analyst only — derived from events.
        </p>
      </div>
      <div className="card-tech p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
            <h3 className="text-sm font-semibold text-[var(--text)]">Contact quality</h3>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Distribution from plate_appearances.contact_quality (Phase 2).</p>
            <div className="mt-4 h-24 rounded-lg bg-[var(--bg-input)] opacity-60" aria-hidden />
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
            <h3 className="text-sm font-semibold text-[var(--text)]">Chase tendencies</h3>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Chase rate by count/zone (Phase 2).</p>
            <div className="mt-4 h-24 rounded-lg bg-[var(--bg-input)] opacity-60" aria-hidden />
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:col-span-2">
            <h3 className="text-sm font-semibold text-[var(--text)]">Late-game performance</h3>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Inning 7+ result distribution (Phase 2).</p>
            <div className="mt-4 h-32 rounded-lg bg-[var(--bg-input)] opacity-60" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
