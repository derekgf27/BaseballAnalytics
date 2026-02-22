/**
 * Defensive alerts and late-game substitution suggestions.
 * Rule-based; coach sees short text only, no raw data.
 */

import type { DefensiveEvent } from "@/lib/types";

export interface CoachAlert {
  id: string;
  type: "defensive" | "substitution";
  title: string;
  line: string;
  icon: "shield" | "swap";
}

/**
 * From recent defensive events, suggest alerts (e.g. "Watch for bunt with runner on 1st").
 */
export function defensiveAlertsFromEvents(
  events: DefensiveEvent[],
  limit = 5
): CoachAlert[] {
  const buntDefense = events.filter(
    (e) =>
      e.decision_type.toLowerCase().includes("bunt") &&
      e.base_state.startsWith("1")
  );
  const alerts: CoachAlert[] = [];
  if (buntDefense.length > 0) {
    alerts.push({
      id: "bunt-1st",
      type: "defensive",
      title: "Bunt defense",
      line: "Watch for bunt with runner on 1st.",
      icon: "shield",
    });
  }
  return alerts.slice(0, limit);
}

/**
 * Placeholder: late-game substitution suggestions (e.g. defensive sub in 8th).
 * Phase 2: tie to defense_trust and inning/score.
 */
export function substitutionAlerts(
  _inning: number,
  _scoreDiff: number,
  _lineup: { player_id: string; defense_trust: number }[]
): CoachAlert[] {
  return [
    {
      id: "sub-1",
      type: "substitution",
      title: "Late game",
      line: "Consider defensive sub in 8th if leading.",
      icon: "swap",
    },
  ];
}
