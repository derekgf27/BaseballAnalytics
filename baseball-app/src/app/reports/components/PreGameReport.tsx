"use client";

import type { PreGameOverviewPayload, PreGameRecentHitterLine } from "@/app/reports/actions";
import { isPitcherPlayer, ourTeamName, opponentTeamName } from "@/lib/opponentUtils";
import { formatDateMMDDYYYY } from "@/lib/format";
import { formatBattingTripleSlash } from "@/lib/format/battingSlash";
import type { BattingStatsWithSplits, Bats, Game, Player, Throws } from "@/lib/types";

function fmt3(n: number | undefined | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(3);
}

function batsAbbr(b: Bats | null | undefined): string {
  if (b === "L") return "L";
  if (b === "R") return "R";
  if (b === "S") return "S";
  return "—";
}

function formatRecentLine(
  line: PreGameRecentHitterLine | null | undefined,
  recentGamesCount: number
): string {
  if (!line || line.pa < 1) {
    if (recentGamesCount > 0) return `No PAs in last ${recentGamesCount} team games`;
    return "—";
  }
  const ch =
    line.chasePct != null ? ` · Chase ${Math.round(line.chasePct * 100)}%` : "";
  return `${line.pa} PA · OPS ${line.ops.toFixed(3)} · K% ${Math.round(line.kPct * 100)}% · BB% ${Math.round(line.bbPct * 100)}%${ch}`;
}

function slashVsOppStarter(
  splits: BattingStatsWithSplits | undefined,
  oppThrows: Throws | null | undefined
): { slash: string; detail: string } {
  const o = splits?.overall;
  if (!o) return { slash: "—", detail: "No logged PAs" };

  if (!oppThrows) {
    return {
      slash: formatBattingTripleSlash(o.avg, o.obp, o.slg),
      detail: "Season",
    };
  }

  const plat = oppThrows === "L" ? splits.vsL : splits.vsR;
  const pa = plat?.pa ?? 0;
  if (plat && pa >= 1) {
    return {
      slash: formatBattingTripleSlash(plat.avg, plat.obp, plat.slg),
      detail: oppThrows === "L" ? `vs LHP (${pa} PA)` : `vs RHP (${pa} PA)`,
    };
  }

  return {
    slash: formatBattingTripleSlash(o.avg, o.obp, o.slg),
    detail: `Season (${oppThrows === "L" ? "vs LHP" : "vs RHP"} n/a)`,
  };
}

function resolvePlayer(id: string, overview: PreGameOverviewPayload | null, roster: Player[]): Player | undefined {
  return overview?.playersById[id] ?? roster.find((p) => p.id === id);
}

function HitterNameCell({
  name,
  posLabel,
  batsLetter,
  footnote,
}: {
  name: string;
  posLabel: string;
  batsLetter: string;
  footnote?: string;
}) {
  const meta = [posLabel !== "—" ? posLabel : null, batsLetter !== "—" ? batsLetter : null].filter(Boolean).join(" · ");
  return (
    <td className="px-3 py-2.5">
      <div className="font-medium text-[var(--text)]">{name}</div>
      {meta ? <div className="text-xs text-[var(--text-muted)]">{meta}</div> : null}
      {footnote ? (
        <div className="mt-0.5 text-[10px] leading-snug text-[var(--text-faint)]">{footnote}</div>
      ) : null}
    </td>
  );
}

export function PreGameReport({
  game,
  roster,
  statsByPlayerId,
  trendInsights,
  overview,
}: {
  game: Game;
  roster: Player[];
  statsByPlayerId: Record<string, BattingStatsWithSplits | undefined>;
  trendInsights: string[];
  overview: PreGameOverviewPayload | null;
}) {
  const batters = roster.filter((p) => !isPitcherPlayer(p));
  const withOps = batters
    .map((p) => {
      const o = statsByPlayerId[p.id]?.overall;
      const pa = o?.pa ?? 0;
      const ops = o?.ops ?? 0;
      return { player: p, pa, ops };
    })
    .filter((x) => x.pa >= 1)
    .sort((a, b) => b.ops - a.ops)
    .slice(0, 6);

  const timeLine =
    game.game_time && String(game.game_time).trim()
      ? ` · ${String(game.game_time).slice(0, 5)}`
      : "";

  const ourSpId =
    game.our_side === "home" ? game.starting_pitcher_home_id ?? null : game.starting_pitcher_away_id ?? null;
  const oppSpId =
    game.our_side === "home" ? game.starting_pitcher_away_id ?? null : game.starting_pitcher_home_id ?? null;

  const ourSp = ourSpId ? resolvePlayer(ourSpId, overview, roster) : undefined;
  const oppSp = oppSpId ? resolvePlayer(oppSpId, overview, roster) : undefined;
  const oppThrows = oppSp?.throws ?? null;
  /** Our starter’s handedness — opponent hitters face this for platoon splits. */
  const ourThrows = ourSp?.throws ?? null;

  const ourLineup = overview?.ourLineup ?? [];
  const opponentLineup = overview?.opponentLineup ?? [];
  const priorMeetings = overview?.priorMeetings ?? [];
  const recentHitterLineByPlayerId = overview?.recentHitterLineByPlayerId ?? {};
  const recentGamesCount = overview?.recentGamesCount ?? 0;

  return (
    <div className="space-y-8">
      <section id="pre-overview" className="scroll-mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
        <h2 className="font-display border-b border-[var(--border)] pb-3 text-lg font-semibold tracking-tight text-[var(--text)]">
          Game overview
        </h2>

        <div className="mt-5 space-y-2 text-[var(--text)]">
          <p className="font-display text-2xl font-bold leading-tight sm:text-3xl">
            {game.away_team} <span className="text-[var(--text-muted)]">@</span> {game.home_team}
          </p>
          <p className="text-base text-[var(--text-muted)]">
            {formatDateMMDDYYYY(game.date)}
            {timeLine}
          </p>
        </div>

        <div id="pre-lineups" className="scroll-mt-6 mt-8">
          <h3 className="font-display text-base font-semibold text-[var(--text)]">Lineups</h3>

          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div className="min-w-0">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--accent)]">{ourTeamName(game)}</h4>
              {ourLineup.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                  <table className="w-full min-w-[280px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                        <th className="w-10 px-2 py-2 font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          #
                        </th>
                        <th className="px-2 py-2 font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          Hitter
                        </th>
                        <th
                          className="px-2 py-2 text-right font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                          title="AVG / OBP / SLG"
                        >
                          AVG/OBP/SLG
                        </th>
                        <th className="px-2 py-2 font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          Recent
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ourLineup.map((row) => {
                        const p = resolvePlayer(row.player_id, overview, roster);
                        const splits =
                          statsByPlayerId[row.player_id] ?? overview?.lineupStatsByPlayerId[row.player_id];
                        const { slash, detail } = slashVsOppStarter(splits, oppThrows);
                        const pos =
                          row.position?.trim() ||
                          p?.positions?.filter((x) => x.trim().toUpperCase() !== "P")[0] ||
                          "—";
                        const recentLine = formatRecentLine(
                          recentHitterLineByPlayerId[row.player_id],
                          recentGamesCount
                        );
                        return (
                          <tr key={`${row.slot}-${row.player_id}`} className="border-b border-[var(--border)]">
                            <td className="px-2 py-2 tabular-nums text-[var(--text-muted)]">{row.slot}</td>
                            <HitterNameCell
                              name={p?.name ?? "Unknown"}
                              posLabel={pos}
                              batsLetter={batsAbbr(p?.bats)}
                              footnote={detail}
                            />
                            <td className="px-2 py-2 text-right font-display tabular-nums font-semibold text-[var(--accent)]">
                              {slash}
                            </td>
                            <td className="px-2 py-2 text-xs leading-snug text-[var(--text-muted)]">{recentLine}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-elevated)]/30 px-4 py-6 text-center text-sm text-[var(--text)]">
                  No lineup.
                </p>
              )}
            </div>

            <div className="min-w-0">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {opponentTeamName(game)}
              </h4>
              {opponentLineup.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                  <table className="w-full min-w-[240px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                        <th className="w-10 px-2 py-2 font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          #
                        </th>
                        <th className="px-2 py-2 font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          Hitter
                        </th>
                        <th
                          className="px-2 py-2 text-right font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                          title="AVG / OBP / SLG"
                        >
                          AVG/OBP/SLG
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {opponentLineup.map((row) => {
                        const p = resolvePlayer(row.player_id, overview, roster);
                        const splits =
                          statsByPlayerId[row.player_id] ?? overview?.lineupStatsByPlayerId[row.player_id];
                        const { slash, detail } = slashVsOppStarter(splits, ourThrows);
                        const pos =
                          row.position?.trim() ||
                          p?.positions?.filter((x) => x.trim().toUpperCase() !== "P")[0] ||
                          "—";
                        return (
                          <tr key={`opp-${row.slot}-${row.player_id}`} className="border-b border-[var(--border)]">
                            <td className="px-2 py-2 tabular-nums text-[var(--text-muted)]">{row.slot}</td>
                            <HitterNameCell
                              name={p?.name ?? "Unknown"}
                              posLabel={pos}
                              batsLetter={batsAbbr(p?.bats)}
                              footnote={detail}
                            />
                            <td className="px-2 py-2 text-right font-display tabular-nums font-semibold text-[var(--accent)]">
                              {slash}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-elevated)]/30 px-4 py-6 text-center text-sm text-[var(--text)]">
                  No lineup.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {priorMeetings.length > 0 ? (
        <section id="pre-history" className="scroll-mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
          <h2 className="font-display border-b border-[var(--border)] pb-3 text-lg font-semibold tracking-tight text-[var(--text)]">
            Last meetings vs this opponent
          </h2>
          <ul className="mt-4 space-y-3">
            {priorMeetings.map((m) => {
              const score =
                m.ourRuns != null && m.oppRuns != null ? `${m.ourRuns}–${m.oppRuns}` : "Score not set";
              const tag = m.outcome ? (
                <span
                  className={`ml-2 font-display text-xs font-bold ${
                    m.outcome === "W"
                      ? "text-emerald-400"
                      : m.outcome === "L"
                        ? "text-rose-300"
                        : "text-[var(--text-muted)]"
                  }`}
                >
                  {m.outcome}
                </span>
              ) : null;
              const pasBit = m.fromPas
                ? ` · Logged offense (${ourTeamName(game)}): ${m.fromPas.pa} PA, OPS ${m.fromPas.ops.toFixed(3)}, K% ${Math.round(m.fromPas.kPct * 100)}%, BB% ${Math.round(m.fromPas.bbPct * 100)}%`
                : ` · No logged PAs for ${ourTeamName(game)} in that game`;
              return (
                <li
                  key={m.gameId}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/30 px-4 py-3 text-sm text-[var(--text)]"
                >
                  <span className="font-semibold">{formatDateMMDDYYYY(m.date)}</span>
                  {tag}
                  <span className="text-[var(--text-muted)]">
                    {" "}
                    — {score}
                    {pasBit}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section id="pre-leaders" className="scroll-mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
        <h2 className="font-display border-b border-[var(--border)] pb-3 text-lg font-semibold tracking-tight text-[var(--text)]">
          Who&apos;s swinging well (season, logged PAs)
        </h2>
        {withOps.length > 0 ? (
          <ul className="mt-5 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/40">
            {withOps.map(({ player, pa, ops }, i) => {
              const o = statsByPlayerId[player.id]?.overall;
              const slash = o ? formatBattingTripleSlash(o.avg, o.obp, o.slg) : `OPS ${fmt3(ops)}`;
              return (
                <li
                  key={player.id}
                  className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3 text-[var(--text)]"
                >
                  <span className="font-medium">
                    <span className="text-[var(--text-faint)] tabular-nums">{i + 1}.</span> {player.name}
                  </span>
                  <span className="font-display tabular-nums text-lg font-bold text-[var(--accent)]">
                    {pa} PA · {slash}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {trendInsights.length > 0 ? (
        <section id="pre-trends" className="scroll-mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
          <h2 className="font-display border-b border-[var(--border)] pb-3 text-lg font-semibold tracking-tight text-[var(--text)]">
            Team trends to keep in mind
          </h2>
          <ul className="mt-5 list-inside list-disc space-y-2.5 text-base leading-relaxed text-[var(--text)]">
            {trendInsights.slice(0, 8).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section id="pre-checklist" className="scroll-mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
        <h2 className="font-display border-b border-[var(--border)] pb-3 text-lg font-semibold tracking-tight text-[var(--text)]">
          Pre-game checklist
        </h2>
        <ul className="mt-5 space-y-3 text-base leading-relaxed text-[var(--text)]">
          <li className="flex gap-3">
            <span className="font-bold text-[var(--accent)]">1.</span>
            <span>Confirm lineup and defensive alignment vs this opponent&apos;s handedness and recent tendencies.</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-[var(--accent)]">2.</span>
            <span>
              Agree on approach by inning situation (early count, RISP, two-strike)—match to what you&apos;ve logged in
              practice and past games.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-[var(--accent)]">3.</span>
            <span>Bullpen availability and who covers late innings if the starter shortens.</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-[var(--accent)]">4.</span>
            <span>
              After the game, use <strong className="text-[var(--text)]">Post-Game</strong> on this hub for PA-based
              offense and discipline notes.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
