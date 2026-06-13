import type { Insight, InsightConfidence, InsightKind, InsightPriority } from "./types";

const PRIORITY_ORDER: Record<InsightPriority, number> = { high: 0, medium: 1, low: 2 };

export function compareInsightsByPriority(a: Insight, b: Insight): number {
  const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (pd !== 0) return pd;
  const kindOrder: Record<InsightKind, number> = { alert: 0, recommendation: 1, observation: 2 };
  return kindOrder[a.kind] - kindOrder[b.kind];
}

export function assignPriority(input: {
  kind: InsightKind;
  confidence: InsightConfidence;
  magnitude?: number;
  isAlert?: boolean;
}): InsightPriority {
  if (input.kind === "alert" || input.isAlert) return "high";
  if (input.confidence === "low") return "low";
  const mag = input.magnitude ?? 0;
  if (mag >= 0.12 || input.kind === "recommendation") return "high";
  if (mag >= 0.06) return "medium";
  return "low";
}

export function sortAndCap<T extends Insight>(items: T[], cap?: number): T[] {
  const sorted = [...items].sort(compareInsightsByPriority);
  return cap != null && cap > 0 ? sorted.slice(0, cap) : sorted;
}
