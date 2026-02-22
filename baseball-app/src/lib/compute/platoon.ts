/**
 * Platoon preference: clearly better vs LHP or vs RHP from split stats.
 */

import type { BattingStats } from "@/lib/types";

export type PlatoonPreference = "vsLHP" | "vsRHP" | null;

const MIN_PA_PER_SPLIT = 15;
const WOBA_DIFF_THRESHOLD = 0.05;

/**
 * Return whether the batter is clearly better vs LHP or vs RHP.
 * Needs enough PAs in both splits; uses wOBA difference.
 */
export function platoonFromSplits(
  vsL: BattingStats | null,
  vsR: BattingStats | null,
  minPA = MIN_PA_PER_SPLIT
): PlatoonPreference {
  if (!vsL || !vsR) return null;
  const paL = vsL.pa ?? 0;
  const paR = vsR.pa ?? 0;
  if (paL < minPA || paR < minPA) return null;
  const diff = (vsR.woba ?? 0) - (vsL.woba ?? 0);
  if (diff >= WOBA_DIFF_THRESHOLD) return "vsRHP";
  if (diff <= -WOBA_DIFF_THRESHOLD) return "vsLHP";
  return null;
}
