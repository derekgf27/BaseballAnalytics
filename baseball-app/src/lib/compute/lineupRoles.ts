/**
 * Map player ratings to lineup role labels for Coach Mode.
 * No raw stats; only role labels (Table-setter, Damage, etc.).
 */

import type { Ratings, LineupRole } from "@/lib/types";

/**
 * Rule-based role from ratings.
 * - Table-setter: high contact, lower damage, decent decision
 * - Damage: high damage potential
 * - Protection: solid contact + damage, bat behind damage
 * - Bottom: lower ratings
 */
export function lineupRoleFromRatings(ratings: Ratings): LineupRole {
  const { contact_reliability, damage_potential, decision_quality } = ratings;
  if (damage_potential >= 4) return "Damage";
  if (contact_reliability >= 4 && damage_potential <= 2) return "Table-setter";
  if (contact_reliability >= 3 && damage_potential >= 3) return "Protection";
  if (contact_reliability <= 2 && damage_potential <= 2) return "Bottom";
  return "Other";
}

export function getRoleLabel(role: LineupRole): string {
  return role;
}
