"use client";

import { Card, CardTitle } from "@/components/ui/Card";
import type { TodayLineupSlot } from "./CoachTodayClient";

const DEFAULT_OPS = 0.7; // neutral when recent stats missing

function getOps(slot: TodayLineupSlot): number {
  if (slot.recentStats && slot.recentStats.pa > 0) {
    return slot.recentStats.ops;
  }
  return DEFAULT_OPS;
}

function strengthLabel(avgOps: number): "Strong" | "Moderate" | "Limited" {
  if (avgOps >= 0.78) return "Strong";
  if (avgOps >= 0.65) return "Moderate";
  return "Limited";
}

type Segment = "top" | "middle" | "bottom";

export type LineupStrength = "Strong" | "Moderate" | "Limited";

interface LineupInsightsCardProps {
  recommendedLineup: TodayLineupSlot[];
  /** When "neo", use neo-card styling and neo palette */
  variant?: "default" | "neo";
}

/**
 * Converts lineup + trend data into short, actionable insights for the coach.
 * Uses only existing lineup data (no new fetches).
 */
export function LineupInsightsCard({ recommendedLineup, variant = "default" }: LineupInsightsCardProps) {
  const isNeo = variant === "neo";
  const titleClass = isNeo ? "section-label mb-3" : "";
  const textMuted = isNeo ? "text-[var(--neo-text-muted)]" : "text-[var(--text-muted)]";
  const textMain = isNeo ? "text-[var(--neo-text)]" : "text-[var(--text)]";

  if (recommendedLineup.length === 0) {
    const title = isNeo ? <h2 className={titleClass}>Lineup intelligence</h2> : <CardTitle>Lineup intelligence</CardTitle>;
    return isNeo ? (
      <div className="neo-card p-4">
        {title}
        <p className={`mt-2 text-sm ${textMuted}`}>
          Set a lineup to see strength, order breakdown, and balance.
        </p>
      </div>
    ) : (
      <Card>
        <CardTitle>Lineup intelligence</CardTitle>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Set a lineup to see strength, order breakdown, and balance.
        </p>
      </Card>
    );
  }

  const ordered = [...recommendedLineup].sort((a, b) => a.order - b.order);
  const opsBySlot = ordered.map(getOps);
  const avgOps = opsBySlot.reduce((s, o) => s + o, 0) / opsBySlot.length;
  const strength = strengthLabel(avgOps);

  // Order breakdown: top 3, middle 3, bottom 3
  const top = ordered.filter((s) => s.order >= 1 && s.order <= 3);
  const middle = ordered.filter((s) => s.order >= 4 && s.order <= 6);
  const bottom = ordered.filter((s) => s.order >= 7 && s.order <= 9);

  const avgFor = (slots: TodayLineupSlot[]) =>
    slots.length === 0 ? DEFAULT_OPS : slots.reduce((s, slot) => s + getOps(slot), 0) / slots.length;

  const topAvg = avgFor(top);
  const middleAvg = avgFor(middle);
  const bottomAvg = avgFor(bottom);

  const segments: { key: Segment; avg: number; label: string }[] = [
    { key: "top" as const, avg: topAvg, label: "Top third" },
    { key: "middle" as const, avg: middleAvg, label: "Middle third" },
    { key: "bottom" as const, avg: bottomAvg, label: "Bottom third" },
  ].filter((s) => s.avg > 0);

  const byAvg = [...segments].sort((a, b) => b.avg - a.avg);
  const strongest = byAvg[0]?.label ?? null;
  const weakestSeg = byAvg.length > 1 ? byAvg[byAvg.length - 1] : null;
  const weakest = weakestSeg?.label ?? null;
  const weakestActuallyLower = weakestSeg && byAvg[0] && weakestSeg.avg < byAvg[0].avg;

  // Hot / cold counts
  const hotCount = ordered.filter((s) => s.trend === "hot").length;
  const coldCount = ordered.filter((s) => s.trend === "cold").length;

  // Platoon balance
  const rightBats = ordered.filter((s) => (s.bats ?? "").toUpperCase() === "R").length;
  const leftBats = ordered.filter((s) => (s.bats ?? "").toUpperCase() === "L").length;

  const strengthColor =
    strength === "Strong"
      ? isNeo ? "text-[var(--neo-success)]" : "text-[var(--decision-hot)]"
      : strength === "Limited"
        ? isNeo ? "text-[var(--neo-warning)]" : "text-[var(--decision-red)]"
        : textMain;

  const content = (
    <>
      {isNeo ? <h2 className={titleClass}>Lineup intelligence</h2> : <CardTitle>Lineup intelligence</CardTitle>}
      <div className="mt-3 space-y-4">
        {/* 1. Lineup strength */}
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>📈</span>
          <p className={`text-sm ${textMain}`}>
            Projected offensive strength: <span className={`font-semibold ${strengthColor}`}>{strength}</span>
          </p>
        </div>

        {/* 2. Order breakdown */}
        {strongest && (
          <div>
            <p className={`text-sm ${textMuted}`}>
              {strongest} is driving production.
              {weakestActuallyLower && weakest && (
                <> {weakest} currently below lineup average.</>
              )}
            </p>
          </div>
        )}

        {/* 3. Hot / cold summary */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {hotCount > 0 && (
            <span className={`text-sm ${textMain}`}>
              <span aria-hidden>🔥</span> {hotCount} hot hitter{hotCount !== 1 ? "s" : ""} in lineup
            </span>
          )}
          {coldCount > 0 && (
            <span className={`text-sm ${textMain}`}>
              <span aria-hidden>❄️</span> {coldCount} cold hitter{coldCount !== 1 ? "s" : ""}
            </span>
          )}
          {hotCount === 0 && coldCount === 0 && (
            <span className={`text-sm ${textMuted}`}>No strong hot or cold trends in lineup.</span>
          )}
        </div>

        {/* 4. Platoon balance */}
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>⚖️</span>
          <p className={`text-sm ${textMuted}`}>
            Lineup balance: {rightBats}R / {leftBats}L
          </p>
        </div>
      </div>
    </>
  );

  return isNeo ? <div className="neo-card p-4">{content}</div> : <Card>{content}</Card>;
}
