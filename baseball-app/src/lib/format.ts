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
 * Baseball-style rates for UI: drop the leading 0 before the decimal (e.g. 0.325 → `.325`, 1.20 unchanged).
 * Use this for essentially all displayed AVG/OBP/SLG/OPS/ERA/WHIP/FIP-style numbers unless a design explicitly needs `0.xxx`.
 */
export function fmtDecimalNoLeadingZero(n: number, decimals: number): string {
  const neg = n < 0 || Object.is(n, -0);
  const s = Math.abs(n).toFixed(decimals);
  const core = s.startsWith("0.") ? `.${s.slice(2)}` : s;
  return neg ? `-${core}` : core;
}

/**
 * Pitching rates (ERA, FIP, WHIP, K/9, P/PA, etc.): always show a digit before the decimal (`0.65`, `-0.90`).
 */
export function fmtPitchDecimal(n: number, decimals: number): string {
  return n.toFixed(decimals);
}

/** Pitches per PA (two decimal places; values below 1 show as `.xx`). */
export function formatPPa(n: number): string {
  return fmtDecimalNoLeadingZero(n, 2);
}

/** Format a time string (HH:mm:ss or HH:mm) as 12-hour "7:05 PM". */
export function formatGameTime(timeStr: string | null | undefined): string {
  if (!timeStr || !timeStr.trim()) return "—";
  const [h, m] = timeStr.trim().split(":").map(Number);
  if (Number.isNaN(h)) return "—";
  const hour = h % 12 || 12;
  const min = Number.isNaN(m) ? 0 : m;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour}:${String(min).padStart(2, "0")} ${ampm}`;
}
