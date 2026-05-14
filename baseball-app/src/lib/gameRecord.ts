import { isDemoId } from "@/lib/db/mockData";
import type { Game, PlateAppearance } from "@/lib/types";

/** Both final scores set on the game row — recording UI is locked; use Log for row edits or clear scores to reopen Record. */
export function isGameFinalized(game: Game): boolean {
  const h = game.final_score_home;
  const a = game.final_score_away;
  return h != null && a != null && !Number.isNaN(Number(h)) && !Number.isNaN(Number(a));
}

export interface TeamGameRecord {
  wins: number;
  losses: number;
  ties: number;
  /** Games with both final scores set (W+L+T). */
  decided: number;
}

/** Outcome for your club when both final scores are set; null if missing or invalid. */
export function ourTeamOutcomeFromFinalScore(game: Game): "W" | "L" | "T" | null {
  const h = game.final_score_home;
  const a = game.final_score_away;
  if (h == null || a == null || Number.isNaN(h) || Number.isNaN(a)) return null;
  const ours = game.our_side === "home" ? h : a;
  const theirs = game.our_side === "home" ? a : h;
  if (ours > theirs) return "W";
  if (ours < theirs) return "L";
  return "T";
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

/** Defensive team for this PA (top: home pitches; bottom: away pitches). */
export function defenseSideFromPaInningHalf(pa: Pick<PlateAppearance, "inning_half">): "home" | "away" | null {
  if (pa.inning_half === "top") return "home";
  if (pa.inning_half === "bottom") return "away";
  return null;
}

/** Which club won from final runs; null if tied. */
export function winningSideFromRuns(finalHome: number, finalAway: number): "home" | "away" | null {
  if (finalHome > finalAway) return "home";
  if (finalAway > finalHome) return "away";
  return null;
}

/**
 * Pitchers who appeared for `side`: listed starter + anyone on the mound in a PA where that side played defense.
 */
export function pitcherIdsForTeamSide(
  game: Pick<Game, "id" | "starting_pitcher_home_id" | "starting_pitcher_away_id">,
  pas: PlateAppearance[],
  side: "home" | "away"
): string[] {
  const set = new Set<string>();
  const sp = side === "home" ? game.starting_pitcher_home_id : game.starting_pitcher_away_id;
  if (sp && !isDemoId(sp)) set.add(sp);
  for (const pa of pas) {
    if (pa.game_id !== game.id) continue;
    const pid = pa.pitcher_id;
    if (!pid || isDemoId(pid)) continue;
    if (defenseSideFromPaInningHalf(pa) === side) set.add(pid);
  }
  return [...set];
}
