/**
 * League rules for this deployment. Regulation length drives ERA / rate stats,
 * minimum linescore columns, and when Record stops auto-advancing into extras.
 *
 * Override with `NEXT_PUBLIC_REGULATION_INNINGS` (e.g. 7 for doubleheader leagues).
 */
function parseRegulationInnings(): number {
  const raw = process.env.NEXT_PUBLIC_REGULATION_INNINGS;
  if (raw == null || raw.trim() === "") return 7;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 15) return 7;
  return Math.floor(n);
}

export const REGULATION_INNINGS = parseRegulationInnings();

/** Upper bound for inning dropdowns (regulation + extra innings). */
export const MAX_SELECTABLE_INNING = Math.max(REGULATION_INNINGS + 10, 15);

/** Values shown in inning `<select>`s: 1 … {@link MAX_SELECTABLE_INNING}. */
export const INNING_SELECT_VALUES: readonly number[] = Array.from(
  { length: MAX_SELECTABLE_INNING },
  (_, i) => i + 1
);

/** e.g. `K/7` for per-regulation-inning rate column headers. */
export function perRegulationInningStatLabel(stat: string): string {
  return `${stat}/${REGULATION_INNINGS}`;
}
