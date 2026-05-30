"use client";

import { useSyncExternalStore, type ChangeEvent } from "react";
import { STATS_RUNNERS_FILTER_ORDER, STATS_RUNNERS_LABEL } from "@/lib/statsRunnersFilter";
import type { StatsRunnersFilterKey } from "@/lib/types";

function subscribeHydrated(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  queueMicrotask(onStoreChange);
  return () => {};
}

function getHydratedSnapshot(): boolean {
  return true;
}

function getHydratedServerSnapshot(): boolean {
  return false;
}

export type StatsRunnersFilterSelectProps = {
  value: StatsRunnersFilterKey;
  onChange: (value: StatsRunnersFilterKey) => void;
  className?: string;
  disabled?: boolean;
};

/**
 * Runners base-state filter. Full option list renders only after hydration so SSR HTML
 * (single selected option) matches the first client paint — avoids label/HMR mismatches.
 */
export function StatsRunnersFilterSelect({
  value,
  onChange,
  className,
  disabled,
}: StatsRunnersFilterSelectProps) {
  const hydrated = useSyncExternalStore(
    subscribeHydrated,
    getHydratedSnapshot,
    getHydratedServerSnapshot
  );

  const common = {
    value,
    disabled,
    onChange: (e: ChangeEvent<HTMLSelectElement>) =>
      onChange(e.target.value as StatsRunnersFilterKey),
    className,
    "aria-label": "Filter by base state before the plate appearance",
    title: "Base state at the start of each plate appearance (before the pitch).",
  } as const;

  if (!hydrated) {
    return (
      <select {...common}>
        <option value={value}>{STATS_RUNNERS_LABEL[value]}</option>
      </select>
    );
  }

  return (
    <select {...common}>
      {STATS_RUNNERS_FILTER_ORDER.map((key) => (
        <option key={key} value={key}>
          {STATS_RUNNERS_LABEL[key]}
        </option>
      ))}
    </select>
  );
}
