"use client";

import { createPortal } from "react-dom";

export type RecordToastMessage = {
  type: "success" | "error" | "destructive";
  text: string;
};

type RecordPageToastProps = {
  mounted: boolean;
  message: RecordToastMessage | null;
  onDismiss: () => void;
};

const TOAST_PANEL_CLASS: Record<RecordToastMessage["type"], string> = {
  success: "record-toast-panel record-toast-panel--success ring-2 ring-[var(--success)]/25",
  destructive: "record-toast-panel record-toast-panel--destructive ring-2 ring-[var(--danger)]/35",
  error: "record-toast-panel record-toast-panel--error ring-2 ring-amber-500/35",
};

/** Lightweight toast (CSS only — avoids framer-motion on the Record bundle). */
export function RecordPageToast({ mounted, message, onDismiss }: RecordPageToastProps) {
  if (!mounted || !message || typeof document === "undefined") return null;

  const live =
    message.type === "error" || message.type === "destructive" ? "assertive" : "polite";

  return createPortal(
    <div
      key={`${message.type}-${message.text}`}
      role="alert"
      aria-live={live}
      className="record-toast-enter pointer-events-none fixed inset-x-0 top-0 z-[200] flex justify-center p-3 sm:p-4"
    >
      <div
        className={`pointer-events-auto flex w-full max-w-xl items-start gap-3 rounded-xl border-2 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4 ${TOAST_PANEL_CLASS[message.type]}`}
      >
        {message.type === "error" ? (
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-lg font-bold text-amber-300"
            aria-hidden
          >
            !
          </span>
        ) : message.type === "destructive" ? (
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--danger)]/25 text-xl font-bold leading-none text-[var(--danger)]"
            aria-hidden
          >
            −
          </span>
        ) : (
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--success)]/15 text-lg font-bold text-[var(--success)]"
            aria-hidden
          >
            ✓
          </span>
        )}
        <p className="min-w-0 flex-1 pt-0.5 text-base font-medium leading-snug tracking-tight sm:text-lg">
          {message.text}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="record-toast-dismiss shrink-0 rounded-lg px-2 py-1 text-sm font-semibold opacity-90 hover:opacity-100"
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>,
    document.body
  );
}
