import type { StatsRunnersFilterKey } from "@/lib/types";

/**
 * Display labels for Runners filter (dropdown + active-filter summary).
 * Wording matches `base_state` before the PA — see `isBasesEmpty` / `isRunnersOn` / `isRisp` / `isBasesLoaded`.
 */
export const STATS_RUNNERS_LABEL: Record<StatsRunnersFilterKey, string> = {
  all: "All situations",
  basesEmpty: "No runners on base",
  runnersOn: "Any runner on base",
  risp: "RISP",
  basesLoaded: "Bases loaded",
};

/** Dropdown order for Runners filter on Stats batting / pitching sheets. */
export const STATS_RUNNERS_FILTER_ORDER: StatsRunnersFilterKey[] = [
  "all",
  "basesEmpty",
  "runnersOn",
  "risp",
  "basesLoaded",
];
