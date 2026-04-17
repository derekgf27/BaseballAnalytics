export function pitchTrackerGroupStorageKey(gameId: string): string {
  return `ba_pitch_tracker_group_${gameId}`;
}

export function readStoredPitchTrackerGroupId(gameId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(pitchTrackerGroupStorageKey(gameId));
  } catch {
    return null;
  }
}

export function writeStoredPitchTrackerGroupId(gameId: string, groupId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(pitchTrackerGroupStorageKey(gameId), groupId);
  } catch {
    /* ignore */
  }
}

export function newPitchTrackerGroupId(): string {
  return crypto.randomUUID();
}
