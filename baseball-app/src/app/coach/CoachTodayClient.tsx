"use client";

import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { CoachLineupWithTrends } from "./CoachLineupWithTrends";
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
  /** Last 20 PA stats when trend is hot or cold. */
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

/**
 * Today page = one screen: game info, lineup, alerts, matchups.
 * All data comes from server (real game + lineup or empty).
 */
export function CoachTodayClient({
  game,
  recommendedLineup,
  alerts,
  matchupSummary,
}: CoachTodayClientProps) {
  return (
    <div className="space-y-6 pb-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          Today
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Your dugout view — lineup, alerts, and matchups at a glance.
        </p>
      </header>

      {/* Game info card */}
      <Card>
        <CardTitle>Game</CardTitle>
        {game ? (
          <>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[var(--text)]">
              <span className="font-semibold">
                {game.venueType === "home" ? "vs" : "@"} {game.opponent}
              </span>
              <span className="text-sm text-[var(--text-muted)]">
                {game.venue}
              </span>
              {game.startTime && (
                <span className="text-sm text-[var(--text-muted)]">
                  {game.startTime}
                </span>
              )}
            </div>
            {(game.weatherShort || game.date) && (
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {[game.date, game.weatherShort].filter(Boolean).join(" · ")}
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            No game selected. Create a game in Analyst → Games to see today’s lineup here.
          </p>
        )}
      </Card>

      <CoachLineupWithTrends game={game} recommendedLineup={recommendedLineup} />

      {/* Alerts */}
      <section>
        <CardTitle>Alerts</CardTitle>
        {alerts.length > 0 ? (
          <ul className="mt-2 space-y-2" role="list">
            {alerts.map((a) => (
              <li key={a.id}>
                <AlertBadge type={a.type} title={a.title} line={a.line} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            No alerts right now.
          </p>
        )}
      </section>

      {/* Matchup summary */}
      <section>
        <CardTitle>Matchup summary</CardTitle>
        {matchupSummary.length > 0 ? (
          <ul className="mt-2 space-y-2" role="list">
            {matchupSummary.map((m) => (
              <li
                key={m.id}
                className={`flex gap-2 rounded-lg border px-3 py-2 text-sm ${
                  m.kind === "advantage"
                    ? "border-[var(--decision-hot)]/30 bg-[var(--decision-hot-dim)] text-[var(--text)]"
                    : m.kind === "risk"
                      ? "border-[var(--decision-red)]/30 bg-[var(--decision-red-dim)] text-[var(--text)]"
                      : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)]"
                }`}
              >
                <span aria-hidden>
                  {m.kind === "advantage" ? "✓" : m.kind === "risk" ? "!" : "·"}
                </span>
                <span>{m.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Add matchup notes in Analyst or before the game.
          </p>
        )}
      </section>
    </div>
  );
}
