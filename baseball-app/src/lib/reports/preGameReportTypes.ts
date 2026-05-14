/** Shared types for pre-game overview / report (server + pure build). */

export type PreGameRecentHitterLine = {
  pa: number;
  ops: number;
  kPct: number;
  bbPct: number;
};

export type PreGamePriorMeeting = {
  gameId: string;
  date: string;
  ourRuns: number | null;
  oppRuns: number | null;
  outcome: "W" | "L" | "T" | null;
  fromPas: { pa: number; ops: number; kPct: number; bbPct: number } | null;
};

export type PreGameOurStarterSummary = {
  playerId: string | null;
  name: string | null;
  seasonIpDisplay: string | null;
  seasonEra: string | null;
  /** e.g. `05/01/2026 vs Opponent Name` for the pitcher’s most recent logged start before this game. */
  lastStartVersus: string | null;
  /** Full box-style line from that start (IP, H, R, ER, BB, K, HR, HBP if any, WHIP, ERA, FIP). */
  lastStartStatLine: string | null;
  planNotes: string | null;
};
