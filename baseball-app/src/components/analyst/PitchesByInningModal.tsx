"use client";

import { useEffect } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { PitcherInningPitchRow } from "@/components/analyst/BattingPitchMixCard";

function ordinalInningLabel(inning: number): string {
  const mod10 = inning % 10;
  const mod100 = inning % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? "th"
      : mod10 === 1
        ? "st"
        : mod10 === 2
          ? "nd"
          : mod10 === 3
            ? "rd"
            : "th";
  return `${inning}${suffix}`;
}

export function PitchesByInningModal({
  open,
  pitcherName,
  rows,
  totalPitches,
  highlightInning,
  onClose,
}: {
  open: boolean;
  pitcherName: string;
  rows: PitcherInningPitchRow[];
  totalPitches: number;
  highlightInning?: number;
  onClose: () => void;
}) {
  const dialogRef = useFocusTrap(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pitches-by-inning-pitcher"
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2
              id="pitches-by-inning-pitcher"
              className="truncate font-display text-lg font-semibold tracking-tight text-white sm:text-xl"
            >
              {pitcherName}
            </h2>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Pitches by inning
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-4 sm:p-5">
          {rows.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              No pitches logged for {pitcherName} yet this game.
            </p>
          ) : (
            <div className="flex min-w-0 items-stretch gap-3">
              <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain">
                <div
                  className="flex min-w-min items-stretch gap-2 pb-1"
                  role="list"
                  aria-label={`Pitches by inning for ${pitcherName}`}
                >
                  {rows.map((row) => {
                    const highlighted =
                      highlightInning != null && row.inning === highlightInning;
                    const label = ordinalInningLabel(row.inning);
                    return (
                      <div
                        key={row.inning}
                        role="listitem"
                        title={`Inning ${row.inning}`}
                        className={`flex min-w-[4.25rem] shrink-0 flex-col items-center rounded-lg border px-2 py-2 text-center sm:min-w-[4.75rem] sm:px-2.5 sm:py-2.5 ${
                          highlighted
                            ? "border-[var(--accent)] bg-[var(--accent)]/12 ring-1 ring-[var(--accent)]/35"
                            : "border-[var(--border)] bg-[var(--bg-elevated)]/50"
                        }`}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                          {label}
                        </span>
                        <span className="mt-1 tabular-nums text-xl font-bold leading-none text-[var(--accent)] sm:text-2xl">
                          {row.pitches}
                        </span>
                        {highlighted ? (
                          <span className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                            Now
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                className="flex shrink-0 flex-col items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-center sm:px-5 sm:py-2.5"
                aria-label={`Total pitches: ${totalPitches}`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Total
                </span>
                <span className="mt-1 tabular-nums text-xl font-bold leading-none text-[var(--text)] sm:text-2xl">
                  {totalPitches}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
