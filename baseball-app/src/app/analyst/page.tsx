import Link from "next/link";
import { getGames, getPlayers, getTeamBattingStats } from "@/lib/db/queries";
import { formatDateMMDDYYYY, formatGameTime } from "@/lib/format";
import { ScheduleCalendar } from "./ScheduleCalendar";
import type { Game } from "@/lib/types";

const QUICK_LINKS = [
  { href: "/analyst/games", icon: "📅", label: "Games", countKey: "games" as const },
  { href: "/analyst/record", icon: "✏️", label: "Record PAs", countKey: null },
  { href: "/analyst/players", icon: "👤", label: "Players", countKey: "players" as const },
  { href: "/analyst/stats", icon: "📋", label: "Stats", countKey: null },
  { href: "/analyst/lineup", icon: "📝", label: "Lineup", countKey: null },
  { href: "/analyst/charts", icon: "📈", label: "Charts", countKey: null },
  { href: "/analyst/run-expectancy", icon: "🏃", label: "Run expectancy", countKey: null },
] as const;

function formatAvgLike(val: number): string {
  return val.toFixed(3);
}

/** Opponent label: "vs Team" at home, "@ Team" away. */
function getOpponentLabel(game: Game): string {
  const opponent = game.our_side === "home" ? game.away_team : game.home_team;
  return game.our_side === "home" ? `vs ${opponent}` : `@ ${opponent}`;
}

/** First upcoming game (date >= today), or null. Games from getGames() are desc by date, so we sort asc and take first >= today. */
function getNextGame(games: Game[]): Game | null {
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...games].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.find((g) => g.date >= today) ?? null;
}

export default async function AnalystDashboard() {
  const [games, players] = await Promise.all([getGames(), getPlayers()]);
  const gameCount = games.length;
  const playerCount = players.length;
  const nextGame = getNextGame(games);
  const latestGame = games[0] ?? null;
  const playerIds = players.map((p) => p.id);
  const teamStats = playerIds.length > 0 ? await getTeamBattingStats(playerIds) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Quick access to recording, games, players, and reports.
        </p>
      </div>

      {/* Primary CTA + stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-tech flex flex-col justify-center rounded-lg border p-4">
          <span className="text-2xl font-bold tabular-nums text-[var(--text)]">
            {gameCount}
          </span>
          <span className="mt-0.5 text-sm text-[var(--text-muted)]">
            {gameCount === 1 ? "game" : "games"}
          </span>
        </div>
        <div className="card-tech flex flex-col justify-center rounded-lg border p-4">
          <span className="text-2xl font-bold tabular-nums text-[var(--text)]">
            {playerCount}
          </span>
          <span className="mt-0.5 text-sm text-[var(--text-muted)]">
            {playerCount === 1 ? "player" : "players"}
          </span>
        </div>
        {nextGame ? (
          <Link
            href={`/analyst/record?gameId=${nextGame.id}`}
            className="card-tech card-hover group flex flex-col justify-center rounded-lg border border-[var(--accent)]/40 bg-[var(--accent-dim)]/40 p-4 transition hover:border-[var(--accent)]/70 hover:bg-[var(--accent-dim)]/60"
          >
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--accent)]">
              Next game
            </span>
            <span className="mt-1 text-sm font-medium text-[var(--text)]">
              {formatDateMMDDYYYY(nextGame.date)} — {getOpponentLabel(nextGame)}
            </span>
            <span className="mt-0.5 text-xs text-[var(--text-muted)]">
              {formatGameTime(nextGame.game_time)}
            </span>
            <span className="mt-1 text-xs text-[var(--text-muted)] group-hover:text-[var(--accent)]">
              Record PAs →
            </span>
          </Link>
        ) : latestGame ? (
          <Link
            href={`/analyst/record?gameId=${latestGame.id}`}
            className="card-tech card-hover group flex flex-col justify-center rounded-lg border border-[var(--accent)]/40 bg-[var(--accent-dim)]/40 p-4 transition hover:border-[var(--accent)]/70 hover:bg-[var(--accent-dim)]/60"
          >
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--accent)]">
              Last game
            </span>
            <span className="mt-1 line-clamp-2 text-sm font-medium text-[var(--text)]">
              {formatDateMMDDYYYY(latestGame.date)} — {getOpponentLabel(latestGame)}
            </span>
            <span className="mt-0.5 text-xs text-[var(--text-muted)]">
              {formatGameTime(latestGame.game_time)}
            </span>
            <span className="mt-1 text-xs text-[var(--text-muted)] group-hover:text-[var(--accent)]">
              Continue recording →
            </span>
          </Link>
        ) : (
          <Link
            href="/analyst/games"
            className="card-tech card-hover flex flex-col justify-center rounded-lg border border-dashed border-[var(--border)] p-4 text-center transition hover:border-[var(--accent)]/50 hover:bg-[var(--accent-dim)]/20"
          >
            <span className="text-sm font-medium text-[var(--text-muted)]">
              Upcoming game
            </span>
            <span className="mt-1 text-xs text-[var(--accent)]">
              Add a game to start logging →
            </span>
          </Link>
        )}
      </div>

      {/* Team batting stats */}
      {teamStats && (
        <div className="card-tech rounded-xl border p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Team stats
          </h2>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-3 sm:gap-x-8">
            <div>
              <span className="text-xs text-[var(--text-muted)]">AVG</span>
              <span className="ml-2 font-semibold tabular-nums text-[var(--text)]">
                {formatAvgLike(teamStats.avg)}
              </span>
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)]">OBP</span>
              <span className="ml-2 font-semibold tabular-nums text-[var(--text)]">
                {formatAvgLike(teamStats.obp)}
              </span>
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)]">SLG</span>
              <span className="ml-2 font-semibold tabular-nums text-[var(--text)]">
                {formatAvgLike(teamStats.slg)}
              </span>
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)]">OPS</span>
              <span className="ml-2 font-semibold tabular-nums text-[var(--text)]">
                {formatAvgLike(teamStats.ops)}
              </span>
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)]">HR</span>
              <span className="ml-2 font-semibold tabular-nums text-[var(--text)]">
                {teamStats.hr ?? 0}
              </span>
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)]">RBI</span>
              <span className="ml-2 font-semibold tabular-nums text-[var(--text)]">
                {teamStats.rbi ?? 0}
              </span>
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)]">R</span>
              <span className="ml-2 font-semibold tabular-nums text-[var(--text)]">
                {teamStats.r ?? 0}
              </span>
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)]">PA</span>
              <span className="ml-2 font-semibold tabular-nums text-[var(--text)]">
                {teamStats.pa ?? 0}
              </span>
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Derived from all recorded plate appearances.{" "}
            <Link href="/analyst/stats" className="text-[var(--accent)] hover:underline">
              View player stats →
            </Link>
          </p>
        </div>
      )}

      {/* Schedule — monthly calendar of games */}
      <ScheduleCalendar games={games} />

      {/* Quick actions — same card pattern as Charts / Games */}
      <div className="card-tech rounded-xl border p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Quick actions
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map(({ href, icon, label, countKey }) => {
            const count =
              countKey === "games"
                ? gameCount
                : countKey === "players"
                  ? playerCount
                  : null;
            return (
              <Link
                key={href}
                href={href}
                className="card-hover group flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4 transition"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-dim)] text-lg text-[var(--accent)]"
                  aria-hidden
                >
                  {icon}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-[var(--text)]">{label}</span>
                  {count !== null && (
                    <span className="ml-1.5 text-xs text-[var(--text-muted)]">
                      ({count})
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-[var(--accent)] opacity-80 transition group-hover:opacity-100">
                  Open →
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
