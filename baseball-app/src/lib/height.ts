/** Format height stored as inches into feet and inches (e.g. 70 → "5'10\"") */
export function formatHeight(heightIn: number | null | undefined): string {
  if (heightIn == null) return "";
  const feet = Math.floor(heightIn / 12);
  const inches = heightIn % 12;
  return inches === 0 ? `${feet}'` : `${feet}'${inches}"`;
}

/** Split total inches into feet and inches (for form state) */
export function heightInToFeetInches(heightIn: number): { feet: number; inches: number } {
  return {
    feet: Math.floor(heightIn / 12),
    inches: heightIn % 12,
  };
}

/** Convert feet + inches to total inches for storage */
export function feetInchesToHeightIn(feet: number, inches: number): number {
  return feet * 12 + inches;
}
