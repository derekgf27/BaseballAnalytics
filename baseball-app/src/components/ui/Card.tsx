"use client";

/**
 * Decision-first card: clear hierarchy, no clutter.
 * Used for game info, lineup slots, alerts, matchup bullets.
 */
export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)] ${className}`}
    >
      {children}
    </h2>
  );
}
