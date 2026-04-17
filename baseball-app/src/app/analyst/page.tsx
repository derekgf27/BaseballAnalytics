import type { ReactNode } from "react";
import Link from "next/link";
import { PlayersToWatchCard } from "@/components/analyst/PlayersToWatchCard";
import {
  getGames,
  getPlayers,
  getPlayersToWatchInput,
  getTeamBattingStats,
  getTeamBattingStatsRisp,
  getTeamPitchingStats,
} from "@/lib/db/queries";
import { isDemoId } from "@/lib/db/mockData";
import { buildRosterPreviewWatchRows, selectPlayersToWatch } from "@/lib/playersToWatch";
import { computeTeamRecordFromGames, formatTeamRecordString } from "@/lib/gameRecord";
import { formatDateMMDDYYYY, formatGameTime, formatPPa } from "@/lib/format";
import { ScheduleCalendar } from "./ScheduleCalendar";
import { isClubRosterPlayer, isPitcherPlayer } from "@/lib/opponentUtils";
import type { Game } from "@/lib/types";
import { analystGameLogHref } from "@/lib/analystRoutes";

function formatAvgLike(val: number): string {
  const s = val.toFixed(3);
  return s.startsWith("0.") ? s.slice(1) : s;
}

/** K% / BB% stored as 0–1 in BattingStats */
function formatPctRate(val: number | undefined): string {
  if (val === undefined || Number.isNaN(val)) return "—";
  return `${(val * 100).toFixed(1)}%`;
}

/** ERA / WHIP / FIP — hide when no innings pitched. */
function formatEraLike(val: number, hasIp: boolean): string {
  if (!hasIp || Number.isNaN(val)) return "—";
  return val.toFixed(2);
}

/** Dashboard team-stats rows: even gaps so labels/values line up across wrapped lines. */
function StatRow({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1.5 text-sm tabular-nums">
      {children}
    </div>
  );
}

function StatPair({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1.5">
      <span className="shrink-0 font-semibold text-white">{label}</span>
      <span className="min-w-[2.75rem] font-semibold text-[var(--accent)] sm:min-w-[3rem]">{value}</span>
    </span>
  );
}

function StatSep() {
  return <span className="shrink-0 select-none text-[var(--text-muted)]" aria-hidden>|</span>;
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
  const teamRecord = computeTeamRecordFromGames(games);
  const recordLabel = formatTeamRecordString(teamRecord);
  const decidedGames = games.filter(
    (g) =>
      g.final_score_home != null &&
      g.final_score_away != null &&
      !Number.isNaN(g.final_score_home) &&
      !Number.isNaN(g.final_score_away)
  );
  const runsPerGame =
    decidedGames.length > 0
      ? decidedGames.reduce(
          (sum, g) => sum + (g.our_side === "home" ? (g.final_score_home ?? 0) : (g.final_score_away ?? 0)),
          0
        ) / decidedGames.length
      : null;
  const clubPlayers = players.filter(isClubRosterPlayer);
  const nextGame = getNextGame(games);
  const latestGame = games[0] ?? null;
  const battingStatsPlayerIds = clubPlayers
    .filter((p) => !isPitcherPlayer(p))
    .map((p) => p.id);
  const pitchingStatsPlayerIds = clubPlayers.filter(isPitcherPlayer).map((p) => p.id);
  const [teamStats, teamStatsRisp, teamPitchingStats, watchInput] = await Promise.all([
    battingStatsPlayerIds.length > 0 ? getTeamBattingStats(battingStatsPlayerIds) : Promise.resolve(null),
    battingStatsPlayerIds.length > 0 ? getTeamBattingStatsRisp(battingStatsPlayerIds) : Promise.resolve(null),
    pitchingStatsPlayerIds.length > 0 ? getTeamPitchingStats(pitchingStatsPlayerIds) : Promise.resolve(null),
    getPlayersToWatchInput(),
  ]);
  const watchRows = selectPlayersToWatch(watchInput);
  const rosterNonDemo = clubPlayers.filter((p) => !isDemoId(p.id));
  const watchDisplayRows =
    watchRows.length > 0 ? watchRows : buildRosterPreviewWatchRows(clubPlayers);
  const watchIsPreview = watchRows.length === 0 && rosterNonDemo.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Quick access to recording, games, players, and reports.
        </p>
      </div>

      {/* Primary CTA + stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-tech flex flex-col justify-center rounded-lg border p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Win - Loss
          </span>
          <span className="mt-2 text-2xl font-bold tabular-nums text-[var(--text)]">
            {recordLabel ?? "—"}
          </span>
        </div>
        <div className="card-tech flex flex-col justify-center rounded-lg border p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Runs per game
          </span>
          <span className="mt-2 text-2xl font-bold tabular-nums text-[var(--accent)]">
            {runsPerGame != null ? runsPerGame.toFixed(2) : "—"}
          </span>
        </div>
        {nextGame ? (
          <Link
            href={analystGameLogHref(nextGame.id)}
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
              Open game log →
            </span>
          </Link>
        ) : latestGame ? (
          <Link
            href={analystGameLogHref(latestGame.id)}
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
              Open game log →
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

      {/* Team batting (left) + pitching (right); stacked rows per side */}
      <div className="card-tech rounded-xl border p-6">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
          Team stats
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-8 text-sm leading-relaxed [font-family:var(--font-mono)] lg:grid-cols-3 lg:items-start lg:gap-8 xl:gap-10">
          <div className="min-w-0 space-y-5 lg:border-r lg:border-[var(--border)] lg:pr-6 xl:pr-8">
            <div>
              <p className="font-display text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Offensive production
              </p>
              <StatRow>
                <StatPair label="AVG" value={teamStats ? formatAvgLike(teamStats.avg) : "—"} />
                <StatSep />
                <StatPair label="OBP" value={teamStats ? formatAvgLike(teamStats.obp) : "—"} />
                <StatSep />
                <StatPair label="SLG" value={teamStats ? formatAvgLike(teamStats.slg) : "—"} />
                <StatSep />
                <StatPair label="OPS" value={teamStats ? formatAvgLike(teamStats.ops) : "—"} />
              </StatRow>
            </div>
            <div>
              <p className="font-display text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Plate discipline
              </p>
              <StatRow>
                <StatPair label="K%" value={teamStats ? formatPctRate(teamStats.kPct) : "—"} />
                <StatSep />
                <StatPair label="BB%" value={teamStats ? formatPctRate(teamStats.bbPct) : "—"} />
                <StatSep />
                <StatPair label="P/PA" value={teamStats?.pPa != null ? formatPPa(teamStats.pPa) : "—"} />
              </StatRow>
            </div>
            <div>
              <p className="font-display text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Results
              </p>
              <StatRow>
                <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className="shrink-0 font-semibold text-white">RISP</span>
                  <span className="min-w-[2.75rem] font-semibold text-[var(--accent)] sm:min-w-[3rem]">
                    {teamStatsRisp != null ? formatAvgLike(teamStatsRisp.avg) : "—"}
                  </span>
                  {teamStatsRisp != null && teamStatsRisp.pa != null && teamStatsRisp.pa > 0 && (
                    <span className="text-[11px] text-[var(--text-muted)]">
                      (<span className="text-white">{teamStatsRisp.h ?? 0} for {teamStatsRisp.ab ?? 0}</span>)
                    </span>
                  )}
                </span>
                <StatSep />
                <StatPair label="RBI" value={teamStats != null ? String(teamStats.rbi ?? 0) : "—"} />
                <StatSep />
                <StatPair label="2B" value={teamStats != null ? String(teamStats.double ?? 0) : "—"} />
                <StatSep />
                <StatPair label="HR" value={teamStats != null ? String(teamStats.hr ?? 0) : "—"} />
              </StatRow>
            </div>
          </div>

          <div className="min-w-0 space-y-5 lg:border-r lg:border-[var(--border)] lg:pr-6 xl:pr-8">
            <div>
              <p className="font-display text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Run prevention
              </p>
              <StatRow>
                <StatPair
                  label="ERA"
                  value={teamPitchingStats ? formatEraLike(teamPitchingStats.era, teamPitchingStats.ip > 0) : "—"}
                />
                <StatSep />
                <StatPair
                  label="WHIP"
                  value={teamPitchingStats ? formatEraLike(teamPitchingStats.whip, teamPitchingStats.ip > 0) : "—"}
                />
                <StatSep />
                <StatPair
                  label="FIP"
                  value={teamPitchingStats ? formatEraLike(teamPitchingStats.fip, teamPitchingStats.ip > 0) : "—"}
                />
                <StatSep />
                <StatPair
                  label="BAA"
                  value={
                    teamPitchingStats != null && teamPitchingStats.abAgainst >= 1
                      ? formatAvgLike(teamPitchingStats.h / teamPitchingStats.abAgainst)
                      : "—"
                  }
                />
              </StatRow>
            </div>
            <div>
              <p className="font-display text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Command
              </p>
              <StatRow>
                <StatPair label="K%" value={teamPitchingStats ? formatPctRate(teamPitchingStats.rates.kPct) : "—"} />
                <StatSep />
                <StatPair label="BB%" value={teamPitchingStats ? formatPctRate(teamPitchingStats.rates.bbPct) : "—"} />
                <StatSep />
                <StatPair
                  label="Strike%"
                  value={
                    teamPitchingStats?.rates.strikePct != null
                      ? formatPctRate(teamPitchingStats.rates.strikePct)
                      : "—"
                  }
                />
              </StatRow>
            </div>
            <div>
              <p className="font-display text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Efficiency
              </p>
              <StatRow>
                <StatPair
                  label="P/PA"
                  value={teamPitchingStats?.rates.pPa != null ? formatPPa(teamPitchingStats.rates.pPa) : "—"}
                />
                <StatSep />
                <StatPair
                  label="FPS%"
                  value={
                    teamPitchingStats?.rates.fpsPct != null
                      ? formatPctRate(teamPitchingStats.rates.fpsPct)
                      : "—"
                  }
                />
              </StatRow>
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            <div>
              <p className="font-display text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Stolen bases
              </p>
              <StatRow>
                <StatPair label="SB" value={teamStats != null ? String(teamStats.sb ?? 0) : "—"} />
                <StatSep />
                <StatPair label="CS" value={teamStats != null ? String(teamStats.cs ?? 0) : "—"} />
                <StatSep />
                <StatPair label="SB%" value={teamStats?.sbPct != null ? formatPctRate(teamStats.sbPct) : "—"} />
              </StatRow>
            </div>
          </div>
        </div>
      </div>

      {/* Players to watch + schedule */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <PlayersToWatchCard rows={watchDisplayRows} isPreview={watchIsPreview} />
        <div className="min-w-0 w-full lg:max-w-none">
          <ScheduleCalendar games={games} />
        </div>
      </div>
    </div>
  );
}
