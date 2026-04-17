"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { analystPlayerProfileHref } from "@/lib/analystRoutes";
import { CurrentBatterPitchDataCard } from "@/components/analyst/BattingPitchMixCard";
import {
  battingStatsFromPAs,
  isRisp,
  pitchMixFromPlateAppearancesOrPitchLog,
} from "@/lib/compute/battingStats";
import { isPitcherPlayer } from "@/lib/opponentUtils";
import { formatBattingTripleSlash } from "@/lib/format/battingSlash";
import type { Game, PitchEvent, PlateAppearance, Player } from "@/lib/types";

/** Scrollable list of `CurrentBatterPitchDataCard` in batting-table order (game review, etc.). */
export function GameBatterPitchDetailStack({
  pas,
  players,
  lineupOrder,
  lineupPositionByPlayerId,
  baserunningByPlayerId,
  pitchEvents = [],
  compact = false,
}: {
  pas: PlateAppearance[];
  players: Player[];
  lineupOrder?: string[] | null;
  lineupPositionByPlayerId?: Record<string, string | null>;
  baserunningByPlayerId?: Record<string, { sb: number; cs: number }>;
  pitchEvents?: PitchEvent[];
  compact?: boolean;
}) {
  const rows = computeGameBatting(
    pas,
    players ?? [],
    lineupOrder,
    lineupPositionByPlayerId,
    baserunningByPlayerId
  );
  if (rows.length === 0) return null;

  return (
    <div
      className={`game-batter-pitch-detail-stack space-y-2 ${compact ? "text-xs" : ""}`.trim()}
    >
      {rows.map((row, index) => {
        const orderNum = index + 1;
        const nameWithOrder = row.position
          ? `${orderNum}. ${row.name} ${row.position}`
          : `${orderNum}. ${row.name}`;
        const batterPas = pas.filter((p) => p.batter_id === row.playerId);
        const batterPaIds = new Set(batterPas.map((p) => p.id));
        const batterPitchEvents = pitchEvents.filter((e) => batterPaIds.has(e.pa_id));
        return (
          <CurrentBatterPitchDataCard
            key={row.playerId}
            batterName={nameWithOrder}
            pas={batterPas}
            pitchEvents={batterPitchEvents}
            compact={compact}
          />
        );
      })}
    </div>
  );
}

export interface GameBattingRow {
  playerId: string;
  name: string;
  position: string;
  ab: number;
  r: number;
  h: number;
  rbi: number;
  bb: number;
  hbp: number;
  k: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  double: number;
  triple: number;
  hr: number;
  tb: number;
  sb: number;
  cs: number;
  lob: number;
}

const RESULT_ADDS_ONE_OUT = new Set<PlateAppearance["result"]>([
  "out",
  "so",
  "so_looking",
  "sac_fly",
  "sac_bunt",
  "sac",
  "fielders_choice",
]);

function countBaseRunners(baseState: string | null | undefined): number {
  const bits = String(baseState ?? "")
    .replace(/[^01]/g, "0")
    .padStart(3, "0")
    .slice(0, 3);
  return (bits.match(/1/g) || []).length;
}

/** Credit LOB to batter who makes inning-ending out (box-score style). */
function lobByBatterFromPas(pas: PlateAppearance[]): Map<string, number> {
  const out = new Map<string, number>();
  const sorted = [...pas].sort(
    (a, b) =>
      a.inning - b.inning ||
      (a.inning_half ?? "").localeCompare(b.inning_half ?? "") ||
      new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
  );
  for (const pa of sorted) {
    const outsBefore = typeof pa.outs === "number" ? pa.outs : 0;
    const outsAdded =
      pa.result === "gidp" ? 2 : RESULT_ADDS_ONE_OUT.has(pa.result) ? 1 : 0;
    if (outsAdded <= 0 || outsBefore + outsAdded < 3) continue;
    let stranded = countBaseRunners(pa.base_state);
    if (pa.result === "gidp") {
      const onFirst = String(pa.base_state ?? "").padStart(3, "0").slice(0, 3)[0] === "1";
      if (onFirst) stranded = Math.max(0, stranded - 1);
    }
    if (stranded <= 0) continue;
    out.set(pa.batter_id, (out.get(pa.batter_id) ?? 0) + stranded);
  }
  return out;
}

function formatAvgOps(value: number): string {
  if (value === 0) return ".000";
  const s = value.toFixed(3);
  return s.startsWith("0.") ? s.slice(1) : s;
}

function computeGameBatting(
  pas: PlateAppearance[],
  players: Player[],
  lineupOrder?: string[] | null,
  lineupPositionByPlayerId?: Record<string, string | null>,
  baserunningByPlayerId?: Record<string, { sb: number; cs: number }>
): GameBattingRow[] {
  const list = players ?? [];
  const playerMap = new Map(list.map((p) => [p.id, p]));
  const lobByBatter = lobByBatterFromPas(pas);
  const batterIdsInGame = new Set(pas.map((pa) => pa.batter_id).filter(Boolean));

  const order: string[] = [];
  if (lineupOrder?.length) {
    for (const playerId of lineupOrder) {
      order.push(playerId);
    }
    for (const id of batterIdsInGame) {
      if (!order.includes(id)) order.push(id);
    }
  } else {
    const seen = new Set<string>();
    for (const pa of pas) {
      if (!seen.has(pa.batter_id)) {
        seen.add(pa.batter_id);
        order.push(pa.batter_id);
      }
    }
  }

  const rows: GameBattingRow[] = [];
  for (const batterId of order) {
    const player = playerMap.get(batterId);
    if (player && isPitcherPlayer(player)) continue;
    const playerPAs = pas.filter((p) => p.batter_id === batterId);
    const stats = battingStatsFromPAs(playerPAs);

    // Runs scored are credited on any teammate's PA, not only this batter's own PAs.
    const r = pas.reduce(
      (sum, pa) => sum + (pa.runs_scored_player_ids?.includes(batterId) ? 1 : 0),
      0
    );
    const d = stats?.double ?? 0;
    const t = stats?.triple ?? 0;
    const hrCount = stats?.hr ?? 0;
    const singles = (stats?.h ?? 0) - d - t - hrCount;
    const tb = singles + 2 * d + 3 * t + 4 * hrCount;

    const gamePosition = lineupPositionByPlayerId?.[batterId];
    const br = baserunningByPlayerId?.[batterId];
    const evSb = br?.sb ?? 0;
    const evCs = br?.cs ?? 0;
    const paSb = stats?.sb ?? 0;
    const displayName = player?.name ?? "Unknown player";
    const displayPosition =
      gamePosition != null && gamePosition !== ""
        ? gamePosition
        : player?.positions?.[0] ?? "";
    rows.push({
      playerId: batterId,
      name: displayName,
      position: displayPosition,
      ab: stats?.ab ?? 0,
      r,
      h: stats?.h ?? 0,
      rbi: stats?.rbi ?? 0,
      bb: (stats?.bb ?? 0) + (stats?.ibb ?? 0),
      hbp: stats?.hbp ?? 0,
      k: stats?.so ?? 0,
      avg: stats?.avg ?? 0,
      obp: stats?.obp ?? 0,
      slg: stats?.slg ?? 0,
      ops: stats?.ops ?? 0,
      double: d,
      triple: t,
      hr: hrCount,
      tb,
      sb: paSb + evSb,
      cs: evCs,
      lob: lobByBatter.get(batterId) ?? 0,
    });
  }
  return rows;
}

interface GameBattingTableProps {
  game: Game;
  /** Plate appearances for the team whose stats are shown (caller filters by inning half). */
  pas: PlateAppearance[];
  players?: Player[] | null;
  /** Game lineup: player IDs in slot order (1–9). When set, table follows this order for easier reading. */
  lineupOrder?: string[] | null;
  /** Position for each player in this game (e.g. "LF", "3B"). Overrides player's default position when set. */
  lineupPositionByPlayerId?: Record<string, string | null>;
  /** Player ID to highlight in the table (e.g. current batter in Record PAs). */
  highlightedBatterId?: string | null;
  /** Tighter layout for side panel (smaller text, padding, min-width). */
  compact?: boolean;
  /** SB/CS from baserunning_events for this game (runner-centric). */
  baserunningByPlayerId?: Record<string, { sb: number; cs: number }>;
  /** Heading team name (defaults to our club from `game.our_side`). */
  teamName?: string;
  /** When true, omit the "Batters – …" heading (e.g. parent renders a shared header row). */
  hideHeading?: boolean;
  /** When false, hide the Pitch data card (e.g. show it under the pitching table on Record PAs). */
  showPitchData?: boolean;
  /** Link player names to Analyst roster profile (canonical player URL). */
  linkPlayersToProfile?: boolean;
}

export function GameBattingTable({
  game,
  pas,
  players,
  lineupOrder,
  lineupPositionByPlayerId,
  highlightedBatterId,
  compact = false,
  baserunningByPlayerId,
  teamName: teamNameProp,
  hideHeading = false,
  showPitchData = true,
  linkPlayersToProfile = true,
}: GameBattingTableProps) {
  /** Expanded by default in compact contexts (e.g. PDF) so highlight lines print without a click. */
  const [battingNotesOpen, setBattingNotesOpen] = useState(() => compact);
  const rows = computeGameBatting(
    pas,
    players ?? [],
    lineupOrder,
    lineupPositionByPlayerId,
    baserunningByPlayerId
  );
  const rowsWithPending = rows;
  const headingTeamName =
    teamNameProp ??
    (game.our_side === "home" ? game.home_team : game.away_team);

  const totals = rowsWithPending.reduce(
    (acc, r) => ({
      ab: acc.ab + r.ab,
      r: acc.r + r.r,
      h: acc.h + r.h,
      rbi: acc.rbi + r.rbi,
      bb: acc.bb + r.bb,
      hbp: acc.hbp + r.hbp,
      k: acc.k + r.k,
    }),
    { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, hbp: 0, k: 0 }
  );
  const teamAvgFormatted =
    totals.ab > 0 ? formatAvgOps(totals.h / totals.ab) : "—";

  const battingNotes = useMemo(
    () =>
      rowsWithPending.filter(
        (r) =>
          r.double > 0 ||
          r.triple > 0 ||
          r.hr > 0 ||
          r.hbp > 0 ||
          r.rbi > 0 ||
          r.sb > 0 ||
          r.cs > 0
      ),
    [rowsWithPending]
  );
  const hasBattingExtras = battingNotes.length > 0;
  const teamRisp = useMemo(() => {
    const rispPas = pas.filter((pa) => isRisp(pa.base_state));
    if (rispPas.length === 0) return null;
    return battingStatsFromPAs(rispPas);
  }, [pas]);
  const teamSlashFormatted = useMemo(() => {
    const s = battingStatsFromPAs(pas);
    if (!s || ((s.pa ?? 0) < 1 && (s.ab ?? 0) < 1)) return "—";
    return formatBattingTripleSlash(s.avg, s.obp, s.slg);
  }, [pas]);
  const showBattingNotesCard = battingNotes.length > 0 || pas.length > 0;
  const pitchMix = useMemo(() => {
    if (!showPitchData) return null;
    return pitchMixFromPlateAppearancesOrPitchLog(pas, new Map());
  }, [pas, showPitchData]);

  if (rowsWithPending.length === 0) {
    return (
      <section>
        {!hideHeading ? (
          <h2 className="font-display mb-2 text-sm font-semibold uppercase tracking-wider text-white">
            Batters – {headingTeamName}
          </h2>
        ) : null}
        <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-4 text-sm text-[var(--text-muted)]">
          No lineup saved for this team in this game yet. Add it in Coach → Lineup or when creating the game.
        </p>
      </section>
    );
  }

  return (
    <section className={compact ? "space-y-1" : "space-y-4"}>
      {!hideHeading ? (
        <h2 className={compact ? "font-display text-xs font-semibold uppercase tracking-wider text-white" : "font-display text-sm font-semibold uppercase tracking-wider text-white"}>
          Batters – {headingTeamName}
        </h2>
      ) : null}
      <div className="game-batting-table-scroll overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
        <table className={`w-full border-collapse text-left ${compact ? "min-w-0 text-xs" : "min-w-[560px] text-sm"}`}>
          <thead className="sticky top-0 z-10 shadow-[0_1px_0_0_var(--border)]">
            <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
              <th className={compact ? "font-display px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white" : "font-display px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white"}>
                Player
              </th>
              <th className={compact ? "font-display w-6 px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-white" : "font-display w-10 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-white"}>
                AB
              </th>
              <th className={compact ? "font-display w-6 px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-white" : "font-display w-10 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-white"}>R</th>
              <th className={compact ? "font-display w-6 px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-white" : "font-display w-10 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-white"}>H</th>
              <th className={compact ? "font-display w-6 px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-white" : "font-display w-10 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-white"}>RBI</th>
              <th className={compact ? "font-display w-6 px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-white" : "font-display w-10 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-white"}>BB</th>
              <th className={compact ? "font-display w-6 px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-white" : "font-display w-10 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-white"}>K</th>
              <th className={compact ? "font-display w-6 px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-white" : "font-display w-10 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-white"}>LOB</th>
              <th
                className={
                  compact
                    ? "font-display min-w-[5.5rem] px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-white"
                    : "font-display min-w-[6.5rem] px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-white"
                }
                title="AVG / OBP / SLG"
              >
                AVG/OBP/SLG
              </th>
            </tr>
          </thead>
          <tbody>
            {rowsWithPending.map((row, index) => {
              const orderNum = index + 1;
              const nameWithOrder = row.position ? `${orderNum}. ${row.name} ${row.position}` : `${orderNum}. ${row.name}`;
              return (
                <tr
                  key={row.playerId}
                  className={`break-inside-avoid border-b border-[var(--border)] ${
                    highlightedBatterId && row.playerId === highlightedBatterId
                      ? "bg-[var(--accent)]/15"
                      : ""
                  }`}
                >
                  <td className={compact ? "px-1.5 py-1 font-medium text-[var(--text)]" : "px-3 py-2 font-medium text-[var(--text)]"}>
                    {linkPlayersToProfile ? (
                      <Link
                        href={analystPlayerProfileHref(row.playerId)}
                        className="text-[var(--accent)] hover:underline"
                      >
                        {nameWithOrder}
                      </Link>
                    ) : (
                      nameWithOrder
                    )}
                  </td>
                  <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{row.ab}</td>
                  <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{row.r}</td>
                  <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{row.h}</td>
                  <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{row.rbi}</td>
                  <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{row.bb}</td>
                  <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{row.k}</td>
                  <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{row.lob}</td>
                  <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>
                    {formatBattingTripleSlash(row.avg, row.obp, row.slg)}
                  </td>
                </tr>
              );
            })}
            <tr className="break-inside-avoid border-t-2 border-[var(--border)] bg-[var(--bg-elevated)] font-medium">
              <td className={compact ? "px-1.5 py-1 text-[var(--text)]" : "px-3 py-2 text-[var(--text)]"}>Totals</td>
              <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{rowsWithPending.reduce((s, r) => s + r.ab, 0)}</td>
              <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{totals.r}</td>
              <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{totals.h}</td>
              <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{totals.rbi}</td>
              <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{totals.bb}</td>
              <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{totals.k}</td>
              <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{rowsWithPending.reduce((s, r) => s + r.lob, 0)}</td>
              <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>
                {teamSlashFormatted}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {showBattingNotesCard && (
        <div className="game-batting-notes-card break-inside-avoid rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-3">
          {hasBattingExtras ? (
            <button
              type="button"
              onClick={() => setBattingNotesOpen((o) => !o)}
              className="flex w-full items-start gap-2 rounded-md text-left transition hover:bg-[var(--bg-elevated)]/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35 -m-1 p-1"
              aria-label={
                battingNotesOpen ? "Hide extra batting note lines" : "Show extra batting note lines"
              }
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-white">
                  Team batting notes
                </h3>
                <p className="mt-1 text-sm leading-snug text-[var(--text)] tabular-nums sm:text-base">
                  <span title="Team batting with runners on 2nd and/or 3rd before the PA">RISP</span>{" "}
                  {teamRisp != null ? (
                    <>
                      {teamRisp.h}/{teamRisp.ab} ({formatAvgOps(teamRisp.avg)})
                    </>
                  ) : (
                    "—"
                  )}
                  <span className="text-[var(--text-faint)]"> · </span>
                  <span>LOB {rowsWithPending.reduce((s, r) => s + r.lob, 0)}</span>
                  <span className="text-[var(--text-faint)]"> · </span>
                  <span title="Team batting average (H/AB)">AVG {teamAvgFormatted}</span>
                  <span className="text-[var(--text-faint)]"> · </span>
                  <span title="Team walks">BB {totals.bb}</span>
                  <span className="text-[var(--text-faint)]"> · </span>
                  <span title="Team strikeouts">SO {totals.k}</span>
                </p>
              </div>
              <svg
                className={`mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)] transition-transform ${battingNotesOpen ? "rotate-180" : ""}`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          ) : (
            <div>
              <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-white">
                Team batting notes
              </h3>
              <p className="mt-1 text-sm leading-snug text-[var(--text)] tabular-nums sm:text-base">
                <span title="Team batting with runners on 2nd and/or 3rd before the PA">RISP</span>{" "}
                {teamRisp != null ? (
                  <>
                    {teamRisp.h}/{teamRisp.ab} ({formatAvgOps(teamRisp.avg)})
                  </>
                ) : (
                  "—"
                )}
                <span className="text-[var(--text-faint)]"> · </span>
                <span>LOB {rowsWithPending.reduce((s, r) => s + r.lob, 0)}</span>
                <span className="text-[var(--text-faint)]"> · </span>
                <span title="Team batting average (H/AB)">AVG {teamAvgFormatted}</span>
                <span className="text-[var(--text-faint)]"> · </span>
                <span title="Team walks">BB {totals.bb}</span>
                <span className="text-[var(--text-faint)]"> · </span>
                <span title="Team strikeouts">SO {totals.k}</span>
              </p>
            </div>
          )}
          {hasBattingExtras && battingNotesOpen ? (
            <dl className="mt-3 space-y-1.5 border-t border-[var(--border)] pt-3 text-sm text-[var(--text)]">
              {battingNotes.some((r) => r.double > 0) && (
                <div>
                  <dt className="inline font-semibold text-[var(--text-muted)]">2B: </dt>
                  <dd className="inline">
                    {battingNotes
                      .filter((r) => r.double > 0)
                      .map((r) => `${r.name} ${r.double}`)
                      .join("; ")}
                  </dd>
                </div>
              )}
              {battingNotes.some((r) => r.triple > 0) && (
                <div>
                  <dt className="inline font-semibold text-[var(--text-muted)]">3B: </dt>
                  <dd className="inline">
                    {battingNotes
                      .filter((r) => r.triple > 0)
                      .map((r) => `${r.name} ${r.triple}`)
                      .join("; ")}
                  </dd>
                </div>
              )}
              {battingNotes.some((r) => r.hr > 0) && (
                <div>
                  <dt className="inline font-semibold text-[var(--text-muted)]">HR: </dt>
                  <dd className="inline">
                    {battingNotes
                      .filter((r) => r.hr > 0)
                      .map((r) => `${r.name} ${r.hr}`)
                      .join("; ")}
                  </dd>
                </div>
              )}
              {battingNotes.some((r) => r.hbp > 0) && (
                <div>
                  <dt className="inline font-semibold text-[var(--text-muted)]">HBP: </dt>
                  <dd className="inline">
                    {battingNotes
                      .filter((r) => r.hbp > 0)
                      .map((r) => `${r.name} ${r.hbp}`)
                      .join("; ")}
                  </dd>
                </div>
              )}
              {battingNotes.some((r) => r.rbi > 0) && (
                <div>
                  <dt className="inline font-semibold text-[var(--text-muted)]">RBI: </dt>
                  <dd className="inline">
                    {battingNotes
                      .filter((r) => r.rbi > 0)
                      .map((r) => `${r.name} ${r.rbi}`)
                      .join("; ")}
                  </dd>
                </div>
              )}
              {battingNotes.some((r) => r.sb > 0) && (
                <div>
                  <dt className="inline font-semibold text-[var(--text-muted)]">SB: </dt>
                  <dd className="inline">
                    {battingNotes
                      .filter((r) => r.sb > 0)
                      .map((r) => `${r.name} ${r.sb}`)
                      .join("; ")}
                  </dd>
                </div>
              )}
              {battingNotes.some((r) => r.cs > 0) && (
                <div>
                  <dt className="inline font-semibold text-[var(--text-muted)]">CS: </dt>
                  <dd className="inline">
                    {battingNotes
                      .filter((r) => r.cs > 0)
                      .map((r) => `${r.name} ${r.cs}`)
                      .join("; ")}
                  </dd>
                </div>
              )}
            </dl>
          ) : null}
        </div>
      )}

      {showPitchData && pitchMix != null ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-3">
          <h3 className="font-display mb-2 text-xs font-semibold uppercase tracking-wider text-white">
            Pitch data
          </h3>
          <dl className="space-y-1.5 text-sm text-[var(--text)]">
            <div>
              <dt className="inline font-semibold text-[var(--text-muted)]">First pitch strikes: </dt>
              <dd className="inline tabular-nums">
                {pitchMix.firstPitchOpportunities > 0
                  ? `${pitchMix.firstPitchStrikes} / ${pitchMix.firstPitchOpportunities}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold text-[var(--text-muted)]">Strike %: </dt>
              <dd className="inline tabular-nums">
                {pitchMix.strikePct != null ? `${(pitchMix.strikePct * 100).toFixed(1)}%` : "—"}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
