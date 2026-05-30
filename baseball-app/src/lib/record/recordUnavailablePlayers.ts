export type UnavailableBySide = { away: string[]; home: string[] };

export function recordUnavailableStorageKey(gameId: string): string {
  return `record-unavailable-players:${gameId}`;
}

export function readUnavailablePlayers(gameId: string): UnavailableBySide {
  if (typeof window === "undefined") return { away: [], home: [] };
  try {
    const raw = window.localStorage.getItem(recordUnavailableStorageKey(gameId));
    if (!raw) return { away: [], home: [] };
    const parsed = JSON.parse(raw) as Partial<UnavailableBySide>;
    return {
      away: Array.isArray(parsed.away) ? parsed.away.filter((id) => typeof id === "string") : [],
      home: Array.isArray(parsed.home) ? parsed.home.filter((id) => typeof id === "string") : [],
    };
  } catch {
    return { away: [], home: [] };
  }
}

export function writeUnavailablePlayers(gameId: string, data: UnavailableBySide): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(recordUnavailableStorageKey(gameId), JSON.stringify(data));
}

export function clearUnavailablePlayers(gameId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(recordUnavailableStorageKey(gameId));
  } catch {
    /* ignore */
  }
}
