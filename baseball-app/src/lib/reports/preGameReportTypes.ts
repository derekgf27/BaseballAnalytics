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
  lastOutingLine: string | null;
  planNotes: string | null;
};
