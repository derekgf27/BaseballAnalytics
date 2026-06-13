"use client";

import type { ReactNode } from "react";
import { fmtDecimalNoLeadingZero, formatDateMMDDYYYY } from "@/lib/format";
import { matchupLabelUsFirst, ourVenueLabel } from "@/lib/opponentUtils";
import type { PreGameOverviewPayload } from "@/app/reports/actions";
import type { PreGameHittingSnapshot, PreGamePitchMixRow } from "@/lib/reports/preGameReportBuild";
import type { Bats, BattingStats, BattingStatsWithSplits, Game, Throws } from "@/lib/types";

function fmtStat(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return fmtDecimalNoLeadingZero(n, 3);
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function batsLabel(b: Bats | null | undefined): string {
  if (b === "L" || b === "R" || b === "S") return b;
  return "—";
}

function pitcherHandLabel(t: Throws | null | undefined): string | null {
  if (t === "L") return "LHP";
  if (t === "R") return "RHP";
  return null;
}

function vsHandColumnLabel(pitcherThrows: Throws | null | undefined): string | null {
  if (pitcherThrows === "L") return "vs LHP";
  if (pitcherThrows === "R") return "vs RHP";
  return null;
}

function platoonSplitForPitcherHand(
  splits: BattingStatsWithSplits | undefined,
  pitcherThrows: Throws | null | undefined
): BattingStats | null {
  if (!splits || !pitcherThrows) return null;
  if (pitcherThrows === "L") return splits.vsL;
  if (pitcherThrows === "R") return splits.vsR;
  return null;
}

function Card({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`neo-card p-4 lg:p-5 ${className}`}>
      <h2 className="section-label mb-3">{title}</h2>
      {children}
    </section>
  );
}

type StatItem = { label: string; value: string };

function StatGrid({ items }: { items: StatItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--neo-text-muted)]">—</p>;
  }
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      {items.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--neo-text-muted)]">
            {label}
          </dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--neo-text)]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function hittingSnapshotItems(s: PreGameHittingSnapshot | null | undefined): StatItem[] {
  if (!s) return [];
  return [
    { label: "OPS", value: fmtStat(s.ops) },
    { label: "K%", value: fmtPct(s.kPct) },
    { label: "BB%", value: fmtPct(s.bbPct) },
    { label: "RISP OPS", value: s.rispOps != null ? fmtStat(s.rispOps) : "—" },
    { label: "FPS%", value: fmtPct(s.fpsPct) },
    { label: "PA", value: String(s.pa) },
  ];
}

function paWeightedLineupAggregate(
  playerIds: string[],
  stats: Record<string, { overall?: BattingStats } | undefined>
): StatItem[] {
  let pa = 0;
  let opsSum = 0;
  let kSum = 0;
  let bbSum = 0;
  for (const id of playerIds) {
    const o = stats[id]?.overall;
    const p = o?.pa ?? 0;
    if (p < 1) continue;
    pa += p;
    opsSum += (o?.ops ?? 0) * p;
    kSum += (o?.kPct ?? 0) * p;
    bbSum += (o?.bbPct ?? 0) * p;
  }
  if (pa < 1) return [];
  return [
    { label: "OPS", value: fmtStat(opsSum / pa) },
    { label: "K%", value: fmtPct(kSum / pa) },
    { label: "BB%", value: fmtPct(bbSum / pa) },
    { label: "PA", value: String(pa) },
  ];
}

function platoonCounts(playerIds: string[], playersById: Record<string, { bats?: Bats | null }>) {
  let l = 0;
  let r = 0;
  let s = 0;
  for (const id of playerIds) {
    const b = playersById[id]?.bats;
    if (b === "L") l += 1;
    else if (b === "R") r += 1;
    else if (b === "S") s += 1;
  }
  return { l, r, s };
}

function PitchMixTable({ rows }: { rows: PreGamePitchMixRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--neo-text-muted)]">—</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--neo-border)]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--neo-border)] bg-[#10161d] text-[10px] font-semibold uppercase tracking-wider text-[var(--neo-text-muted)]">
            <th className="px-3 py-2 text-left">Pitch</th>
            <th className="px-3 py-2 text-right">Use</th>
            <th className="px-3 py-2 text-right">Str%</th>
            <th className="px-3 py-2 text-right">Whiff%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-[var(--neo-border)]/60 last:border-0">
              <td className="px-3 py-2 font-medium text-[var(--neo-text)]">{row.label}</td>
              <td className="px-3 py-2 text-right tabular-nums text-[var(--neo-text)]">
                {fmtPct(row.usagePct)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-[var(--neo-text-muted)]">
                {fmtPct(row.strikePct)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-[var(--neo-text-muted)]">
                {fmtPct(row.whiffPct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type LineupRow = {
  slot: number;
  name: string;
  pos: string;
  bats: string;
  avg: string;
  ops: string;
  vsHandOps: string;
  vsHandK: string;
};

function buildLineupRows(
  slots: PreGameOverviewPayload["ourLineup"],
  playersById: PreGameOverviewPayload["playersById"],
  stats: PreGameOverviewPayload["lineupStatsByPlayerId"],
  opposingPitcherThrows: Throws | null | undefined
): LineupRow[] {
  return slots.map((row) => {
    const p = playersById[row.player_id];
    const o = stats[row.player_id]?.overall;
    const platoon = platoonSplitForPitcherHand(stats[row.player_id], opposingPitcherThrows);
    const pos =
      row.position?.trim() ||
      p?.positions?.find((x) => x.trim().toUpperCase() !== "P") ||
      "—";
    return {
      slot: row.slot,
      name: p?.name ?? "—",
      pos,
      bats: batsLabel(p?.bats),
      avg: fmtStat(o?.avg),
      ops: fmtStat(o?.ops),
      vsHandOps: platoon && (platoon.pa ?? 0) >= 1 ? fmtStat(platoon.ops) : "—",
      vsHandK: platoon && (platoon.pa ?? 0) >= 1 ? fmtPct(platoon.kPct) : "—",
    };
  });
}

function LineupTable({ rows, vsHandLabel }: { rows: LineupRow[]; vsHandLabel: string | null }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--neo-text-muted)]">—</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--neo-border)]">
      <table className="w-full min-w-[20rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--neo-border)] bg-[#10161d] text-[10px] font-semibold uppercase tracking-wider text-[var(--neo-text-muted)]">
            <th className="w-10 px-2 py-2 text-center">#</th>
            <th className="px-2 py-2 text-left">Player</th>
            <th className="w-12 px-2 py-2 text-center">Pos</th>
            <th className="w-10 px-2 py-2 text-center">B</th>
            <th className="w-14 px-2 py-2 text-right">AVG</th>
            <th className="w-14 px-2 py-2 text-right">OPS</th>
            {vsHandLabel ? (
              <>
                <th className="w-14 px-2 py-2 text-right">{vsHandLabel}</th>
                <th className="w-12 px-2 py-2 text-right">K%</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.slot} className="border-b border-[var(--neo-border)]/60 last:border-0">
              <td className="px-2 py-2 text-center">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[var(--accent-coach)] text-[10px] font-bold text-[var(--bg-base)]">
                  {row.slot}
                </span>
              </td>
              <td className="px-2 py-2 font-medium text-[var(--neo-text)]">{row.name}</td>
              <td className="px-2 py-2 text-center text-[var(--neo-text-muted)]">{row.pos}</td>
              <td className="px-2 py-2 text-center font-semibold text-[var(--neo-text)]">{row.bats}</td>
              <td className="px-2 py-2 text-right tabular-nums text-[var(--neo-text)]">{row.avg}</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold text-[var(--accent-coach)]">
                {row.ops}
              </td>
              {vsHandLabel ? (
                <>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold text-[var(--accent-coach)]">
                    {row.vsHandOps}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-[var(--neo-text-muted)]">
                    {row.vsHandK}
                  </td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ThreatRow = {
  slot: number;
  name: string;
  pa: string;
  ops: string;
  kPct: string;
  bbPct: string;
  hr: string;
  rispOps: string;
  sb: string;
  sortOps: number;
};

function rispSplitForPitcherHand(
  splits: BattingStatsWithSplits | undefined,
  pitcherThrows: Throws | null | undefined
): BattingStats | null {
  if (!splits?.runnerSituations || !pitcherThrows) return null;
  const risp = splits.runnerSituations.risp;
  if (pitcherThrows === "L") return risp.vsL;
  if (pitcherThrows === "R") return risp.vsR;
  return null;
}

function buildOpponentThreatRows(
  slots: PreGameOverviewPayload["opponentLineup"],
  playersById: PreGameOverviewPayload["playersById"],
  stats: PreGameOverviewPayload["lineupStatsByPlayerId"],
  ourStarterThrows: Throws | null | undefined
): ThreatRow[] {
  return slots
    .map((row) => {
      const p = playersById[row.player_id];
      const playerSplits = stats[row.player_id];
      const platoon = platoonSplitForPitcherHand(playerSplits, ourStarterThrows);
      const risp = rispSplitForPitcherHand(playerSplits, ourStarterThrows);
      const pa = platoon?.pa ?? 0;
      return {
        slot: row.slot,
        name: p?.name ?? "—",
        pa: pa >= 1 ? String(pa) : "—",
        ops: pa >= 1 ? fmtStat(platoon!.ops) : "—",
        kPct: pa >= 1 ? fmtPct(platoon!.kPct) : "—",
        bbPct: pa >= 1 ? fmtPct(platoon!.bbPct) : "—",
        hr: pa >= 1 && platoon!.hr != null ? String(platoon!.hr) : "—",
        rispOps:
          risp && (risp.pa ?? 0) >= 1 ? fmtStat(risp.ops) : "—",
        sb: pa >= 1 && platoon!.sb != null ? String(platoon!.sb) : "—",
        sortOps: pa >= 1 ? (platoon!.ops ?? -1) : -1,
      };
    })
    .sort((a, b) => {
      if (b.sortOps !== a.sortOps) return b.sortOps - a.sortOps;
      return a.slot - b.slot;
    });
}

function OpponentThreatsTable({ rows }: { rows: ThreatRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--neo-text-muted)]">—</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--neo-border)]">
      <table className="w-full min-w-[28rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--neo-border)] bg-[#10161d] text-[10px] font-semibold uppercase tracking-wider text-[var(--neo-text-muted)]">
            <th className="px-3 py-2 text-left">Player</th>
            <th className="px-2 py-2 text-right">PA</th>
            <th className="px-2 py-2 text-right">OPS</th>
            <th className="px-2 py-2 text-right">K%</th>
            <th className="px-2 py-2 text-right">BB%</th>
            <th className="px-2 py-2 text-right">HR</th>
            <th className="px-2 py-2 text-right">RISP</th>
            <th className="px-2 py-2 text-right">SB</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.slot} className="border-b border-[var(--neo-border)]/60 last:border-0">
              <td className="px-3 py-2 font-medium text-[var(--neo-text)]">{row.name}</td>
              <td className="px-2 py-2 text-right tabular-nums text-[var(--neo-text-muted)]">{row.pa}</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold text-[var(--accent-coach)]">
                {row.ops}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-[var(--neo-text)]">{row.kPct}</td>
              <td className="px-2 py-2 text-right tabular-nums text-[var(--neo-text)]">{row.bbPct}</td>
              <td className="px-2 py-2 text-right tabular-nums text-[var(--neo-text)]">{row.hr}</td>
              <td className="px-2 py-2 text-right tabular-nums text-[var(--neo-text-muted)]">{row.rispOps}</td>
              <td className="px-2 py-2 text-right tabular-nums text-[var(--neo-text-muted)]">{row.sb}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrendStatTable({
  entries,
  recentById,
  stats,
}: {
  entries: Array<{ playerId?: string; name: string }>;
  recentById: PreGameOverviewPayload["recentHitterLineByPlayerId"];
  stats: PreGameOverviewPayload["lineupStatsByPlayerId"];
}) {
  const rows = entries
    .map((entry, index) => {
      const id = entry.playerId;
      const recent = id ? recentById[id] : undefined;
      const season = id ? stats[id]?.overall : undefined;
      return {
        key: id ? `${id}-${index}` : `trend-${index}`,
        name: entry.name,
        recentOps: recent ? fmtStat(recent.ops) : "—",
        recentK: recent ? fmtPct(recent.kPct) : "—",
        seasonOps: season ? fmtStat(season.ops) : "—",
      };
    })
    .filter((r) => r.name.trim().length > 0);

  if (rows.length === 0) {
    return <p className="text-sm text-[var(--neo-text-muted)]">—</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--neo-border)]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--neo-border)] bg-[#10161d] text-[10px] font-semibold uppercase tracking-wider text-[var(--neo-text-muted)]">
            <th className="px-3 py-2 text-left">Player</th>
            <th className="px-2 py-2 text-right">Recent OPS</th>
            <th className="px-2 py-2 text-right">K%</th>
            <th className="px-2 py-2 text-right">Season OPS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-[var(--neo-border)]/60 last:border-0">
              <td className="px-3 py-2 font-medium text-[var(--neo-text)]">{row.name}</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold text-[var(--accent-coach)]">
                {row.recentOps}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-[var(--neo-text-muted)]">
                {row.recentK}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-[var(--neo-text)]">
                {row.seasonOps}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CoachMatchupView({
  game,
  overview,
}: {
  game: Game;
  overview: PreGameOverviewPayload;
}) {
  const rep = overview.report;
  const { playersById } = overview;
  const stats = overview.lineupStatsByPlayerId;

  const ourSpId =
    game.our_side === "home" ? game.starting_pitcher_home_id : game.starting_pitcher_away_id;
  const oppSpId =
    game.our_side === "home" ? game.starting_pitcher_away_id : game.starting_pitcher_home_id;
  const ourSp = ourSpId ? playersById[ourSpId] : undefined;
  const oppSp = oppSpId ? playersById[oppSpId] : undefined;

  const ourLineupIds = overview.ourLineup.map((r) => r.player_id);
  const opponentLineupIds = overview.opponentLineup.map((r) => r.player_id);
  const ourVsHandLabel = vsHandColumnLabel(oppSp?.throws);
  const theirVsHandLabel = vsHandColumnLabel(ourSp?.throws);
  const ourRows = buildLineupRows(overview.ourLineup, playersById, stats, oppSp?.throws);
  const opponentRows = buildLineupRows(overview.opponentLineup, playersById, stats, ourSp?.throws);
  const threatRows = buildOpponentThreatRows(
    overview.opponentLineup,
    playersById,
    stats,
    ourSp?.throws
  );
  const ourHand = pitcherHandLabel(ourSp?.throws);
  const oppHand = pitcherHandLabel(oppSp?.throws);

  const hittingTrends = rep.hittingTrends;
  const pitchMix = rep.pitchingPlan?.pitchMix ?? [];
  const opponentAgg = paWeightedLineupAggregate(opponentLineupIds, stats);
  const opponentPlatoon = platoonCounts(opponentLineupIds, playersById);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="neo-card p-4 lg:p-5">
        <p className="font-orbitron text-xl font-semibold tracking-tight text-[var(--neo-text)] sm:text-2xl">
          {matchupLabelUsFirst(game, true)}
        </p>
        <p className="mt-1 text-sm text-[var(--neo-text-muted)]">
          {formatDateMMDDYYYY(game.date)} · {ourVenueLabel(game)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Our starter">
          <p className="text-lg font-semibold leading-snug text-[var(--neo-text)]">
            {overview.ourStarterSummary?.name ?? ourSp?.name ?? "—"}
            <span className="ml-2 text-sm font-normal tabular-nums text-[var(--neo-text-muted)]">
              ERA {overview.ourStarterSummary?.seasonEra ?? "—"}
            </span>
          </p>
          {ourHand ? (
            <p className="mt-1 text-sm text-[var(--neo-text-muted)]">{ourHand}</p>
          ) : null}
        </Card>
        <Card title="Their starter">
          <p className="text-lg font-semibold leading-snug text-[var(--neo-text)]">
            {overview.opponentStarterSummary?.name ?? oppSp?.name ?? "—"}
            <span className="ml-2 text-sm font-normal tabular-nums text-[var(--neo-text-muted)]">
              ERA {overview.opponentStarterSummary?.seasonEra ?? "—"}
            </span>
          </p>
          {oppHand ? (
            <p className="mt-1 text-sm text-[var(--neo-text-muted)]">{oppHand}</p>
          ) : null}
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card title="Our lineup">
          <LineupTable rows={ourRows} vsHandLabel={ourVsHandLabel} />
        </Card>
        <Card title="Their lineup">
          <LineupTable rows={opponentRows} vsHandLabel={theirVsHandLabel} />
        </Card>
      </div>

      <Card title="Threats">
        <p className="mb-3 text-xs text-[var(--neo-text-muted)]">
          {theirVsHandLabel
            ? `${theirVsHandLabel} · sorted by OPS`
            : "Sorted by OPS · logged sample"}
        </p>
        <OpponentThreatsTable rows={threatRows} />
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card title="Our offense">
          {hittingTrends?.season || hittingTrends?.recent ? (
            <div className="space-y-4">
              {hittingTrends.season ? (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--neo-text-muted)]">
                    Season
                  </p>
                  <StatGrid items={hittingSnapshotItems(hittingTrends.season)} />
                </div>
              ) : null}
              {hittingTrends.recent ? (
                <div className={hittingTrends.season ? "border-t border-[var(--neo-border)] pt-4" : ""}>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--neo-text-muted)]">
                    Last {overview.recentGamesCount} games
                  </p>
                  <StatGrid items={hittingSnapshotItems(hittingTrends.recent)} />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--neo-text-muted)]">—</p>
          )}
        </Card>

        <Card title="Opponent">
          {opponentAgg.length > 0 ? (
            <>
              <StatGrid items={opponentAgg} />
              <p className="mt-3 text-sm tabular-nums text-[var(--neo-text-muted)]">
                {opponentPlatoon.l}L · {opponentPlatoon.r}R · {opponentPlatoon.s}S
              </p>
            </>
          ) : (
            <p className="text-sm text-[var(--neo-text-muted)]">—</p>
          )}
        </Card>
      </div>

      {pitchMix.length > 0 ? (
        <Card title="Starter mix">
          <PitchMixTable rows={pitchMix} />
        </Card>
      ) : null}

      {(rep.playerInsights.hot.length > 0 || rep.playerInsights.cold.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Hot">
            <TrendStatTable
              entries={rep.playerInsights.hot}
              recentById={overview.recentHitterLineByPlayerId}
              stats={stats}
            />
          </Card>
          <Card title="Cold">
            <TrendStatTable
              entries={rep.playerInsights.cold}
              recentById={overview.recentHitterLineByPlayerId}
              stats={stats}
            />
          </Card>
        </div>
      )}

      {overview.priorMeetings.length > 0 ? (
        <Card title="Last meetings">
          <ul className="divide-y divide-[var(--neo-border)] rounded-lg border border-[var(--neo-border)]">
            {overview.priorMeetings.map((m) => (
              <li
                key={m.gameId}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span className="text-[var(--neo-text-muted)]">{formatDateMMDDYYYY(m.date)}</span>
                <span className="font-medium tabular-nums text-[var(--neo-text)]">
                  {m.outcome ?? "—"}
                  {m.ourRuns != null && m.oppRuns != null
                    ? ` · ${m.ourRuns}–${m.oppRuns}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
