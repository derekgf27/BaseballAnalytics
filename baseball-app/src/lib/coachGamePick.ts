import type { Game } from "@/lib/types";

export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Next game on or after today, else most recent past game. */
export function pickCoachDashboardGame(games: Game[]): Game | null {
  if (games.length === 0) return null;
  const today = todayIsoDate();
  const upcoming = games
    .filter((g) => g.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (upcoming.length > 0) return upcoming[0] ?? null;

  const recentPast = [...games].sort((a, b) => b.date.localeCompare(a.date));
  return recentPast[0] ?? null;
}

/** Game dropdown: upcoming (soonest first), then past (newest first). */
export function sortGamesForCoachSelect(games: Game[]): Game[] {
  const today = todayIsoDate();
  const upcoming = games.filter((g) => g.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = games.filter((g) => g.date < today).sort((a, b) => b.date.localeCompare(a.date));
  return [...upcoming, ...past];
}
