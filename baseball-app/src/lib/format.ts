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

/**
 * Format a time string (HH:mm:ss or HH:mm) as 12-hour "7:05 PM".
 */
/** Pitches per PA: always two decimal places (e.g. 4.17). */
export function formatPPa(n: number): string {
  return n.toFixed(2);
}

export function formatGameTime(timeStr: string | null | undefined): string {
  if (!timeStr || !timeStr.trim()) return "—";
  const [h, m] = timeStr.trim().split(":").map(Number);
  if (Number.isNaN(h)) return "—";
  const hour = h % 12 || 12;
  const min = Number.isNaN(m) ? 0 : m;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour}:${String(min).padStart(2, "0")} ${ampm}`;
}
