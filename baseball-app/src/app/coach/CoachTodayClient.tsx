"use client";

import { CoachLineupTable } from "@/components/coach/CoachLineupTable";
import { GameStatusHeader } from "@/components/coach/GameStatusHeader";
import { AggressionMeter } from "@/components/coach/AggressionMeter";
import { RunPotentialIndicator } from "@/components/coach/RunPotentialIndicator";
import { TacticalAlertsPanel } from "@/components/coach/TacticalAlertsPanel";
import { QuickActions } from "@/components/coach/QuickActions";
import { BenchPanel } from "@/components/coach/BenchPanel";
import { LineupInsightsCard } from "./LineupInsightsCard";
import type { Confidence } from "@/data/mock";
import type { PlayerTagType } from "@/data/mock";

export interface TodayGameInfo {
  id: string;
  date: string;
  opponent: string;
  venue: string;
  venueType: "home" | "away";
  startTime?: string;
  weatherShort?: string;
}

export type Trend = "hot" | "cold" | "neutral";
export type PlatoonPreference = "vsLHP" | "vsRHP" | null;

/** Stats over last 20 PAs, shown when player is hot or cold. */
export interface RecentStats {
  pa: number;
  ab: number;
  h: number;
  double: number;
  triple: number;
  hr: number;
  rbi: number;
  bb: number;
  so: number;
  avg: number;
  ops: number;
}

export interface TodayLineupSlot {
  order: number;
  playerId: string;
  playerName: string;
  position: string;
  bats: string | null;
  confidence: Confidence;
  tags: PlayerTagType[];
  trend?: Trend;
  platoon?: PlatoonPreference;
  recentStats?: RecentStats;
}

export interface TodayAlert {
  id: string;
  type: "hot" | "cold" | "risk";
  title: string;
  line: string;
}

export interface TodayMatchupBullet {
  id: string;
  text: string;
  kind: "advantage" | "neutral" | "risk";
}

interface CoachTodayClientProps {
  game: TodayGameInfo | null;
  recommendedLineup: TodayLineupSlot[];
  alerts: TodayAlert[];
  matchupSummary: TodayMatchupBullet[];
}

const DEFAULT_OPS = 0.7;

function getRunPotentialLevel(
  lineup: TodayLineupSlot[]
): { level: "high" | "moderate" | "low"; label: string } {
  if (lineup.length === 0) return { level: "moderate", label: "—" };
  const opsList = lineup.map((s) =>
    s.recentStats?.pa ? s.recentStats.ops : DEFAULT_OPS
  );
  const avg = opsList.reduce((a, b) => a + b, 0) / opsList.length;
  if (avg >= 0.78) return { level: "high", label: "High" };
  if (avg >= 0.65) return { level: "moderate", label: "Moderate" };
  return { level: "low", label: "Low" };
}

/**
 * Today page = Tactical Mission Control layout.
 * Same data from server; new UI with neo design system.
 */
export function CoachTodayClient({
  game,
  recommendedLineup,
  alerts,
  matchupSummary,
}: CoachTodayClientProps) {
  const orderedLineup = [...recommendedLineup].sort((a, b) => a.order - b.order);
  const runPotential = getRunPotentialLevel(recommendedLineup);
  // Placeholder: no aggression data yet
  const aggressionValue = 0.5;

  return (
    <div className="app-shell min-h-full">
      <div className="mx-auto max-w-6xl space-y-6 pb-8">
        {/* Top bar: game info + inning/score + aggression + run potential */}
        <section className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
          <div className="neo-card flex-1 p-4 lg:p-5">
            {game ? (
              <GameStatusHeader
                opponent={game.opponent}
                venue={game.venue}
                venueType={game.venueType}
                date={game.date}
                startTime={game.startTime}
                inning={null}
                score={null}
              />
            ) : (
              <>
                <div className="section-label">Current game</div>
                <p className="mt-2 text-sm text-[var(--neo-text-muted)]">
                  No game selected. Create a game in Analyst → Games to see today’s lineup here.
                </p>
              </>
            )}
          </div>
          <div className="flex flex-col gap-3 lg:w-72">
            <div className="neo-card p-3.5 lg:p-4">
              <AggressionMeter value={aggressionValue} />
            </div>
            <div className="neo-card p-3.5 lg:p-4">
              <RunPotentialIndicator
                level={runPotential.level}
                label={runPotential.label}
              />
            </div>
          </div>
        </section>

        {/* Main grid: lineup table (left 2/3) + lineup intelligence (right 1/3) */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div>
              <div className="section-label mb-3">Lineup</div>
              <CoachLineupTable lineup={orderedLineup} />
            </div>
            <TacticalAlertsPanel alerts={alerts} matchupSummary={matchupSummary} />
          </div>

          <div className="flex flex-col gap-4">
            <LineupInsightsCard recommendedLineup={recommendedLineup} variant="neo" />
            <BenchPanel />
            <QuickActions />
          </div>
        </section>
      </div>
    </div>
  );
}
