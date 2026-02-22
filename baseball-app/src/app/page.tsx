import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
        <div className="text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-2xl shadow-[0_0_40px_-12px_var(--accent)]">
            ⚾
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
            Baseball Analytics
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)] tracking-wide">
            Internal — choose your mode
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          <Link
            href="/analyst"
            className="group card-tech card-hover flex flex-col p-6"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-dim)] text-lg text-[var(--accent)]">
              📊
            </span>
            <h2 className="mt-4 text-lg font-semibold tracking-tight text-[var(--text)]">
              Analyst
            </h2>
            <p className="mt-2 flex-1 text-sm text-[var(--text-muted)] leading-relaxed">
              Log games, manage players, view charts and overrides.
            </p>
            <span className="mt-4 text-xs font-medium uppercase tracking-wider text-[var(--accent)] opacity-90 group-hover:opacity-100">
              Enter →
            </span>
          </Link>

          <Link
            href="/coach"
            className="group card-tech card-hover flex flex-col p-6"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-coach-dim)] text-lg text-[var(--accent-coach)]">
              👟
            </span>
            <h2 className="mt-4 text-lg font-semibold tracking-tight text-[var(--text)]">
              Coach
            </h2>
            <p className="mt-2 flex-1 text-sm text-[var(--text-muted)] leading-relaxed">
              Today’s lineup, players, green lights, situation — decision-first, no raw stats.
            </p>
            <span className="mt-4 text-xs font-medium uppercase tracking-wider text-[var(--accent-coach)] opacity-90 group-hover:opacity-100">
              Enter →
            </span>
          </Link>
        </div>

        <p className="mt-10 text-center text-xs text-[var(--text-faint)]">
          <code className="rounded border border-[var(--border)] bg-[var(--bg-card)] px-1.5 py-0.5">npm run dev</code>
          {" "}→ localhost:3000
        </p>
      </div>
    </div>
  );
}
