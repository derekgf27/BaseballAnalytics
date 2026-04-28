"use client";

import { CoachLineupTable } from "@/components/coach/CoachLineupTable";
import { CoachCurrentGameBar } from "@/components/coach/CoachCurrentGameBar";
import {
  StartingPitchersCompareCard,
  type StarterCompareDisplay,
} from "@/components/coach/StartingPitchersCompareCard";
import { BenchPanel } from "@/components/coach/BenchPanel";
import { LineupInsightsCard } from "./LineupInsightsCard";
import { LineupTrendsCard } from "./LineupTrendsCard";
import type { PitchingStats, PlateAppearance } from "@/lib/types";
import type { Confidence } from "@/data/mock";
import type { PlayerTagType } from "@/data/mock";

export interface TodayGameInfo {
  id: string;
  date: string;
  opponent: string;
  venue: string;
  venueType: "home" | "away";
  /** Display time e.g. 7:05 PM */
  startTime?: string;
  weatherShort?: string;
  awayTeam: string;
  homeTeam: string;
  ourSide: "home" | "away";
}

/** Starting pitchers (names/hands) for the coach compare card; game stats load live from PAs. */
export type StarterComparePayload = {
  club: { display: StarterCompareDisplay };
  opponent: { display: StarterCompareDisplay };
};

export type Trend = "hot" | "cold" | "neutral";
export type PlatoonPreference = "vsLHP" | "vsRHP" | null;

/** Stats over the recent trend window (see TREND_RECENT_PA_COUNT), shown when player is hot or cold. */
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
  benchPlayers: Array<{ id: string; name: string; jersey?: string | null; position?: string | null; bats?: string | null }>;
  starterCompare: StarterComparePayload | null;
  /** Plate appearances for current game (linescore); refreshed on client. */
  initialGamePas: PlateAppearance[];
  /** Our starter: full pitching line from all logged PAs (season-to-date in app). */
  clubStarterSeasonPitching: PitchingStats | null;
  /** Opponent starter: cumulative line vs our lineup (games where we have `our_side` lineup rows). */
  opponentVsOurClubPitching: PitchingStats | null;
}

/**
 * Today page = Tactical Mission Control layout.
 * Same data from server; new UI with neo design system.
 */
export function CoachTodayClient({
  game,
  recommendedLineup,
  benchPlayers,
  starterCompare,
  initialGamePas,
  clubStarterSeasonPitching,
  opponentVsOurClubPitching,
}: CoachTodayClientProps) {
  const orderedLineup = [...recommendedLineup].sort((a, b) => a.order - b.order);

  return (
    <div className="app-shell min-h-full">
      <div className="mx-auto max-w-6xl space-y-5 pb-8">
        {/* Mission context: full width so game + opponent read first */}
        <section className="neo-card p-4 lg:p-5">
          {game ? (
            <CoachCurrentGameBar game={game} initialPas={initialGamePas} />
          ) : (
            <>
              <div className="section-label">Current game</div>
              <p className="mt-2 text-sm text-[var(--neo-text-muted)]">
                No game selected. Create a game in Analyst → Games to see today’s lineup here.
              </p>
            </>
          )}
        </section>

        {/* Lineup + bench on left, starting pitchers on right; trends and insights below */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-stretch">
          <div className="flex min-h-0 min-w-0 w-full flex-col gap-4 self-start">
            <CoachLineupTable lineup={orderedLineup} />
            <BenchPanel benchPlayers={benchPlayers} />
          </div>

          <aside className="flex h-full min-h-0 min-w-0 flex-col">
            {starterCompare && game ? (
              <StartingPitchersCompareCard
                club={starterCompare.club}
                opponent={starterCompare.opponent}
                clubSeasonPitching={clubStarterSeasonPitching}
                opponentVsOurClubPitching={opponentVsOurClubPitching}
              />
            ) : (
              <div className="neo-card flex h-full min-h-0 flex-col p-4 text-sm text-[var(--neo-text-muted)] lg:p-5">
                <div className="section-label mb-2">Starting pitchers</div>
                <p className="flex-1">Add a game in Analyst → Games to see starter vs starter stats.</p>
              </div>
            )}
          </aside>

          <div className="min-w-0 lg:col-span-2">
            <LineupTrendsCard recommendedLineup={recommendedLineup} />
          </div>

          <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
            <LineupInsightsCard recommendedLineup={recommendedLineup} variant="neo" />
          </div>
        </section>
      </div>
    </div>
  );
}
