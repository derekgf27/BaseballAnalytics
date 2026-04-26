"use client";

import type { PreGameOverviewPayload, PreGameRecentHitterLine } from "@/app/reports/actions";
import {
  isPitcherPlayer,
  matchupLabelUsFirst,
  opponentTeamName,
  ourTeamName,
  ourVenueLabel,
} from "@/lib/opponentUtils";
import { formatDateMMDDYYYY } from "@/lib/format";
import { formatBattingTripleSlash } from "@/lib/format/battingSlash";
import type { BattingStats, BattingStatsWithSplits, Bats, Game, Player, Throws } from "@/lib/types";

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

function pct1(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function formatRecentLine(
  line: PreGameRecentHitterLine | null | undefined,
  recentGamesCount: number
): string {
  if (!line || line.pa < 1) {
    if (recentGamesCount > 0) return `No PAs in last ${recentGamesCount} team games`;
    return "—";
  }
  return `${line.pa} PA · OPS ${line.ops.toFixed(3)} · K% ${Math.round(line.kPct * 100)}% · BB% ${Math.round(line.bbPct * 100)}%`;
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

function fmtHitsAb(stats: BattingStats | null | undefined): string {
  if (!stats || (stats.pa ?? 0) < 1) return "—";
  const h = stats.h ?? 0;
  const ab = stats.ab ?? 0;
  return `${h}–${ab}`;
}

function fmtKbbFromLine(stats: BattingStats | null | undefined): { kPct: string; bbPct: string } {
  if (!stats || (stats.pa ?? 0) < 1) return { kPct: "—", bbPct: "—" };
  return { kPct: pct1(stats.kPct), bbPct: pct1(stats.bbPct) };
}

function fmtPpa(stats: BattingStats | null | undefined): string {
  const ppa = stats?.pPa;
  if (ppa == null || !Number.isFinite(ppa)) return "—";
  return ppa.toFixed(1);
}

function rispSlashDisplay(s: string | null | undefined): string {
  if (!s) return "—";
  return s.replace(/\b0\./g, ".");
}

function rispCompactRow(player: Player, splits: BattingStatsWithSplits | undefined): {
  playerId: string;
  name: string;
  jersey: string;
  posLabel: string;
  bats: string;
  pa: number;
  hAbDisplay: string;
  opsDisplay: string;
  slash: string;
  kPctDisplay: string;
  bbPctDisplay: string;
} | null {
  const r = splits?.risp;
  if (!r || (r.pa ?? 0) < 1) return null;
  const kb = fmtKbbFromLine(r);
  return {
    playerId: player.id,
    name: player.name,
    jersey: player.jersey?.trim() || "—",
    posLabel: player.positions?.filter((x) => x.trim().toUpperCase() !== "P")[0] || "—",
    bats: batsAbbr(player.bats),
    pa: r.pa ?? 0,
    hAbDisplay: fmtHitsAb(r),
    opsDisplay: fmtSeason(r.ops),
    slash: formatBattingTripleSlash(r.avg, r.obp, r.slg),
    kPctDisplay: kb.kPct,
    bbPctDisplay: kb.bbPct,
  };
}

/** Row for platoon leaderboard: same sample rules as {@link slashVsOppStarter}; `sortOps` drives sort order. */
function platoonVsStarterLeaderboardRow(
  player: Player,
  splits: BattingStatsWithSplits | undefined,
  oppThrows: Throws | null | undefined
): {
  playerId: string;
  name: string;
  jersey: string;
  posLabel: string;
  bats: string;
  pa: number;
  slash: string;
  opsDisplay: string;
  hAbDisplay: string;
  ppaDisplay: string;
  kPctDisplay: string;
  bbPctDisplay: string;
  sortOps: number;
} {
  const o = splits?.overall;
  const jersey = player.jersey?.trim() || "—";
  const posLabel = player.positions?.filter((x) => x.trim().toUpperCase() !== "P")[0] || "—";
  const bats = batsAbbr(player.bats);
  if (!o || (o.pa ?? 0) < 1) {
    return {
      playerId: player.id,
      name: player.name,
      jersey,
      posLabel,
      bats,
      pa: 0,
      slash: "—",
      opsDisplay: "—",
      hAbDisplay: "—",
      ppaDisplay: "—",
      kPctDisplay: "—",
      bbPctDisplay: "—",
      sortOps: -1,
    };
  }

  if (!oppThrows) {
    const kb = fmtKbbFromLine(o);
    return {
      playerId: player.id,
      name: player.name,
      jersey,
      posLabel,
      bats,
      pa: o.pa ?? 0,
      slash: formatBattingTripleSlash(o.avg, o.obp, o.slg),
      opsDisplay: fmtSeason(o.ops),
      hAbDisplay: fmtHitsAb(o),
      ppaDisplay: fmtPpa(o),
      kPctDisplay: kb.kPct,
      bbPctDisplay: kb.bbPct,
      sortOps: o.ops,
    };
  }

  const plat = oppThrows === "L" ? splits?.vsL : splits?.vsR;
  const platPa = plat?.pa ?? 0;
  if (plat && platPa >= 1) {
    const kb = fmtKbbFromLine(plat);
    return {
      playerId: player.id,
      name: player.name,
      jersey,
      posLabel,
      bats,
      pa: platPa,
      slash: formatBattingTripleSlash(plat.avg, plat.obp, plat.slg),
      opsDisplay: fmtSeason(plat.ops),
      hAbDisplay: fmtHitsAb(plat),
      ppaDisplay: fmtPpa(plat),
      kPctDisplay: kb.kPct,
      bbPctDisplay: kb.bbPct,
      sortOps: plat.ops,
    };
  }

  const kb = fmtKbbFromLine(o);
  return {
    playerId: player.id,
    name: player.name,
    jersey,
    posLabel,
    bats,
    pa: o.pa ?? 0,
    slash: formatBattingTripleSlash(o.avg, o.obp, o.slg),
    opsDisplay: fmtSeason(o.ops),
    hAbDisplay: fmtHitsAb(o),
    ppaDisplay: fmtPpa(o),
    kPctDisplay: kb.kPct,
    bbPctDisplay: kb.bbPct,
    sortOps: o.ops,
  };
}

function fmtSeason(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(3);
}

function pitcherHandLabel(t: Throws | null | undefined): string {
  if (t === "L") return "LHP";
  if (t === "R") return "RHP";
  return "—";
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
  const rep = overview?.report;
  const seasonStatsById = overview?.lineupStatsByPlayerId ?? {};
  const ourStarterSummary = overview?.ourStarterSummary ?? null;

  const lineupPlayerIds = new Set(ourLineup.map((r) => r.player_id));
  const ourBench = roster
    .filter((p) => !lineupPlayerIds.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const platoonPrintRows = batters
    .map((p) =>
      platoonVsStarterLeaderboardRow(p, statsByPlayerId[p.id] ?? seasonStatsById[p.id], oppThrows)
    )
    .sort((a, b) => {
      const ak = Number.isFinite(a.sortOps) ? a.sortOps : -1;
      const bk = Number.isFinite(b.sortOps) ? b.sortOps : -1;
      if (bk !== ak) return bk - ak;
      if (b.pa !== a.pa) return b.pa - a.pa;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

  const rispAllRows = batters
    .map((p) => rispCompactRow(p, statsByPlayerId[p.id] ?? seasonStatsById[p.id]))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const rispSortedRows = [...rispAllRows].sort((a, b) => {
    const ao = Number.isFinite(Number(a.opsDisplay)) ? Number(a.opsDisplay) : -1;
    const bo = Number.isFinite(Number(b.opsDisplay)) ? Number(b.opsDisplay) : -1;
    if (bo !== ao) return bo - ao;
    if (b.pa !== a.pa) return b.pa - a.pa;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  const rispBackupRows = rispSortedRows.slice(0, 10);

  const seasonAvgOps = (playerId: string): { avg: string; ops: string } => {
    const s = statsByPlayerId[playerId]?.overall ?? seasonStatsById[playerId]?.overall;
    return { avg: fmtSeason(s?.avg), ops: fmtSeason(s?.ops) };
  };

  return (
    <>
      <section className="hidden print:block rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">{matchupLabelUsFirst(game, true)}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {formatDateMMDDYYYY(game.date)} · {ourVenueLabel(game)} · Season AVG/OPS
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 print:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] p-4">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--accent)]">
              Starters
            </h2>
            <ul className="mt-3 space-y-2.5">
              {ourLineup.map((row) => {
                const p = resolvePlayer(row.player_id, overview, roster);
                const pos =
                  row.position?.trim() || p?.positions?.filter((x) => x.trim().toUpperCase() !== "P")[0] || "—";
                const jersey = p?.jersey?.trim() || "—";
                const st = seasonAvgOps(row.player_id);
                return (
                  <li key={`print-our-${row.slot}-${row.player_id}`} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {row.slot}. {p?.name ?? "Unknown"}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">#{jersey} · {pos}</p>
                    </div>
                    <p className="shrink-0 text-[11px] font-semibold text-[var(--text)]">
                      AVG {st.avg} · OPS {st.ops}
                    </p>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 border-t border-[var(--border)] pt-3 px-1 py-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Starting pitcher</p>
              <div className="mt-1 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)]">{ourStarterSummary?.name ?? "—"}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    #{ourSp?.jersey?.trim() || "—"} · {pitcherHandLabel(ourSp?.throws ?? null)}
                  </p>
                </div>
                <p className="shrink-0 text-[11px] font-semibold text-[var(--text)]">
                  ERA {ourStarterSummary?.seasonEra ?? "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] p-4">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--accent)]">Bench</h2>
            {ourBench.length > 0 ? (
              <ul className="mt-3 space-y-2.5">
                {ourBench.map((p) => {
                  const pos = p.positions?.filter((x) => x.trim().toUpperCase() !== "P")[0] || "—";
                  const jersey = p.jersey?.trim() || "—";
                  const st = seasonAvgOps(p.id);
                  return (
                    <li key={`print-bench-${p.id}`} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text)]">{p.name}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">#{jersey} · {pos}</p>
                      </div>
                      <p className="shrink-0 text-[11px] font-semibold text-[var(--text)]">
                        AVG {st.avg} · OPS {st.ops}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[var(--text-muted)]">No bench hitters outside the lineup.</p>
            )}
          </div>
        </div>
      </section>

      <section className="hidden print:block print:break-before-page rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--text)]">Platoon splits</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {oppThrows
            ? `vs ${pitcherHandLabel(oppThrows)} · all hitters · sorted by OPS`
            : "Opponent starter handedness unknown — season overall · sorted by OPS"}
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                <th className="px-2 py-1.5 font-semibold uppercase tracking-wider text-[var(--text-muted)]">Hitter</th>
                <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wider text-[var(--text-muted)]">PA</th>
                <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wider text-[var(--text-muted)]">H-AB</th>
                <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wider text-[var(--text-muted)]">P/PA</th>
                <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wider text-[var(--text-muted)]">OPS</th>
                <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  AVG/OBP/SLG
                </th>
                <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wider text-[var(--text-muted)]">K%</th>
                <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wider text-[var(--text-muted)]">BB%</th>
              </tr>
            </thead>
            <tbody>
              {platoonPrintRows.map((row) => {
                const subMeta = [
                  row.jersey !== "—" ? `#${row.jersey}` : null,
                  row.posLabel !== "—" ? row.posLabel : null,
                  row.bats !== "—" ? row.bats : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <tr key={`print-platoon-${row.playerId}`} className="border-b border-[var(--border)]">
                    <td className="px-2 py-1.5">
                      <div className="font-medium text-[var(--text)]">{row.name}</div>
                      {subMeta ? (
                        <div className="mt-0.5 text-[10px] leading-snug text-[var(--text-muted)]">{subMeta}</div>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-[var(--text)]">{row.pa}</td>
                    <td className="px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">{row.hAbDisplay}</td>
                    <td className="px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">{row.ppaDisplay}</td>
                    <td className="px-2 py-1.5 text-right font-display tabular-nums font-semibold text-[var(--text)]">
                      {row.opsDisplay}
                    </td>
                    <td className="px-2 py-1.5 text-right font-display tabular-nums font-semibold text-[var(--text)]">
                      {row.slash}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-[var(--text)]">{row.kPctDisplay}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-[var(--text)]">{row.bbPctDisplay}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="hidden print:block print:break-before-page rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--text)]">RISP and situational hitting</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Compact RISP snapshot and quick hitter list.
        </p>

        <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/25 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Team RISP (season)</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span className="text-[var(--text-muted)]">PA <span className="font-semibold text-[var(--text)]">{rep?.hittingTrends?.season?.rispSlash.match(/\((\d+)\sPA\)/)?.[1] ?? "—"}</span></span>
            <span className="text-[var(--text-muted)]">H-AB <span className="font-semibold text-[var(--text)]">{rep?.hittingTrends?.season?.rispHab ?? "—"}</span></span>
            <span className="text-[var(--text-muted)]">OPS <span className="font-semibold text-[var(--text)]">{rep?.hittingTrends?.season ? fmtSeason(rep.hittingTrends.season.ops) : "—"}</span></span>
            <span className="text-[var(--text-muted)]">Slash <span className="font-semibold text-[var(--text)]">{rispSlashDisplay(rep?.hittingTrends?.season?.rispSlash ?? "—").replace(/\s*\(\d+\sPA\)\s*$/, "")}</span></span>
          </div>
        </div>

        {rispSortedRows.length > 0 ? (
          <>
            <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                    <th className="px-2 py-1.5 font-semibold uppercase tracking-wider text-[var(--text-muted)]">Hitter</th>
                    <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wider text-[var(--text-muted)]">PA</th>
                    <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wider text-[var(--text-muted)]">H-AB</th>
                    <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wider text-[var(--text-muted)]">OPS</th>
                    <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wider text-[var(--text-muted)]">K%</th>
                  </tr>
                </thead>
                <tbody>
                  {rispBackupRows.map((row) => (
                    <tr key={`print-risp-backup-${row.playerId}`} className="border-b border-[var(--border)]">
                      <td className="px-2 py-1.5 font-medium text-[var(--text)]">{row.name}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-[var(--text)]">{row.pa}</td>
                      <td className="px-2 py-1.5 text-right font-display tabular-nums text-[var(--text)]">{row.hAbDisplay}</td>
                      <td className="px-2 py-1.5 text-right font-display tabular-nums font-semibold text-[var(--text)]">
                        {row.opsDisplay}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-[var(--text)]">{row.kPctDisplay}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-[var(--text-muted)]">No logged RISP plate appearances yet.</p>
        )}
      </section>

      <div className="space-y-8 print:hidden">
      <section id="pre-overview" className="scroll-mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
        <h2 className="font-display border-b border-[var(--border)] pb-3 text-lg font-semibold tracking-tight text-[var(--text)]">
          Game overview
        </h2>

        <div className="mt-5 space-y-2 text-[var(--text)]">
          <p className="font-display text-2xl font-bold leading-tight sm:text-3xl">
            {matchupLabelUsFirst(game, true)}
          </p>
          <p className="text-base text-[var(--text-muted)]">
            {formatDateMMDDYYYY(game.date)}
            {timeLine}
          </p>
        </div>

        {rep ? (
          <div className="mt-8 space-y-10">
            <div id="pre-context" className="scroll-mt-6">
              <h3 className="font-display text-base font-semibold text-[var(--text)]">Game context</h3>
              <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-relaxed text-[var(--text-muted)]">
                {rep.gameContext.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>

            {rep.pitchingPlan ? (
              <div id="pre-pitching" className="scroll-mt-6">
                <h3 className="font-display text-base font-semibold text-[var(--text)]">Pitching plan</h3>
                <div className="mt-3 space-y-3 text-sm text-[var(--text)]">
                  <p className="font-medium text-[var(--text)]">
                    {rep.pitchingPlan.starterName ?? "Starting pitcher"}{" "}
                    {rep.pitchingPlan.seasonIp && rep.pitchingPlan.seasonEra
                      ? `· Season ${rep.pitchingPlan.seasonIp} IP, ERA ${rep.pitchingPlan.seasonEra}`
                      : null}
                  </p>
                  {rep.pitchingPlan.lastOuting ? (
                    <p className="text-[var(--text-muted)]">Last outing: {rep.pitchingPlan.lastOuting}</p>
                  ) : null}
                  {rep.pitchingPlan.planNotes ? (
                    <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/40 px-4 py-3 text-[var(--text)]">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">Staff notes</span>
                      <span className="mt-1 block leading-relaxed">{rep.pitchingPlan.planNotes}</span>
                    </p>
                  ) : null}
                  {rep.pitchingPlan.pitchMix.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                      <table className="w-full min-w-[320px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                            <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                              Pitch
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                              Usage
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                              Strike%
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                              Whiff%
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                              n
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rep.pitchingPlan.pitchMix.map((row) => (
                            <tr key={row.label} className="border-b border-[var(--border)]">
                              <td className="px-3 py-2 font-medium">{row.label}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{pct1(row.usagePct)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{pct1(row.strikePct)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{pct1(row.whiffPct)}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-[var(--text-muted)]">{row.pitches}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {rep.pitchingPlan.pitchMixFootnote ? (
                    <p className="text-xs text-[var(--text-faint)]">{rep.pitchingPlan.pitchMixFootnote}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {rep.hittingTrends ? (
              <div id="pre-hitting-trends" className="scroll-mt-6">
                <h3 className="font-display text-base font-semibold text-[var(--text)]">Hitting trends</h3>
                <p className="mt-1 text-xs text-[var(--text-faint)]">{rep.hittingTrends.windowLabel}</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {rep.hittingTrends.season ? (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/30 p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Wider sample</div>
                      <p className="mt-2 font-display text-lg font-bold text-[var(--accent)]">
                        OPS {rep.hittingTrends.season.ops.toFixed(3)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {rep.hittingTrends.season.pa} PA · K% {pct1(rep.hittingTrends.season.kPct)} · BB%{" "}
                        {pct1(rep.hittingTrends.season.bbPct)}
                      </p>
                      <p className="mt-2 text-xs text-[var(--text-faint)]">
                        RISP slash: {rep.hittingTrends.season.rispSlash}
                        {rep.hittingTrends.season.fpsPct != null ? ` · FPS ${pct1(rep.hittingTrends.season.fpsPct)}` : ""}
                      </p>
                    </div>
                  ) : null}
                  {rep.hittingTrends.recent ? (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/30 p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Recent games</div>
                      <p className="mt-2 font-display text-lg font-bold text-[var(--accent)]">
                        OPS {rep.hittingTrends.recent.ops.toFixed(3)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {rep.hittingTrends.recent.pa} PA · K% {pct1(rep.hittingTrends.recent.kPct)} · BB%{" "}
                        {pct1(rep.hittingTrends.recent.bbPct)}
                      </p>
                      <p className="mt-2 text-xs text-[var(--text-faint)]">RISP: {rep.hittingTrends.recent.rispSlash}</p>
                    </div>
                  ) : null}
                </div>
                {rep.hittingTrends.insights.length > 0 ? (
                  <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-[var(--text)]">
                    {rep.hittingTrends.insights.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {(rep.playerInsights.hot.length > 0 || rep.playerInsights.cold.length > 0) && (
              <div id="pre-players" className="scroll-mt-6">
                <h3 className="font-display text-base font-semibold text-[var(--text)]">Player insights</h3>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {rep.playerInsights.hot.length > 0 ? (
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-400/90">Heating up</div>
                      <ul className="mt-2 space-y-2 text-sm text-[var(--text)]">
                        {rep.playerInsights.hot.map((x) => (
                          <li key={x.name} className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/25 px-3 py-2">
                            <span className="font-medium">{x.name}</span>
                            <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{x.line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {rep.playerInsights.cold.length > 0 ? (
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-amber-200/80">Cooling off</div>
                      <ul className="mt-2 space-y-2 text-sm text-[var(--text)]">
                        {rep.playerInsights.cold.map((x) => (
                          <li key={x.name} className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/25 px-3 py-2">
                            <span className="font-medium">{x.name}</span>
                            <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{x.line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {rep.opponentObservations.length > 0 ? (
              <div id="pre-opp" className="scroll-mt-6">
                <h3 className="font-display text-base font-semibold text-[var(--text)]">Opponent observations</h3>
                <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-[var(--text)]">
                  {rep.opponentObservations.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {rep.matchupInsights.length > 0 ? (
              <div id="pre-matchup" className="scroll-mt-6">
                <h3 className="font-display text-base font-semibold text-[var(--text)]">Matchup insights</h3>
                <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-[var(--text)]">
                  {rep.matchupInsights.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {rep.gamePlan.length > 0 ? (
              <div id="pre-plan" className="scroll-mt-6">
                <h3 className="font-display text-base font-semibold text-[var(--text)]">Game plan</h3>
                <ol className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--text)]">
                  {rep.gamePlan.map((line, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="font-bold text-[var(--accent)]">{i + 1}.</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        ) : null}

        <div id="pre-lineups" className="scroll-mt-6 mt-10 border-t border-[var(--border)] pt-10">
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
                        const { detail } = slashVsOppStarter(splits, oppThrows);
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
                      </tr>
                    </thead>
                    <tbody>
                      {opponentLineup.map((row) => {
                        const p = resolvePlayer(row.player_id, overview, roster);
                        const splits =
                          statsByPlayerId[row.player_id] ?? overview?.lineupStatsByPlayerId[row.player_id];
                        const { detail } = slashVsOppStarter(splits, ourThrows);
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
              const outcomeClass =
                m.outcome === "W"
                  ? "text-emerald-400"
                  : m.outcome === "L"
                    ? "text-rose-300"
                    : "text-[var(--text-muted)]";
              const pasBit = m.fromPas
                ? ` · Logged offense (${ourTeamName(game)}): ${m.fromPas.pa} PA, OPS ${m.fromPas.ops.toFixed(3)}, K% ${Math.round(m.fromPas.kPct * 100)}%, BB% ${Math.round(m.fromPas.bbPct * 100)}%`
                : ` · No logged PAs for ${ourTeamName(game)} in that game`;
              return (
                <li
                  key={m.gameId}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/30 px-4 py-3 text-sm text-[var(--text)]"
                >
                  <span className="font-semibold">{formatDateMMDDYYYY(m.date)}</span>
                  {m.outcome ? <span className={`ml-2 font-display text-xs font-bold ${outcomeClass}`}>{m.outcome}</span> : null}
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
    </>
  );
}
