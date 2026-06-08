/** Canonical coach portal URLs — keep coaches out of `/analyst/*` where possible. */

export function coachPlayerProfileHref(playerId: string): string {
  return `/coach/players/${encodeURIComponent(playerId)}`;
}

export function coachMatchupHref(gameId?: string | null): string {
  if (!gameId?.trim()) return "/coach/matchup";
  return `/coach/matchup?gameId=${encodeURIComponent(gameId.trim())}`;
}

export function coachChartsHref(): string {
  return "/coach/charts";
}

export function coachComparePlayersHref(params: {
  p1?: string | null;
  p2?: string | null;
  scope?: string | null;
} = {}): string {
  const sp = new URLSearchParams();
  if (params.p1?.trim()) sp.set("p1", params.p1.trim());
  if (params.p2?.trim()) sp.set("p2", params.p2.trim());
  if (params.scope?.trim()) sp.set("scope", params.scope.trim());
  const q = sp.toString();
  return `/coach/compare-players${q ? `?${q}` : ""}`;
}
