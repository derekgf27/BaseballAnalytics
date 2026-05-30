import type { PlateAppearance } from "@/lib/types";

function halfOrder(half: string | null | undefined): number {
  if (half === "top") return 0;
  if (half === "bottom") return 1;
  return 2;
}

/** Game-log order: inning → half → created_at. */
export function sortPasChronological(pas: PlateAppearance[]): PlateAppearance[] {
  return [...pas].sort((a, b) => {
    if (a.inning !== b.inning) return a.inning - b.inning;
    const ho = halfOrder(a.inning_half) - halfOrder(b.inning_half);
    if (ho !== 0) return ho;
    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  });
}

export function lastPaChronological(pas: PlateAppearance[]): PlateAppearance | null {
  const sorted = sortPasChronological(pas);
  return sorted.length > 0 ? sorted[sorted.length - 1]! : null;
}
