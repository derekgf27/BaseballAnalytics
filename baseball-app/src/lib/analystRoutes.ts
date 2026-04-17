/** Canonical analyst URLs — use for deep links and consistent navigation. */

export function analystRecordHref(gameId: string): string {
  return `/analyst/record?gameId=${encodeURIComponent(gameId)}`;
}

export function analystGameLogHref(gameId: string): string {
  return `/analyst/games/${encodeURIComponent(gameId)}/log`;
}

export function analystGameReviewHref(gameId: string): string {
  return `/analyst/games/${encodeURIComponent(gameId)}/review`;
}

export function analystPlayerProfileHref(playerId: string): string {
  return `/analyst/roster/${encodeURIComponent(playerId)}`;
}

/** Opponent detail page slug is encoded team name. */
export function analystOpponentDetailHref(opponentTeamName: string): string {
  return `/analyst/opponents/${encodeURIComponent(opponentTeamName.trim())}`;
}

export function analystComparePlayersHref(params: {
  p1?: string | null;
  p2?: string | null;
  scope?: string | null;
}): string {
  const sp = new URLSearchParams();
  if (params.p1?.trim()) sp.set("p1", params.p1.trim());
  if (params.p2?.trim()) sp.set("p2", params.p2.trim());
  if (params.scope?.trim()) sp.set("scope", params.scope.trim());
  const q = sp.toString();
  return `/analyst/compare-players${q ? `?${q}` : ""}`;
}
