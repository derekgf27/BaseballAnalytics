"use client";

/**
 * Alert badge for Hot / Cold / Risk.
 * One line, no tables — coach can scan in under 5 seconds.
 */
const ALERT_STYLES = {
  hot: {
    bg: "bg-[var(--decision-green-dim)]",
    border: "border-[var(--decision-green)]/40",
    label: "Hot",
    icon: "↑",
  },
  cold: {
    bg: "bg-[var(--decision-yellow-dim)]",
    border: "border-[var(--decision-yellow)]/40",
    label: "Cold",
    icon: "↓",
  },
  risk: {
    bg: "bg-[var(--decision-red-dim)]",
    border: "border-[var(--decision-red)]/40",
    label: "Risk",
    icon: "!",
  },
} as const;

export function AlertBadge({
  type,
  title,
  line,
}: {
  type: "hot" | "cold" | "risk";
  title: string;
  line: string;
}) {
  const s = ALERT_STYLES[type];
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${s.bg} ${s.border}`}
      role="listitem"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-[var(--text)]" aria-hidden>
          {s.icon}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {title}
        </span>
      </div>
      <p className="mt-1 text-sm text-[var(--text)]">{line}</p>
    </div>
  );
}
