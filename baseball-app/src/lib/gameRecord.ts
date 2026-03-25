import type { Game } from "@/lib/types";

export interface TeamGameRecord {
  wins: number;
  losses: number;
  ties: number;
  /** Games with both final scores set (W+L+T). */
  decided: number;
}

/** Win–loss from completed games (`final_score_*` set). Ties when scores are equal. */
export function computeTeamRecordFromGames(games: Game[]): TeamGameRecord {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  for (const g of games) {
    const h = g.final_score_home;
    const a = g.final_score_away;
    if (h == null || a == null || Number.isNaN(h) || Number.isNaN(a)) continue;
    const ours = g.our_side === "home" ? h : a;
    const theirs = g.our_side === "home" ? a : h;
    if (ours > theirs) wins++;
    else if (ours < theirs) losses++;
    else ties++;
  }
  return { wins, losses, ties, decided: wins + losses + ties };
}

/** "W-L" or "W-L-T" when ties > 0; null if no decided games. */
export function formatTeamRecordString(r: TeamGameRecord): string | null {
  if (r.decided === 0) return null;
  if (r.ties > 0) return `${r.wins}-${r.losses}-${r.ties}`;
  return `${r.wins}-${r.losses}`;
}
