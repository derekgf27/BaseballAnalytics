"use client";

import { useEffect } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

const SHORTCUT_ROWS = [
  ["Enter", "Save the current PA (same as Save button)"],
  [
    "1 – 9, 0",
    "Outcome by grid order: 1 = 1B, 2 = 2B, 3 = 3B, 4 = HR, …; 0 = 10th (HBP). Sac / ROE / FC use the grid.",
  ],
  ["B", "Focus batter"],
  ["J", "Next batter in lineup (no save)"],
  ["S", "Open substitution"],
  ["P", "Open pitcher change"],
  ["R", "Repeat last saved result and count"],
  ["?", "Open this panel (Shift + /)"],
] as const;

export function RecordShortcutsHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      className="fixed inset-0 z-[220] flex items-start justify-center overflow-y-auto bg-black/55 p-4 pt-[max(2rem,10vh)]"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close shortcuts"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-shortcuts-title"
        data-record-shortcuts-ignore
        className="relative z-[1] w-full max-w-md rounded-xl border-2 border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="record-shortcuts-title"
            className="font-display text-lg font-semibold text-[var(--text)]"
          >
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            className="shrink-0 rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            onClick={onClose}
          >
            Esc
          </button>
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Shortcuts are off while typing in inputs, in a select, or when another dialog is open.
        </p>
        <dl className="mt-4 space-y-2.5 text-sm text-[var(--text)]">
          {SHORTCUT_ROWS.map(([keys, desc]) => (
            <div key={keys} className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1">
              <dt>
                <kbd className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-xs">
                  {keys}
                </kbd>
              </dt>
              <dd className="text-[var(--text-muted)]">{desc}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
