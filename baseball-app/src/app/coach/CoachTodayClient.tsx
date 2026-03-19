"use client";

import { CoachLineupTable } from "@/components/coach/CoachLineupTable";
import { GameStatusHeader } from "@/components/coach/GameStatusHeader";
import { QuickActions } from "@/components/coach/QuickActions";
import { BenchPanel } from "@/components/coach/BenchPanel";
import { LineupInsightsCard } from "./LineupInsightsCard";
import { LineupTrendsCard } from "./LineupTrendsCard";
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

interface CoachTodayClientProps {
  game: TodayGameInfo | null;
  recommendedLineup: TodayLineupSlot[];
}

/**
 * Today page = Tactical Mission Control layout.
 * Same data from server; new UI with neo design system.
 */
export function CoachTodayClient({
  game,
  recommendedLineup,
}: CoachTodayClientProps) {
  const orderedLineup = [...recommendedLineup].sort((a, b) => a.order - b.order);

  return (
    <div className="app-shell min-h-full">
      <div className="mx-auto max-w-6xl space-y-5 pb-8">
        {/* Mission context: full width so game + opponent read first */}
        <section className="neo-card p-4 lg:p-5">
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
        </section>

        {/* Primary: lineup + trends | Secondary: intel + actions + compact bench */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0 space-y-5">
            <div>
              <div className="section-label mb-3">Lineup</div>
              <CoachLineupTable lineup={orderedLineup} />
            </div>
            <LineupTrendsCard recommendedLineup={recommendedLineup} />
          </div>

          <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
            <LineupInsightsCard recommendedLineup={recommendedLineup} variant="neo" />
            <QuickActions />
            <BenchPanel />
          </aside>
        </section>
      </div>
    </div>
  );
}
