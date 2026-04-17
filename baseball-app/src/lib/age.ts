/** Parse YYYY-MM-DD as local date to avoid UTC-off-by-one when displaying. */
export function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Age in full years from birth date (uses `reference`, default now — pass from server for stable SSR). */
export function computeAgeYears(
  birthDate: string | null | undefined,
  reference: Date = new Date()
): number | null {
  if (birthDate == null || birthDate === "") return null;
  const b = parseLocalDate(birthDate);
  let a = reference.getFullYear() - b.getFullYear();
  if (
    reference.getMonth() < b.getMonth() ||
    (reference.getMonth() === b.getMonth() && reference.getDate() < b.getDate())
  ) {
    a--;
  }
  return a;
}

/** Short US date for profile display (SSR-safe when computed on the server). */
export function formatBirthDateShortUs(isoDate: string): string {
  const date = parseLocalDate(isoDate);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
