"use client";

/**
 * 1–5 scale bar for internal ratings. Analyst view; coach does not see raw numbers.
 */
interface RatingBarProps {
  label: string;
  value: number;
  max?: number;
  showNumber?: boolean;
}

export function RatingBar({
  label,
  value,
  max = 5,
  showNumber = true,
}: RatingBarProps) {
  const pct = Math.min(1, Math.max(0, value / max));
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-base">
        <span className="font-medium text-[var(--text)]">{label}</span>
        {showNumber && <span className="text-lg font-semibold tabular-nums text-[var(--text)]">{value}</span>}
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--bg-input)]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width]"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
