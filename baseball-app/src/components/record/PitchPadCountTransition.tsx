"use client";

export function PitchPadCountTransition({
  beforeBalls,
  beforeStrikes,
  after,
}: {
  beforeBalls: number;
  beforeStrikes: number;
  /** `null` when the PA pad has not logged this pitch yet (coach type only). */
  after: { balls: number; strikes: number } | null;
}) {
  const tail = after == null ? "—" : `${after.balls}-${after.strikes}`;
  return (
    <div className="ml-auto inline-flex min-w-0 shrink-0 items-center gap-x-1.5 rounded-md border border-[var(--accent)]/40 bg-[var(--bg-elevated)]/30 px-2 py-1 tabular-nums">
      <span className="text-[11px] text-[var(--text-muted)] sm:text-xs">
        {beforeBalls}-{beforeStrikes}
      </span>
      <span className="text-[11px] text-[var(--text-muted)] sm:text-xs" aria-hidden>
        →
      </span>
      <span className="text-[11px] font-bold text-[var(--accent)] sm:text-xs">{tail}</span>
    </div>
  );
}
