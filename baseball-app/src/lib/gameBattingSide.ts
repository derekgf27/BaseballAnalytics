import type { LineupSide } from "@/lib/types";

/** Top half = away batting; bottom = home batting. */
export function battingSideFromHalf(
  half: "top" | "bottom" | null | undefined
): LineupSide {
  if (half === "bottom") return "home";
  return "away";
}

/** After 3 outs: top → bottom same inning; bottom → top of next inning. */
export function nextHalfInningAfterThreeOuts(
  inning: number,
  half: "top" | "bottom" | null | undefined
): { inning: number; half: "top" | "bottom" } {
  const h = half ?? "top";
  if (h === "top") {
    return { inning, half: "bottom" };
  }
  return { inning: Math.min(inning + 1, 99), half: "top" };
}
