/** All roster position codes (shared by forms and validation). */
export const ROSTER_POSITION_CODES = [
  "P",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
  "DH",
] as const;

export type RosterPositionCode = (typeof ROSTER_POSITION_CODES)[number];
