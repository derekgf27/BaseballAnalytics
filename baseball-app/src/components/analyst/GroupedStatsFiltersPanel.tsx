"use client";

import { useEffect, useState, type ReactNode } from "react";

type GroupedStatsFiltersPanelProps = {
  children: ReactNode;
  /** Shown beside the label when collapsed (e.g. "vs Mayaguez · RISP"). */
  activeSummary?: string | null;
};

/** Collapsible wrapper for the grouped filter grid on Stats / opponent sheets. */
export function GroupedStatsFiltersPanel({ children, activeSummary }: GroupedStatsFiltersPanelProps) {
  const [open, setOpen] = useState(() => Boolean(activeSummary));

  useEffect(() => {
    if (activeSummary) setOpen(true);
  }, [activeSummary]);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group min-w-0 rounded-lg border border-[var(--border)]/55 bg-[var(--bg-elevated)]/30"
    >
      <summary className="cursor-pointer list-none px-4 py-3 marker:hidden select-none [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-2 font-display text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <span
              className="text-sm leading-none text-[var(--text)] transition-transform group-open:rotate-90"
              aria-hidden
            >
              ▸
            </span>
            Filters
          </span>
          {!open && activeSummary ? (
            <span className="text-xs font-normal normal-case tracking-normal text-[var(--accent)]">
              {activeSummary}
            </span>
          ) : null}
        </span>
      </summary>
      <div className="border-t border-[var(--border)]/55 px-4 pb-3 pt-3">{children}</div>
    </details>
  );
}
