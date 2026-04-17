"use client";

import { useId } from "react";

export function ConfirmDeleteDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  pendingLabel = "Working…",
  onConfirm,
  pending = false,
  confirmDisabled = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Shown on the confirm button while `pending` is true. */
  pendingLabel?: string;
  onConfirm: () => void | Promise<void>;
  pending?: boolean;
  /** When true, the destructive confirm control is disabled (e.g. preconditions not met). */
  confirmDisabled?: boolean;
}) {
  const titleId = useId();
  const descId = useId();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      onClick={() => !pending && onClose()}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-[var(--danger)]/30 bg-[var(--bg-card)] p-5 shadow-2xl ring-1 ring-[var(--danger)]/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--danger)]/15 text-[var(--danger)]"
            aria-hidden
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 id={titleId} className="font-display text-lg font-semibold text-[var(--text)]">
              {title}
            </h3>
            <p id={descId} className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
              {description}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            onClick={() => !pending && onClose()}
            disabled={pending}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-elevated)] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={pending || confirmDisabled}
            className="font-display inline-flex items-center justify-center rounded-lg bg-[var(--danger)] px-4 py-2 text-sm font-semibold tracking-wide text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
