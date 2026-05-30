import type { BattedBallType } from "@/lib/types";

export function parsePersistedBattedBallType(raw: unknown): BattedBallType | null {
  const v = raw as string | null | undefined;
  if (v !== "ground_ball" && v !== "line_drive" && v !== "fly_ball" && v !== "infield_fly") return null;
  return v;
}
