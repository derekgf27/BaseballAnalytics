/**
 * Green-light matrix: 3–0 swing, hit-and-run, steal, bunt.
 * Rule-based from ratings (Decision Quality, Contact Reliability, etc.).
 * Returns yes / no / situational for coach display.
 */

import type { Ratings, GreenLightVerdict, PlateAppearance, PAResult } from "@/lib/types";

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

const HIT_RESULTS: PAResult[] = ["single", "double", "triple", "hr"];
const DAMAGE_RESULTS: PAResult[] = ["double", "triple", "hr"];
const SO_RESULTS: PAResult[] = ["so", "so_looking"];
const WALK_RESULTS: PAResult[] = ["bb", "ibb"];

const MIN_PA_FOR_GREENLIGHT = 10;

// Thresholds are intentionally constants so you can tune later.
// Units are rates (0..1) over the recent PA sample.
const STAT_THRESHOLDS = {
  // 3–0 swing
  SWING_MIN_XBH_RATE: 0.12,
  SWING_MIN_BB_RATE: 0.06,
  SWING_MAX_SO_RATE: 0.28,

  SWING_NO_MAX_XBH_RATE: 0.06,
  SWING_NO_MAX_BB_RATE: 0.03,
  SWING_NO_MIN_SO_RATE: 0.4,

  // Hit-and-run
  HAR_MIN_MADE_CONTACT_RATE: 0.72,
  HAR_MIN_QUALITY_CONTACT_RATE: 0.18,
  HAR_MIN_BB_RATE: 0.03,
  HAR_MAX_SO_RATE: 0.32,

  // Steal
  STEAL_YES_MIN_SB_RATE: 0.08,
  STEAL_NO_MAX_SB_RATE: 0.02,
  STEAL_MAX_SO_RATE: 0.34,

  // Bunt
  BUNT_MIN_MADE_CONTACT_RATE: 0.72,
  BUNT_MIN_QUALITY_CONTACT_RATE: 0.18,
  BUNT_MAX_SO_RATE: 0.34,
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function getStatRates(pas: PlateAppearance[]) {
  const total = pas.length;
  const safeTotal = Math.max(1, total);

  const strikeouts = pas.filter((pa) => SO_RESULTS.includes(pa.result)).length;
  const walks = pas.filter((pa) => WALK_RESULTS.includes(pa.result)).length;
  const hits = pas.filter((pa) => HIT_RESULTS.includes(pa.result)).length;
  const xbh = pas.filter((pa) => DAMAGE_RESULTS.includes(pa.result)).length;

  const hardMedium = pas.filter((pa) => pa.contact_quality === "hard" || pa.contact_quality === "medium").length;

  // Proxy for "can they put it in play": treat any non-K as "made contact"
  // (walk/HBP are also non-K, so this slightly overestimates contact ability).
  const madeContactRate = clamp01((safeTotal - strikeouts) / safeTotal);
  const soRate = clamp01(strikeouts / safeTotal);
  const bbRate = clamp01(walks / safeTotal);
  const hitRate = clamp01(hits / safeTotal);
  const xbhRate = clamp01(xbh / safeTotal);
  const qualityContactRate = clamp01(hardMedium / safeTotal);

  const hasSbData = pas.some((pa) => pa.stolen_bases != null);
  const sbTotal = pas.reduce((acc, pa) => acc + (pa.stolen_bases ?? 0), 0);
  const sbRate = hasSbData ? clamp01(sbTotal / safeTotal) : null;

  return { total, madeContactRate, soRate, bbRate, hitRate, xbhRate, qualityContactRate, sbRate };
}

function verdictYesNoSituational(yes: boolean, no: boolean): GreenLightVerdict {
  if (yes) return "yes";
  if (no) return "no";
  return "situational";
}

/**
 * Purely stat-driven matrix using recent plate appearance rates.
 * Assumes `pas` is sorted newest-first (so slice(0, limit) are the most recent).
 */
export function greenLightForRecentPAs(
  pas: PlateAppearance[],
  limit = 20
): {
  swing_3_0: GreenLightVerdict;
  hit_and_run: GreenLightVerdict;
  steal: GreenLightVerdict;
  bunt: GreenLightVerdict;
} {
  const recent = pas.slice(0, limit);
  if (recent.length < MIN_PA_FOR_GREENLIGHT) {
    return { swing_3_0: "situational", hit_and_run: "situational", steal: "situational", bunt: "situational" };
  }

  const r = getStatRates(recent);

  // 3–0 swing: want patience/selectivity + power with low strikeouts.
  const swingYes =
    r.bbRate >= STAT_THRESHOLDS.SWING_MIN_BB_RATE &&
    r.xbhRate >= STAT_THRESHOLDS.SWING_MIN_XBH_RATE &&
    r.soRate <= STAT_THRESHOLDS.SWING_MAX_SO_RATE;
  const swingNo =
    r.bbRate <= STAT_THRESHOLDS.SWING_NO_MAX_BB_RATE ||
    (r.xbhRate <= STAT_THRESHOLDS.SWING_NO_MAX_XBH_RATE && r.soRate >= STAT_THRESHOLDS.SWING_NO_MIN_SO_RATE);
  const swing_3_0 = verdictYesNoSituational(swingYes, swingNo);

  // Hit-and-run: want to make contact (and preferably quality contact) with enough zone control.
  const harYes =
    r.madeContactRate >= STAT_THRESHOLDS.HAR_MIN_MADE_CONTACT_RATE &&
    r.qualityContactRate >= STAT_THRESHOLDS.HAR_MIN_QUALITY_CONTACT_RATE &&
    (r.soRate <= STAT_THRESHOLDS.HAR_MAX_SO_RATE || r.bbRate >= STAT_THRESHOLDS.HAR_MIN_BB_RATE);
  const harNo =
    r.madeContactRate <= STAT_THRESHOLDS.HAR_MIN_MADE_CONTACT_RATE - 0.12 ||
    r.qualityContactRate <= STAT_THRESHOLDS.HAR_MIN_QUALITY_CONTACT_RATE - 0.06 ||
    r.soRate >= STAT_THRESHOLDS.HAR_MAX_SO_RATE + 0.12;
  const hit_and_run = verdictYesNoSituational(harYes, harNo);

  // Steal: if SB data exists, use it. Otherwise, fall back to strikeout/contact profile.
  const hasSb = r.sbRate != null;
  const stealYes = hasSb
    ? r.sbRate! >= STAT_THRESHOLDS.STEAL_YES_MIN_SB_RATE && r.soRate <= STAT_THRESHOLDS.STEAL_MAX_SO_RATE
    : r.soRate <= STAT_THRESHOLDS.STEAL_MAX_SO_RATE;
  const stealNo = hasSb
    ? r.sbRate! <= STAT_THRESHOLDS.STEAL_NO_MAX_SB_RATE
    : r.soRate >= STAT_THRESHOLDS.STEAL_MAX_SO_RATE + 0.2;
  const steal = verdictYesNoSituational(stealYes, stealNo);

  // Bunt: similar to hit-and-run but generally more conservative with strikeout profile.
  const buntYes =
    r.madeContactRate >= STAT_THRESHOLDS.BUNT_MIN_MADE_CONTACT_RATE &&
    r.qualityContactRate >= STAT_THRESHOLDS.BUNT_MIN_QUALITY_CONTACT_RATE &&
    r.soRate <= STAT_THRESHOLDS.BUNT_MAX_SO_RATE;
  const buntNo =
    r.madeContactRate <= STAT_THRESHOLDS.BUNT_MIN_MADE_CONTACT_RATE - 0.18 ||
    r.qualityContactRate <= STAT_THRESHOLDS.BUNT_MIN_QUALITY_CONTACT_RATE - 0.06 ||
    r.soRate >= STAT_THRESHOLDS.BUNT_MAX_SO_RATE + 0.2;
  const bunt = verdictYesNoSituational(buntYes, buntNo);

  return { swing_3_0, hit_and_run, steal, bunt };
}
