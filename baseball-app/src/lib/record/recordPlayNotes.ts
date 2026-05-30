export function formatPlayWithDashes(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && /^\d+$/.test(trimmed)) {
    return trimmed.split("").join("-");
  }
  return null;
}
