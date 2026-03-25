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

function formatAvgLike(val: number): string {
  return val.toFixed(3);
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
  const clubPlayers = players.filter(isClubRosterPlayer);
  const playerCount = clubPlayers.length;
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
              <p className="mt-1.5 break-words tabular-nums">
                <span className="font-semibold text-white">AVG</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamStats ? formatAvgLike(teamStats.avg) : "—"}
                </span>{" "}
                <span className="text-[var(--text-muted)]">|</span>{" "}
                <span className="font-semibold text-white">OBP</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamStats ? formatAvgLike(teamStats.obp) : "—"}
                </span>{" "}
                <span className="text-[var(--text-muted)]">|</span>{" "}
                <span className="font-semibold text-white">SLG</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamStats ? formatAvgLike(teamStats.slg) : "—"}
                </span>{" "}
                <span className="text-[var(--text-muted)]">|</span>{" "}
                <span className="font-semibold text-white">OPS</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamStats ? formatAvgLike(teamStats.ops) : "—"}
                </span>
              </p>
            </div>
            <div>
              <p className="font-display text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Plate discipline
              </p>
              <p className="mt-1.5 break-words tabular-nums">
                <span className="font-semibold text-white">K%</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamStats ? formatPctRate(teamStats.kPct) : "—"}
                </span>{" "}
                <span className="text-[var(--text-muted)]">|</span>{" "}
                <span className="font-semibold text-white">BB%</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamStats ? formatPctRate(teamStats.bbPct) : "—"}
                </span>{" "}
                <span className="text-[var(--text-muted)]">|</span>{" "}
                <span className="font-semibold text-white">P/PA</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamStats?.pPa != null ? formatPPa(teamStats.pPa) : "—"}
                </span>
              </p>
            </div>
            <div>
              <p className="font-display text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Results
              </p>
              <p className="mt-1.5 break-words tabular-nums">
                <span className="font-semibold text-white">RISP</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamStatsRisp != null ? formatAvgLike(teamStatsRisp.avg) : "—"}
                </span>
                {teamStatsRisp != null && teamStatsRisp.pa != null && teamStatsRisp.pa > 0 && (
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {" "}
                    ({teamStatsRisp.h ?? 0} for {teamStatsRisp.ab ?? 0})
                  </span>
                )}{" "}
                <span className="text-[var(--text-muted)]">|</span>{" "}
                <span className="font-semibold text-white">RBI</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamStats != null ? String(teamStats.rbi ?? 0) : "—"}
                </span>{" "}
                <span className="text-[var(--text-muted)]">|</span>{" "}
                <span className="font-semibold text-white">2B</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamStats != null ? String(teamStats.double ?? 0) : "—"}
                </span>{" "}
                <span className="text-[var(--text-muted)]">|</span>{" "}
                <span className="font-semibold text-white">HR</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamStats != null ? String(teamStats.hr ?? 0) : "—"}
                </span>
              </p>
            </div>
          </div>

          <div className="min-w-0 space-y-5 lg:border-r lg:border-[var(--border)] lg:pr-6 xl:pr-8">
            <div>
              <p className="font-display text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Run prevention
              </p>
              <p className="mt-1.5 break-words tabular-nums">
                <span className="font-semibold text-white">ERA</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamPitchingStats ? formatEraLike(teamPitchingStats.era, teamPitchingStats.ip > 0) : "—"}
                </span>{" "}
                <span className="text-[var(--text-muted)]">|</span>{" "}
                <span className="font-semibold text-white">WHIP</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamPitchingStats ? formatEraLike(teamPitchingStats.whip, teamPitchingStats.ip > 0) : "—"}
                </span>{" "}
                <span className="text-[var(--text-muted)]">|</span>{" "}
                <span className="font-semibold text-white">FIP</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamPitchingStats ? formatEraLike(teamPitchingStats.fip, teamPitchingStats.ip > 0) : "—"}
                </span>
              </p>
            </div>
            <div>
              <p className="font-display text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Command
              </p>
              <p className="mt-1.5 break-words tabular-nums">
                <span className="font-semibold text-white">K%</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamPitchingStats ? formatPctRate(teamPitchingStats.rates.kPct) : "—"}
                </span>{" "}
                <span className="text-[var(--text-muted)]">|</span>{" "}
                <span className="font-semibold text-white">BB%</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamPitchingStats ? formatPctRate(teamPitchingStats.rates.bbPct) : "—"}
                </span>{" "}
                <span className="text-[var(--text-muted)]">|</span>{" "}
                <span className="font-semibold text-white">Strike%</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamPitchingStats?.rates.strikePct != null
                    ? formatPctRate(teamPitchingStats.rates.strikePct)
                    : "—"}
                </span>
              </p>
            </div>
            <div>
              <p className="font-display text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Efficiency
              </p>
              <p className="mt-1.5 break-words tabular-nums">
                <span className="font-semibold text-white">P/PA</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamPitchingStats?.rates.pPa != null ? formatPPa(teamPitchingStats.rates.pPa) : "—"}
                </span>{" "}
                <span className="text-[var(--text-muted)]">|</span>{" "}
                <span className="font-semibold text-white">FPS%</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamPitchingStats?.rates.fpsPct != null
                    ? formatPctRate(teamPitchingStats.rates.fpsPct)
                    : "—"}
                </span>
              </p>
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            <div>
              <p className="font-display text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Stolen bases
              </p>
              <p className="mt-1.5 break-words tabular-nums">
                <span className="font-semibold text-white">SB</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamStats != null ? String(teamStats.sb ?? 0) : "—"}
                </span>{" "}
                <span className="text-[var(--text-muted)]">|</span>{" "}
                <span className="font-semibold text-white">CS</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamStats != null ? String(teamStats.cs ?? 0) : "—"}
                </span>{" "}
                <span className="text-[var(--text-muted)]">|</span>{" "}
                <span className="font-semibold text-white">SB%</span>{" "}
                <span className="font-semibold text-[var(--accent)]">
                  {teamStats?.sbPct != null ? formatPctRate(teamStats.sbPct) : "—"}
                </span>
              </p>
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
