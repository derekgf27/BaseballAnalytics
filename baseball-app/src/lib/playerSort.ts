/**
 * Roster-style display names: sort by last name, then full string for ties.
 * Uses the last word as last name ("Kenneth Lozada" → "lozada"); treats common
 * suffixes so "John Smith Jr." sorts by "Smith".
 */

const NAME_SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"]);

function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/\./g, "");
}

/** Lowercased string used for comparing last names (not for display). */
export function playerLastNameSortKey(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0]!.toLowerCase();

  let last = parts[parts.length - 1]!;
  if (parts.length >= 2 && NAME_SUFFIXES.has(normalizeToken(last))) {
    last = parts[parts.length - 2]!;
  }
  return last.toLowerCase();
}

/** Alphabetical by last name, then by full name. */
export function comparePlayersByLastNameThenFull(a: { name: string }, b: { name: string }): number {
  const la = playerLastNameSortKey(a.name);
  const lb = playerLastNameSortKey(b.name);
  const c = la.localeCompare(lb, undefined, { sensitivity: "base" });
  if (c !== 0) return c;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}
