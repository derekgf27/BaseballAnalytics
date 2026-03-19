import Link from "next/link";

export default function Home() {
  return (
    <div className="home-page flex min-h-screen flex-col bg-[var(--bg-base)]">
      {/* Compact hero */}
      <header className="shrink-0 py-8 text-center sm:py-10">
        <div
          className="home-icon-pulse inline-flex h-12 w-12 items-center justify-center rounded-xl border-2 border-[var(--accent)]/40 bg-[var(--bg-card)] text-2xl shadow-[0_0_24px_var(--accent)]"
          aria-hidden
        >
          ⚾
        </div>
        <h1 className="home-title-glow mt-4 text-xl font-semibold text-[var(--text)] sm:text-3xl">
          Baseball Analytics
        </h1>
        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Log it. Decide better.
        </p>
      </header>

      {/* Two mode panes — app theme (neo cyan), full-page layout */}
      <nav
        className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-8 sm:flex-row sm:items-stretch sm:gap-6"
        aria-label="Select mode"
      >
        <Link
          href="/analyst"
          className="home-mode-pane home-mode-pane-analyst group relative flex min-h-[45vh] flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-[var(--accent)]/60 bg-[var(--accent-dim)]/40 px-6 py-12 shadow-[0_0_32px_rgba(102,224,255,0.35)] transition sm:min-h-0 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-base)] hover:border-[var(--accent)] hover:bg-[var(--accent-dim)]/60"
        >
          <span className="text-4xl sm:text-5xl" aria-hidden>📊</span>
          <span className="font-display text-xl font-semibold uppercase tracking-wider text-[var(--text)] sm:text-2xl">
            Analyst
          </span>
          <p className="max-w-[260px] text-center text-sm text-[var(--text-muted)]">
            Log games, manage players, view charts and overrides.
          </p>
          <span className="mt-1 text-xs font-medium uppercase tracking-wider text-[var(--accent)] opacity-0 transition group-hover:opacity-100">
            Enter →
          </span>
        </Link>

        <Link
          href="/coach"
          className="home-mode-pane home-mode-pane-coach group relative flex min-h-[45vh] flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-[var(--accent-coach)]/60 bg-[var(--accent-coach-dim)]/40 px-6 py-12 shadow-[0_0_32px_rgba(102,224,255,0.35)] transition sm:min-h-0 focus:outline-none focus:ring-2 focus:ring-[var(--accent-coach)] focus:ring-offset-2 focus:ring-offset-[var(--bg-base)] hover:border-[var(--accent-coach)] hover:bg-[var(--accent-coach-dim)]/60"
        >
          <span className="text-4xl sm:text-5xl" aria-hidden>👟</span>
          <span className="font-display text-xl font-semibold uppercase tracking-wider text-[var(--text)] sm:text-2xl">
            Coach
          </span>
          <p className="max-w-[260px] text-center text-sm text-[var(--text-muted)]">
            Today’s lineup, players, green lights, situation.
          </p>
          <span className="mt-1 text-xs font-medium uppercase tracking-wider text-[var(--accent-coach)] opacity-0 transition group-hover:opacity-100">
            Enter →
          </span>
        </Link>
      </nav>
    </div>
  );
}
