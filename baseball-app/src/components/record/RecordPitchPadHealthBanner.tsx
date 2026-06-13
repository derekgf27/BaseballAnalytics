"use client";

import { useEffect, useRef, useState } from "react";
import type { PitchTrackerPadHealthAlert } from "@/lib/record/pitchTrackerPadHealth";

const LEVEL_CLASS: Record<PitchTrackerPadHealthAlert["level"], string> = {
  error: "border-[var(--danger)]/50 bg-[var(--danger-dim)] text-[var(--danger)]",
  warning: "border-amber-500/45 bg-amber-950/35 text-amber-100",
  info: "border-sky-600/45 bg-sky-950/35 text-sky-100",
  success: "border-[var(--success)]/50 bg-[var(--success-dim)] text-[var(--success)]",
};

function defaultExpanded(level: PitchTrackerPadHealthAlert["level"]): boolean {
  return level === "error";
}

export function RecordPitchPadHealthBanner({ alert }: { alert: PitchTrackerPadHealthAlert | null }) {
  const [expanded, setExpanded] = useState(false);
  const alertKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!alert) {
      alertKeyRef.current = null;
      return;
    }
    const key = `${alert.level}:${alert.title}`;
    if (alertKeyRef.current !== key) {
      alertKeyRef.current = key;
      setExpanded(defaultExpanded(alert.level));
    }
  }, [alert]);

  if (!alert) return null;

  if (alert.level === "success") {
    return (
      <div
        className={`rounded-md border px-2 py-1 ${LEVEL_CLASS.success}`}
        role="status"
        title={alert.detail}
      >
        <span className="flex items-center gap-1 text-[10px] font-semibold leading-tight">
          <span className="text-[11px] leading-none" aria-hidden>
            ✓
          </span>
          {alert.title}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-md border ${LEVEL_CLASS[alert.level]}`}
      role={alert.level === "error" ? "alert" : "status"}
    >
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[10px] leading-tight touch-manipulation"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="record-pitch-pad-health-detail"
      >
        <span className="min-w-0 flex-1 truncate font-semibold">{alert.title}</span>
        <span className="shrink-0 text-[9px] opacity-70" aria-hidden>
          {expanded ? "▲" : "▼"}
        </span>
      </button>
      {expanded ? (
        <p
          id="record-pitch-pad-health-detail"
          className="border-t border-current/15 px-2 pb-1.5 pt-1 text-[10px] leading-snug opacity-90"
        >
          {alert.detail}
        </p>
      ) : null}
    </div>
  );
}
