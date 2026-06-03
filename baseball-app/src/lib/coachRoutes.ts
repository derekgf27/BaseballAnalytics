/** Canonical coach portal URLs — keep coaches out of `/analyst/*` where possible. */

export function coachPlayerProfileHref(playerId: string): string {
  return `/coach/players/${encodeURIComponent(playerId)}`;
}

export function coachMatchupHref(gameId?: string | null): string {
  if (!gameId?.trim()) return "/coach/matchup";
  return `/coach/matchup?gameId=${encodeURIComponent(gameId.trim())}`;
}
