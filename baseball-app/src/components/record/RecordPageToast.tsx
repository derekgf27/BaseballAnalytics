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
        className={`pointer-events-auto flex w-full max-w-xl items-start gap-3 rounded-xl border-2 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.55)] sm:gap-4 sm:px-5 sm:py-4 ${
          message.type === "success"
            ? "border-[var(--success)] bg-[#0a1f18] text-[var(--success)] ring-2 ring-[var(--success)]/25"
            : message.type === "destructive"
              ? "border-[var(--danger)] bg-[#1a1014] text-[#fecdd3] ring-2 ring-[var(--danger)]/35"
              : "border-amber-400 bg-[#1f1810] text-[#fff8e8] ring-2 ring-amber-500/35"
        }`}
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
          className={`shrink-0 rounded-lg px-2 py-1 text-sm font-semibold transition hover:bg-white/10 ${
            message.type === "success"
              ? "text-[var(--success)]"
              : message.type === "destructive"
                ? "text-[#fecdd3]"
                : "text-amber-200"
          }`}
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>,
    document.body
  );
}
