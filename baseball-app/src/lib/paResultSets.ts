import type { PAResult } from "@/lib/types";

/** Results where hit direction / batted-ball type can apply (balls in play family). */
export const RESULT_ALLOWS_HIT_DIRECTION = new Set<PAResult>([
  "single",
  "double",
  "triple",
  "hr",
  "out",
  "gidp",
  "fielders_choice",
  "sac",
  "sac_fly",
  "sac_bunt",
  "reached_on_error",
]);

export const RESULT_IS_HIT = new Set<PAResult>(["single", "double", "triple", "hr"]);
