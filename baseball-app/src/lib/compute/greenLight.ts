/**
 * Green-light matrix: 3–0 swing, hit-and-run, steal, bunt.
 * Rule-based from ratings (Decision Quality, Contact Reliability, etc.).
 * Returns yes / no / situational for coach display.
 */

import type { Ratings, GreenLightVerdict } from "@/lib/types";

/**
 * 3–0 swing: only if decision quality is high and damage potential high (don't waste green light).
 */
export function swing30(ratings: Ratings): GreenLightVerdict {
  if (ratings.decision_quality >= 4 && ratings.damage_potential >= 4)
    return "yes";
  if (ratings.decision_quality <= 2) return "no";
  return "situational";
}

/**
 * Hit-and-run: need contact reliability and decision quality.
 */
export function hitAndRun(ratings: Ratings): GreenLightVerdict {
  if (ratings.contact_reliability >= 4 && ratings.decision_quality >= 3)
    return "yes";
  if (ratings.contact_reliability <= 2) return "no";
  return "situational";
}

/**
 * Steal: decision quality (read) + speed proxy (we don't have speed; use contact as proxy for "reliable runner" or keep situational).
 */
export function steal(ratings: Ratings): GreenLightVerdict {
  if (ratings.decision_quality >= 4) return "yes";
  if (ratings.decision_quality <= 2) return "no";
  return "situational";
}

/**
 * Bunt: contact reliability (put ball in play) and decision quality.
 */
export function bunt(ratings: Ratings): GreenLightVerdict {
  if (ratings.contact_reliability >= 4 && ratings.decision_quality >= 3)
    return "yes";
  if (ratings.contact_reliability <= 2) return "no";
  return "situational";
}

export function greenLightForRatings(ratings: Ratings): {
  swing_3_0: GreenLightVerdict;
  hit_and_run: GreenLightVerdict;
  steal: GreenLightVerdict;
  bunt: GreenLightVerdict;
} {
  return {
    swing_3_0: swing30(ratings),
    hit_and_run: hitAndRun(ratings),
    steal: steal(ratings),
    bunt: bunt(ratings),
  };
}
