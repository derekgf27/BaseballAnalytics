"use client";

import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { AlertBadge } from "@/components/ui/AlertBadge";
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

      {/* Recommended lineup — table layout, read-only */}
      <section>
        <CardTitle>Recommended lineup</CardTitle>
        {recommendedLineup.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-[var(--border)]">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[var(--bg-elevated)]">
                  <th className="border-b border-r border-[var(--border)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    #
                  </th>
                  <th className="border-b border-r border-[var(--border)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    POS
                  </th>
                  <th className="border-b border-r border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Player
                  </th>
                  <th className="border-b border-r border-[var(--border)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Trend
                  </th>
                  <th className="border-b border-r border-[var(--border)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Platoon
                  </th>
                  <th className="border-b border-[var(--border)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Bats
                  </th>
                </tr>
              </thead>
              <tbody>
                {recommendedLineup.map((slot, i) => {
                  const trendLabel = slot.trend === "hot" ? "Hot" : slot.trend === "cold" ? "Cold" : "—";
                  const platoonLabel =
                    slot.platoon === "vsRHP" ? "Better vs RHP" : slot.platoon === "vsLHP" ? "Better vs LHP" : "—";
                  return (
                    <tr
                      key={slot.order}
                      className={`border-b border-[var(--border)] last:border-b-0 ${
                        i % 2 === 0 ? "bg-[var(--bg-card)]" : "bg-[var(--bg-elevated)]"
                      }`}
                    >
                      <td className="w-12 border-r border-[var(--border)] px-3 py-2 text-center">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-[var(--accent-coach)] text-sm font-bold text-[var(--bg-base)]">
                          {slot.order}
                        </span>
                      </td>
                      <td className="min-w-[5.5rem] w-24 border-r border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-2 text-center text-sm font-medium text-[var(--text)]">
                        {slot.position || "—"}
                      </td>
                      <td className="min-w-0 px-3 py-2">
                        <Link
                          href={`/coach/players/${slot.playerId}`}
                          className="font-medium text-[var(--accent-coach)] hover:underline"
                        >
                          {slot.playerName}
                        </Link>
                      </td>
                      <td className="w-24 border-r border-[var(--border)] px-2 py-2 text-center text-sm">
                        {slot.trend === "hot" && (
                          <span className="text-lg text-[var(--decision-hot)]" title="Hot" aria-label="Hot">🔥</span>
                        )}
                        {slot.trend === "cold" && (
                          <span className="text-lg text-[var(--decision-red)]" title="Cold" aria-label="Cold">❄️</span>
                        )}
                        {slot.trend === "neutral" && (
                          <span className="text-[var(--text-faint)]">—</span>
                        )}
                        {slot.trend == null && <span className="text-[var(--text-faint)]">—</span>}
                      </td>
                      <td className="min-w-[6rem] border-r border-[var(--border)] px-2 py-2 text-center text-xs text-[var(--text-muted)]">
                        {platoonLabel}
                      </td>
                      <td className="w-12 border-l border-[var(--border)] px-3 py-2 text-center text-sm font-semibold text-[var(--text)]">
                        {slot.bats ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {recommendedLineup.length > 0 && (() => {
          const hot = recommendedLineup.filter((s) => s.trend === "hot" && s.recentStats);
          const cold = recommendedLineup.filter((s) => s.trend === "cold" && s.recentStats);
          if (hot.length === 0 && cold.length === 0) return null;
          function RecentStatRow({ slot }: { slot: TodayLineupSlot }) {
            const s = slot.recentStats!;
            const avgStr = s.avg.toFixed(3).replace(/^0/, "");
            const opsStr = s.ops.toFixed(3).replace(/^0/, "");
            const counting = [
              s.hr > 0 && `${s.hr} HR`,
              `RBI ${s.rbi}`,
              s.bb > 0 && `${s.bb} BB`,
              s.so > 0 && `${s.so} SO`,
            ].filter(Boolean);
            return (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/coach/players/${slot.playerId}`}
                    className="font-semibold text-[var(--accent-coach)] hover:underline"
                  >
                    {slot.playerName}
                  </Link>
                  <span className="text-xs font-medium text-[var(--text-muted)]">Last 20</span>
                </div>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="text-sm font-semibold text-[var(--text)]">
                    {s.h}-for-{s.ab}
                  </span>
                  <span className="text-sm text-[var(--text-muted)]">
                    <span className="font-medium text-[var(--text)]">{avgStr}</span> AVG
                  </span>
                  <span className="text-sm text-[var(--text-muted)]">
                    <span className="font-medium text-[var(--text)]">{opsStr}</span> OPS
                  </span>
                </div>
                {counting.length > 0 && (
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                    {counting.join(" · ")}
                  </p>
                )}
              </div>
            );
          }
          return (
            <div className="mt-4 space-y-4 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Last 20 PA (hot & cold)
              </h3>
              {hot.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                    <span aria-hidden>🔥</span>
                    <span style={{ color: "var(--decision-hot)" }}>Hot</span>
                  </p>
                  <div className="space-y-2">
                    {hot.map((slot) => (
                      <RecentStatRow key={slot.playerId} slot={slot} />
                    ))}
                  </div>
                </div>
              )}
              {cold.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-[var(--decision-red)]">
                    <span aria-hidden>❄️</span> Cold
                  </p>
                  <div className="space-y-2">
                    {cold.map((slot) => (
                      <RecentStatRow key={slot.playerId} slot={slot} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        {recommendedLineup.length === 0 && (
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {game
              ? "No lineup set for this game. Set it in Analyst → Games or Coach → Lineup."
              : "Set a game and lineup to see it here."}
          </p>
        )}
      </section>

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
