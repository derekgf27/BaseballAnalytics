/** Canonical coach portal URLs — keep coaches out of `/analyst/*` where possible. */

export function coachPlayerProfileHref(playerId: string): string {
  return `/coach/players/${encodeURIComponent(playerId)}`;
}
