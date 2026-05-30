export function recordFormStorageKey(gameId: string): string {
  return `record-form-state:${gameId}`;
}

export function hasPersistedRecordFormState(gameId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(recordFormStorageKey(gameId)) != null;
}
