/**
 * Compute internal ratings (1–5) from plate appearance events.
 * Used when player_ratings has no override. Pure logic — no DB, no UI.
 */

import type { PlateAppearance, Ratings, PAResult } from "@/lib/types";

const DAMAGE_RESULTS: PAResult[] = ["double", "triple", "hr"];
const CONTACT_RESULTS: PAResult[] = ["single", "double", "triple", "hr"];
const OUT_RESULTS: PAResult[] = ["out", "so", "so_looking"];

function clampRating(v: number): number {
  return Math.max(1, Math.min(5, Math.round(v)));
}

/**
 * Contact Reliability (1–5): based on rate of non-SO outs and quality contact.
 * More hits + hard/medium contact → higher. Lots of SO or soft contact → lower.
 */
function contactReliability(pas: PlateAppearance[]): number {
  if (pas.length === 0) return 3;
  const hits = pas.filter((pa) => CONTACT_RESULTS.includes(pa.result)).length;
  const strikeouts = pas.filter((pa) => pa.result === "so" || pa.result === "so_looking").length;
  const withQuality = pas.filter(
    (pa) => pa.contact_quality === "hard" || pa.contact_quality === "medium"
  ).length;
  const rate = (hits + withQuality * 0.5) / pas.length;
  const soPenalty = strikeouts / pas.length;
  const raw = 1 + rate * 4 - soPenalty * 2;
  return clampRating(raw);
}

/**
 * Damage Potential (1–5): extra-base hits and hard contact share.
 */
function damagePotential(pas: PlateAppearance[]): number {
  if (pas.length === 0) return 3;
  const damage = pas.filter((pa) => DAMAGE_RESULTS.includes(pa.result)).length;
  const hard = pas.filter((pa) => pa.contact_quality === "hard").length;
  const raw = 1 + ((damage * 2 + hard) / pas.length) * 4;
  return clampRating(raw);
}

/**
 * Decision Quality (1–5): chase rate and BB/selectivity. Low chase + BBs → higher.
 */
function decisionQuality(pas: PlateAppearance[]): number {
  if (pas.length === 0) return 3;
  const withChase = pas.filter((pa) => pa.chase === true).length;
  const walks = pas.filter((pa) => pa.result === "bb" || pa.result === "ibb").length;
  const chaseRate = pas.some((pa) => pa.chase !== null)
    ? withChase / pas.filter((pa) => pa.chase !== null).length
    : 0.25;
  const bbRate = walks / pas.length;
  const raw = 1 + (1 - chaseRate) * 2 + bbRate * 4;
  return clampRating(raw);
}

/**
 * Defense Trust (1–5): from defensive_events would go here. For now, default 3.
 * Phase 2: pass defensive_events and compute from outcomes.
 */
function defenseTrust(_pas: PlateAppearance[]): number {
  return 3;
}

/**
 * Compute all four internal ratings from a player's plate appearances.
 */
export function ratingsFromEvents(pas: PlateAppearance[]): Ratings {
  return {
    contact_reliability: contactReliability(pas),
    damage_potential: damagePotential(pas),
    decision_quality: decisionQuality(pas),
    defense_trust: defenseTrust(pas),
  };
}
