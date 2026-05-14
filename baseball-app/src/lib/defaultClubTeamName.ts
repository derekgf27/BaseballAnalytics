import type { Game } from "./types";
import { ourTeamName } from "./opponentUtils";

/**
 * Pre-fills "your club" when adding a game so you do not re-type it every time.
 * Set `NEXT_PUBLIC_CLUB_TEAM_NAME` (e.g. in `.env.local`) for a fixed name; otherwise
 * uses the club name from the most recently dated game, if any.
 */
export function defaultClubTeamNameFromGames(games: Game[]): string {
  const fromEnv = (process.env.NEXT_PUBLIC_CLUB_TEAM_NAME ?? "").trim();
  if (fromEnv) return fromEnv;
  const sorted = [...games].sort(
    (a, b) => (b.date ?? "").localeCompare(a.date ?? "") || (b.id ?? "").localeCompare(a.id ?? "")
  );
  const latest = sorted[0];
  return latest ? ourTeamName(latest).trim() : "";
}
