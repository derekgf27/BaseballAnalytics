import type { Insight } from "../types";

export function runRecommendationRules(allInsights: Insight[]): Insight[] {
  const recs: Insight[] = [];

  const hasHighK = allInsights.some((i) => i.id.includes("k_rate") || i.id.includes("high_k") || i.id.includes("cold_k"));
  const hasRispCold = allInsights.some((i) => i.id.includes("risp") && (i.trend === "down" || i.id.includes("struggle") || i.id.includes("alert.risp")));
  const hasSliderWhiff = allInsights.some((i) => i.id.includes("best_whiff") && i.title.toLowerCase().includes("slider"));
  const hasColdHitters = allInsights.some((i) => i.id.includes("cold") || i.id.includes("hitless"));

  if (hasSliderWhiff) {
    recs.push({
      id: "rec.slider_two_strike",
      kind: "recommendation",
      category: "pitch_type",
      priority: "high",
      title: "Increase slider usage in two-strike counts.",
      detail: "Staff slider is generating the highest whiff rate in the sample.",
      evidence: [{ label: "Basis", value: "Pitch-type whiff profile" }],
      confidence: "medium",
    });
  }

  if (hasRispCold) {
    recs.push({
      id: "rec.risp_approach",
      kind: "recommendation",
      category: "situational",
      priority: "high",
      title: "Focus on contact approach with runners in scoring position.",
      detail: "Recent RISP production is below team baseline.",
      evidence: [{ label: "Basis", value: "RISP trend / alert" }],
      confidence: "medium",
    });
  }

  if (hasHighK) {
    recs.push({
      id: "rec.two_strike",
      kind: "recommendation",
      category: "team_offense",
      priority: "medium",
      title: "Shorten swings with two strikes and force deeper counts early in the count.",
      evidence: [{ label: "Basis", value: "Elevated team K%" }],
      confidence: "medium",
    });
  }

  if (hasColdHitters) {
    recs.push({
      id: "rec.lineup_adjustment",
      kind: "recommendation",
      category: "hitter",
      priority: "medium",
      title: "Consider lineup adjustment or platoon options for struggling hitters.",
      evidence: [{ label: "Basis", value: "Cold streak / hitless game alerts" }],
      confidence: "medium",
    });
  }

  return recs;
}
