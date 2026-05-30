"use client";

import type { FlashMessage } from "@/hooks/useFlashMessage";

type FlashMessageProps = {
  message: FlashMessage | null;
  dismissing?: boolean;
  className?: string;
};

function isSuccessType(type: FlashMessage["type"]): boolean {
  return type === "ok" || type === "deleted" || type === "delete";
}

export function FlashMessage({ message, dismissing = false, className = "" }: FlashMessageProps) {
  if (!message) return null;

  const success = isSuccessType(message.type);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`rounded-lg border border-[var(--border)] p-4 transition-opacity duration-300 ${
        success ? "text-[var(--success)]" : "text-[var(--danger)]"
      } ${dismissing ? "opacity-0" : "opacity-100"} ${className}`.trim()}
      style={{
        background: success ? "var(--success-dim)" : "var(--danger-dim)",
      }}
    >
      {message.text}
    </div>
  );
}
