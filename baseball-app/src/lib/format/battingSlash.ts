/** One rate in .xxx style (drop leading 0). */
function slashRate(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v === 0) return ".000";
  const s = v.toFixed(3);
  return s.startsWith("0.") ? s.slice(1) : s;
}

/** Triple-slash line: AVG/OBP/SLG (e.g. `.305/.388/.512`). */
export function formatBattingTripleSlash(
  avg: number | null | undefined,
  obp: number | null | undefined,
  slg: number | null | undefined
): string {
  return `${slashRate(avg)}/${slashRate(obp)}/${slashRate(slg)}`;
}
