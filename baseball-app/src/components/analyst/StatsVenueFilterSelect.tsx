"use client";

import { useSyncExternalStore, type ChangeEvent } from "react";
import { STATS_VENUE_FILTER_ORDER, STATS_VENUE_LABEL, type StatsVenueFilter } from "@/lib/statsVenueFilter";

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

export type StatsVenueFilterSelectProps = {
  value: StatsVenueFilter;
  onChange: (value: StatsVenueFilter) => void;
  className?: string;
  disabled?: boolean;
};

export function StatsVenueFilterSelect({
  value,
  onChange,
  className,
  disabled,
}: StatsVenueFilterSelectProps) {
  const hydrated = useSyncExternalStore(
    subscribeHydrated,
    getHydratedSnapshot,
    getHydratedServerSnapshot
  );

  const common = {
    value,
    disabled,
    onChange: (e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as StatsVenueFilter),
    className,
    "aria-label": "Filter by home or away games",
    title: "Games where our club was home or away (our_side on the schedule).",
  } as const;

  if (!hydrated) {
    return (
      <select {...common}>
        <option value={value}>{STATS_VENUE_LABEL[value]}</option>
      </select>
    );
  }

  return (
    <select {...common}>
      {STATS_VENUE_FILTER_ORDER.map((key) => (
        <option key={key} value={key}>
          {STATS_VENUE_LABEL[key]}
        </option>
      ))}
    </select>
  );
}
