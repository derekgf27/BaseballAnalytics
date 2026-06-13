/** Home / away filter for stats sheets (our club's venue in each game). */
export type StatsVenueFilter = "all" | "home" | "away";

export const STATS_VENUE_FILTER_ORDER: StatsVenueFilter[] = ["all", "home", "away"];

export const STATS_VENUE_LABEL: Record<StatsVenueFilter, string> = {
  all: "All games",
  home: "Home",
  away: "Away",
};
