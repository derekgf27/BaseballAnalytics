/**
 * Format a date string (YYYY-MM-DD) as MM/DD/YYYY for display.
 */
export function formatDateMMDDYYYY(dateStr: string): string {
  if (!dateStr) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${m}/${d}/${y}`;
}
