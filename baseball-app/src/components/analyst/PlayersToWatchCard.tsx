import Link from "next/link";
import type { PlayersToWatchRow } from "@/lib/playersToWatch";

function CategoryIcon({ category }: { category: PlayersToWatchRow["category"] }) {
  switch (category) {
    case "hot":
      return (
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--accent-dim)] text-base"
          title="Last 10 PA OPS at or above season"
        >
          🔥
        </span>
      );
    case "cold":
      return (
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--bg-elevated)] text-base ring-1 ring-[var(--border)]"
          title="Last 10 PA OPS below season"
        >
          ❄️
        </span>
      );
  }
}

const trendStatLine =
  "font-mono text-[13px] leading-snug tabular-nums sm:text-[15px]";

/** Parse "season -> last" strings from `formatTrendAvgOps`. */
function parseTrendPair(formatted: string): { left: string; right: string; a: number; b: number } | null {
  const parts = formatted.split(/\s*->\s*/);
  if (parts.length !== 2) return null;
  const left = parts[0]!.trim();
  const right = parts[1]!.trim();
  const toNum = (t: string): number => {
    const u = t.replace(/%/g, "").trim();
    const n = parseFloat(u.startsWith(".") ? `0${u}` : u);
    return Number.isFinite(n) ? n : NaN;
  };
  const a = toNum(left);
  const b = toNum(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { left, right, a, b };
}

/** Lower value = danger, higher = accent (cyan); equal = neutral. */
function TrendPair({ formatted }: { formatted: string }) {
  const p = parseTrendPair(formatted);
  if (!p) {
    return <span className="font-semibold text-[var(--text)]">{formatted}</span>;
  }
  const low = Math.min(p.a, p.b);
  const high = Math.max(p.a, p.b);
  const cls = (n: number) => {
    if (p.a === p.b) return "font-semibold text-white";
    if (n === low) return "font-semibold text-[var(--danger)]";
    return "font-semibold text-[var(--accent)]";
  };
  return (
    <span className="inline-flex flex-wrap items-baseline justify-end gap-x-1">
      <span className={cls(p.a)}>{p.left}</span>
      <span className="font-medium text-white">→</span>
      <span className={cls(p.b)}>{p.right}</span>
    </span>
  );
}

function StatTrendLines({ row }: { row: PlayersToWatchRow }) {
  if (row.trendLines.length === 0) {
    return (
      <div className="text-right">
        <p className="font-mono text-sm tabular-nums text-[var(--text-muted)]">—</p>
      </div>
    );
  }
  return (
    <div className="space-y-1 text-right">
      {row.trendLines.map((line) => (
        <p key={line.label} className={trendStatLine}>
          <span className="text-[11px] font-semibold text-white sm:text-xs">{line.label}</span>{" "}
          <TrendPair formatted={line.formatted} />
        </p>
      ))}
    </div>
  );
}

export function PlayersToWatchCard({
  rows,
  isPreview = false,
}: {
  rows: PlayersToWatchRow[];
  /** True when rows are sample stats on real roster names (nothing flagged yet) */
  isPreview?: boolean;
}) {
  return (
    <div className="card-tech flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
      <div className="border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
        <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-white">
          Players to watch
        </h2>
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Season → last 10 PA</p>
        {isPreview && (
          <p className="mt-2 rounded border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug text-amber-200/90">
            Preview — sample stats using your roster so you can see the layout. Real rows appear when a player’s
            last 10 PA diverges by more than 100 points in any slash line.
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
          No players with a 100+ point move in AVG, OBP, SLG, or OPS
        </div>
      ) : (
        <div className="max-h-[min(30rem,65vh)] overflow-y-auto px-0">
          <ul className="divide-y divide-[var(--border)]">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/analyst/players/${row.id}`}
                  className="flex items-start gap-3 px-4 py-3 transition hover:bg-[var(--accent-dim)]/40"
                >
                  <CategoryIcon category={row.category} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--accent)]">{row.name}</p>
                        <p className="mt-0.5 text-sm font-medium uppercase tracking-wide text-white">
                          {row.position}
                        </p>
                        <p className="mt-1 text-sm font-medium tabular-nums leading-snug text-white">
                          Last 10 PA: {row.last10PaSummary}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <StatTrendLines row={row} />
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
