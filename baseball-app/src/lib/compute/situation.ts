/**
 * Situation prompt: inning, outs, base state, batter (ratings) → aggressive / neutral / conservative + one sentence.
 * Rule-based; no ML. Coach-facing only.
 */

import type { Ratings, SituationResult, SituationTone } from "@/lib/types";

export interface SituationContext {
  inning: number;
  outs: number;
  base_state: string; // "000" … "111"
  score_diff: number; // our lead: positive, deficit: negative
}

/**
 * One-sentence recommendation and tone from context + batter ratings.
 */
export function situationPrompt(
  context: SituationContext,
  batterRatings: Ratings
): SituationResult {
  const { inning, outs, base_state, score_diff } = context;
  const lateGame = inning >= 7;
  const runnersOn = base_state !== "000";
  const ahead = score_diff > 0;
  const behind = score_diff < 0;
  const twoOuts = outs === 2;

  // Late and behind → more aggressive
  if (lateGame && behind) {
    return {
      tone: "aggressive",
      sentence:
        "Runner goes on contact; batter has green light 3–0 if decision quality is there.",
    };
  }

  // Late and ahead → conservative
  if (lateGame && ahead && runnersOn) {
    return {
      tone: "conservative",
      sentence: "Protect the lead; no steals or hit-and-run unless big opportunity.",
    };
  }

  // Two outs, runner in scoring position
  if (twoOuts && (base_state === "010" || base_state === "001" || base_state === "011" || base_state === "110" || base_state === "111")) {
    return {
      tone: batterRatings.contact_reliability >= 4 ? "aggressive" : "neutral",
      sentence:
        "Two outs — need a hit. Runner goes on contact with two strikes.",
    };
  }

  // Default: neutral
  return {
    tone: "neutral",
    sentence: "Standard situation; play to your green-light matrix for this batter.",
  };
}
