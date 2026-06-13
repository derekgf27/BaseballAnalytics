/** Rows from Analyst → Opponents (manually added; editable / deletable). */
export interface TrackedOpponentRow {
  id: string;
  name: string;
}

/**
 * Count official W–L–SV per player from the games table. Only finalized games (both scores set).
 * When `calendarYear` is set, only games whose `date` falls in that year (ISO `YYYY-MM-DD`).
 */
export type PitcherOfficialTotals = {
  wins: number;
  losses: number;
  saves: number;
};
