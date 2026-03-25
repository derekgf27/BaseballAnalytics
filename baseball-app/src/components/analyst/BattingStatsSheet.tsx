"use client";

import { useState, useMemo, useEffect, Fragment, type ReactNode } from "react";
import Link from "next/link";
import { formatPPa } from "@/lib/format";
import { comparePlayersByLastNameThenFull } from "@/lib/playerSort";
import { BATTING_STAT_HEADER_TOOLTIPS } from "@/lib/statHeaderTooltips";
import type { BattingStats, BattingStatsWithSplits, Player } from "@/lib/types";

export type SplitView = "overall" | "vsL" | "vsR" | "risp";

const BATS_LABEL: Record<string, string> = { L: "L", R: "R", S: "S" };

type SortKey =
  | "name"
  | "gp"
  | "gs"
  | "pa"
  | "ab"
  | "h"
  | "double"
  | "triple"
  | "hr"
  | "rbi"
  | "r"
  | "sb"
  | "cs"
  | "sbPct"
  | "bb"
  | "ibb"
  | "hbp"
  | "so"
  | "gidp"
  | "fieldersChoice"
  | "kPct"
  | "bbPct"
  | "avg"
  | "obp"
  | "slg"
  | "ops"
  | "opsPlus"
  | "woba"
  | "pPa";

const COLUMNS: {
  key: SortKey;
  label: string;
  align: "left" | "right" | "center";
  format: "name" | "int" | "avg" | "pct";
  tooltip: string;
}[] = [
  { key: "name", label: "Player", align: "left", format: "name", tooltip: BATTING_STAT_HEADER_TOOLTIPS.player },
  /* Usage — games before PA/AB */
  { key: "gp", label: "G", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.gp },
  { key: "gs", label: "GS", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.gs },
  /* Results — PA/AB + counting */
  { key: "pa", label: "PA", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.pa },
  { key: "ab", label: "AB", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.ab },
  { key: "h", label: "H", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.h },
  { key: "double", label: "2B", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.double },
  { key: "triple", label: "3B", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.triple },
  { key: "hr", label: "HR", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.hr },
  { key: "rbi", label: "RBI", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.rbi },
  { key: "r", label: "R", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.r },
  /* Plate discipline — vertical rule before P/PA */
  { key: "pPa", label: "P/PA", align: "right", format: "avg", tooltip: BATTING_STAT_HEADER_TOOLTIPS.pPa },
  { key: "kPct", label: "K%", align: "right", format: "pct", tooltip: BATTING_STAT_HEADER_TOOLTIPS.kPct },
  { key: "bbPct", label: "BB%", align: "right", format: "pct", tooltip: BATTING_STAT_HEADER_TOOLTIPS.bbPct },
  { key: "bb", label: "BB", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.bb },
  { key: "ibb", label: "IBB", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.ibb },
  { key: "hbp", label: "HBP", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.hbp },
  { key: "so", label: "SO", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.so },
  { key: "gidp", label: "GIDP", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.gidp },
  { key: "fieldersChoice", label: "FC", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.fieldersChoice },
  /* Offensive production — vertical rule before AVG */
  { key: "avg", label: "AVG", align: "right", format: "avg", tooltip: BATTING_STAT_HEADER_TOOLTIPS.avg },
  { key: "obp", label: "OBP", align: "right", format: "avg", tooltip: BATTING_STAT_HEADER_TOOLTIPS.obp },
  { key: "slg", label: "SLG", align: "right", format: "avg", tooltip: BATTING_STAT_HEADER_TOOLTIPS.slg },
  { key: "ops", label: "OPS", align: "right", format: "avg", tooltip: BATTING_STAT_HEADER_TOOLTIPS.ops },
  { key: "opsPlus", label: "OPS+", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.opsPlus },
  { key: "woba", label: "wOBA", align: "right", format: "avg", tooltip: BATTING_STAT_HEADER_TOOLTIPS.woba },
  /* Baserunning — vertical rule before SB */
  { key: "sb", label: "SB", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.sb },
  { key: "cs", label: "CS", align: "right", format: "int", tooltip: BATTING_STAT_HEADER_TOOLTIPS.cs },
  { key: "sbPct", label: "SB%", align: "right", format: "pct", tooltip: BATTING_STAT_HEADER_TOOLTIPS.sbPct },
];

/** Vertical rule before P/PA, AVG, SB blocks (scrollable columns). */
const STAT_GROUP_BORDER_LEFT: Partial<Record<SortKey, true>> = { pPa: true, avg: true, sb: true };

/** Fixed widths so horizontal sticky `left` offsets stay aligned (# + Player only). */
const STICKY_LEAD = {
  /** High z-index + compositor layer — required so scrollable cells don’t paint over sticky cells. */
  rank: "sticky left-0 z-[100] isolate [transform:translateZ(0)] w-12 min-w-[3rem] shrink-0",
  player:
    "sticky left-12 z-[100] isolate [transform:translateZ(0)] w-[12rem] min-w-[12rem] max-w-[12rem] shrink-0 shadow-[2px_0_0_0_var(--border)]",
} as const;

/**
 * Opaque backgrounds for sticky cells only. `var(--accent-dim)` is translucent — without a solid base,
 * stat columns visually bleed through when they overlap during horizontal scroll.
 */
function stickyLeadRowBg(selected: boolean, index: number): string {
  const isEven = index % 2 === 0;
  const hoverMix = isEven
    ? "group-hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--bg-base))]"
    : "group-hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--bg-elevated))]";
  if (selected) {
    const selMix = isEven
      ? "bg-[color-mix(in_srgb,var(--accent)_18%,var(--bg-base))]"
      : "bg-[color-mix(in_srgb,var(--accent)_18%,var(--bg-elevated))]";
    return `${selMix} ${hoverMix}`;
  }
  const baseSolid = isEven ? "bg-[var(--bg-base)]" : "bg-[var(--bg-elevated)]";
  return `${baseSolid} ${hoverMix}`;
}

/** Below sticky columns — `!z-0` keeps scrollable tds under sticky z-[100] in all engines. */
const SCROLL_CELL_Z = "relative !z-0";

function formatStat(value: number | undefined, format: "int" | "avg" | "pct"): string {
  if (value === undefined) return "—";
  if (format === "int") return String(value);
  if (format === "pct") return `${(value * 100).toFixed(1)}%`;
  const s = value.toFixed(3);
  return s.startsWith("0.") ? s.slice(1) : s;
}

/** Numeric value for leader comparison — matches displayed split/overall sources. */
function getNumericStatForLeader(
  player: Player,
  stats: BattingStats | undefined,
  splits: Record<string, BattingStatsWithSplits>,
  key: SortKey
): number | undefined {
  if (key === "name") return undefined;
  if (key === "cs" || key === "sbPct") {
    const o = splits[player.id]?.overall;
    if (!o) return undefined;
    if (key === "sbPct") {
      const v = o.sbPct;
      return typeof v === "number" && !Number.isNaN(v) ? v : undefined;
    }
    const v = o.cs;
    return typeof v === "number" ? v : undefined;
  }
  if (!stats) return undefined;
  const v = stats[key as keyof BattingStats];
  return typeof v === "number" ? v : undefined;
}

function isLeaderMatch(val: number | undefined, max: number | undefined): boolean {
  if (val === undefined || max === undefined) return false;
  if (Number.isNaN(val) || Number.isNaN(max)) return false;
  return Math.abs(val - max) <= 1e-9;
}

function LeaderStat({ children, show }: { children: ReactNode; show: boolean }) {
  return show ? <span className="font-bold italic">{children}</span> : <>{children}</>;
}

function getStatValue(
  player: Player,
  stats: BattingStats | undefined,
  key: SortKey,
  splits?: Record<string, BattingStatsWithSplits>
): string | number | undefined {
  if (key === "name") return player.name;
  if (key === "cs" || key === "sbPct") {
    const o = splits?.[player.id]?.overall;
    if (!o) return key === "cs" ? 0 : undefined;
    const v = o[key];
    return typeof v === "number" ? v : undefined;
  }
  if (!stats) {
    if (
      key === "gp" ||
      key === "gs" ||
      key === "pa" ||
      key === "ab" ||
      key === "h" ||
      key === "double" ||
      key === "triple" ||
      key === "hr" ||
      key === "rbi" ||
      key === "r" ||
      key === "sb" ||
      key === "bb" ||
      key === "ibb" ||
      key === "hbp" ||
      key === "so" ||
      key === "gidp" ||
      key === "fieldersChoice" ||
      key === "kPct" ||
      key === "bbPct" ||
      key === "pPa"
    )
      return 0;
    return undefined;
  }
  const v = stats[key as keyof BattingStats];
  return typeof v === "number" ? v : undefined;
}

/** Opponent / pitcher filters for the stats toolbar (parent owns selection state + derived stats). */
export interface BattingMatchupToolbarConfig {
  opponents: { key: string; label: string }[];
  pitchersByOpponent: Record<string, { id: string; name: string }[]>;
  opponentKey: string;
  pitcherId: string;
  onOpponentChange: (opponentKey: string) => void;
  onPitcherChange: (pitcherId: string) => void;
}

export interface BattingStatsSheetProps {
  /** Roster rows; defaults to [] if omitted (avoids runtime errors from stale props). */
  players?: Player[];
  battingStatsWithSplits: Record<string, BattingStatsWithSplits>;
  /** Section heading (e.g. "Batting stats — Mayaguez"). Omit when the parent page already has a title. */
  heading?: string;
  /** One line under the heading (split/search behavior is unchanged). */
  subheading?: string;
  /** When set (e.g. opponent detail page), show tagged vs club badges next to player names. */
  opponentTagContext?: string;
  /** Rendered at the end of the Split/Search toolbar row (e.g. Batters / Pitchers toggle). */
  toolbarEnd?: ReactNode;
  /** Opponent + pitcher dropdowns (same row as Split / Search). */
  matchupToolbar?: BattingMatchupToolbarConfig;
  /** When true (e.g. specific pitcher selected), Split resets to Overall and the control is disabled. */
  splitDisabled?: boolean;
}

function getStatsForSplit(splits: Record<string, BattingStatsWithSplits>, playerId: string, split: SplitView): BattingStats | undefined {
  const s = splits[playerId];
  if (!s) return undefined;
  if (split === "overall") return s.overall;
  if (split === "vsL") return s.vsL ?? undefined;
  if (split === "vsR") return s.vsR ?? undefined;
  return s.risp ?? undefined;
}

export function BattingStatsSheet({
  players = [],
  battingStatsWithSplits,
  heading,
  subheading,
  toolbarEnd,
  matchupToolbar,
  splitDisabled = false,
}: BattingStatsSheetProps) {
  const [search, setSearch] = useState("");
  const [splitView, setSplitView] = useState<SplitView>("overall");

  useEffect(() => {
    if (splitDisabled && splitView !== "overall") setSplitView("overall");
  }, [splitDisabled, splitView]);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const initialBattingStats = useMemo(() => {
    const out: Record<string, BattingStats> = {};
    for (const p of players) {
      const s = getStatsForSplit(battingStatsWithSplits, p.id, splitView);
      if (s) out[p.id] = s;
    }
    return out;
  }, [players, battingStatsWithSplits, splitView]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => p.name.toLowerCase().includes(q));
  }, [players, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") {
        const cmp = comparePlayersByLastNameThenFull(a, b);
        return sortDir === "asc" ? cmp : -cmp;
      }
      const sa = getStatValue(a, initialBattingStats[a.id], sortKey, battingStatsWithSplits);
      const sb = getStatValue(b, initialBattingStats[b.id], sortKey, battingStatsWithSplits);
      const aNum = typeof sa === "number" ? sa : sa === undefined ? -1 : String(sa).toLowerCase();
      const bNum = typeof sb === "number" ? sb : sb === undefined ? -1 : String(sb).toLowerCase();
      const na = Number(aNum);
      const nb = Number(bNum);
      const cmp = na - nb;
      if (Number.isNaN(cmp)) return comparePlayersByLastNameThenFull(a, b);
      const diff = sortDir === "asc" ? cmp : -cmp;
      if (diff !== 0) return diff;
      return comparePlayersByLastNameThenFull(a, b);
    });
  }, [filtered, initialBattingStats, battingStatsWithSplits, sortKey, sortDir]);

  /** Per-column max among visible rows (filtered) — ties all get bold+italic. */
  const teamColumnMax = useMemo(() => {
    const keys = COLUMNS.filter((c) => c.key !== "name").map((c) => c.key);
    const max: Partial<Record<SortKey, number>> = {};
    for (const key of keys) {
      let best: number | undefined;
      for (const p of filtered) {
        const s = initialBattingStats[p.id];
        const n = getNumericStatForLeader(p, s, battingStatsWithSplits, key);
        if (n === undefined || Number.isNaN(n)) continue;
        if (best === undefined || n > best) best = n;
      }
      if (best !== undefined) max[key] = best;
    }
    return max;
  }, [filtered, initialBattingStats, battingStatsWithSplits]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  return (
    <div className="space-y-4">
      {(heading || subheading) && (
        <div>
          {heading && (
            <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--text)]">{heading}</h2>
          )}
          {subheading && <p className="mt-1 text-sm text-[var(--text-muted)]">{subheading}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <label className="flex min-w-0 items-center gap-2 text-sm text-white">
            <span className="shrink-0">Split</span>
            <select
              value={splitView}
              onChange={(e) => setSplitView(e.target.value as SplitView)}
              disabled={splitDisabled}
              title={
                splitDisabled
                  ? "Split is off while a specific pitcher is selected (matchup line is already vs that arm)."
                  : undefined
              }
              className="max-w-[11rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Batting split view"
            >
              <option value="overall">Overall</option>
              <option value="vsL">vs LHP</option>
              <option value="vsR">vs RHP</option>
              <option value="risp">RISP</option>
            </select>
          </label>
          {matchupToolbar ? (
            <>
              <label className="flex min-w-0 max-w-full items-center gap-2 text-sm text-white">
                <span className="shrink-0">Opponent</span>
                <select
                  value={matchupToolbar.opponentKey}
                  onChange={(e) => {
                    const v = e.target.value;
                    matchupToolbar.onOpponentChange(v);
                    matchupToolbar.onPitcherChange("");
                  }}
                  className="min-w-0 max-w-[14rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                  aria-label="Filter by opponent"
                >
                  <option value="">All opponents</option>
                  {matchupToolbar.opponents.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 max-w-full items-center gap-2 text-sm text-white">
                <span className="shrink-0">Pitcher</span>
                <select
                  value={matchupToolbar.pitcherId}
                  onChange={(e) => matchupToolbar.onPitcherChange(e.target.value)}
                  disabled={!matchupToolbar.opponentKey}
                  className="min-w-0 max-w-[14rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Filter by opposing pitcher"
                >
                  <option value="">{matchupToolbar.opponentKey ? "All pitchers" : "Select opponent"}</option>
                  {(matchupToolbar.pitchersByOpponent[matchupToolbar.opponentKey] ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <label className="flex min-w-0 items-center gap-2 text-sm text-white">
            <span className="shrink-0">Search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Player name…"
              className="min-w-[8rem] max-w-[16rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none"
            />
          </label>
        </div>
        {toolbarEnd ? <div className="flex shrink-0 items-center">{toolbarEnd}</div> : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="stats-sheet-table w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="bg-[var(--bg-elevated)]">
              <th
                className={`font-display border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] ${STICKY_LEAD.rank}`}
                title={BATTING_STAT_HEADER_TOOLTIPS.rank}
              >
                #
              </th>
              {COLUMNS.map(({ key, label, align, tooltip }, idx) => (
                <Fragment key={key + String(idx)}>
                  <th
                    title={tooltip}
                    className={`border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] ${
                      idx === 0 ? `font-display ${STICKY_LEAD.player}` : SCROLL_CELL_Z
                    } ${
                      STAT_GROUP_BORDER_LEFT[key] ? "border-l border-[var(--border)]" : ""
                    } ${
                      align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
                    } cursor-pointer select-none hover:text-[var(--text)] ${sortKey === key ? "text-[var(--accent)]" : ""}`}
                    onClick={() => handleSort(key)}
                  >
                    {label}
                    {sortKey === key && (
                      <span className="ml-1 text-[var(--accent)]" aria-hidden>
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </th>
                  {idx === 0 && (
                    <th
                      title={BATTING_STAT_HEADER_TOOLTIPS.bats}
                      className={`font-display border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] ${SCROLL_CELL_Z}`}
                    >
                      Bats
                    </th>
                  )}
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((player, index) => {
              const s = initialBattingStats[player.id];
              const overallBr = battingStatsWithSplits[player.id]?.overall;
              const isL = (key: SortKey) =>
                isLeaderMatch(
                  getNumericStatForLeader(player, s, battingStatsWithSplits, key),
                  teamColumnMax[key]
                );
              return (
                <tr
                  key={player.id}
                  tabIndex={0}
                  onClick={() => setSelectedPlayerId((prev) => (prev === player.id ? null : player.id))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedPlayerId((prev) => (prev === player.id ? null : player.id));
                    }
                  }}
                  className={`group cursor-pointer transition-colors ${
                    selectedPlayerId === player.id
                      ? index % 2 === 0
                        ? "bg-[color-mix(in_srgb,var(--accent)_18%,var(--bg-base))]"
                        : "bg-[color-mix(in_srgb,var(--accent)_18%,var(--bg-elevated))]"
                      : index % 2 === 0
                        ? "bg-[var(--bg-base)] hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--bg-base))]"
                        : "bg-[var(--bg-elevated)] hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--bg-elevated))]"
                  }`}
                >
                  <td
                    className={`px-3 py-2 text-center text-[var(--text-muted)] tabular-nums ${STICKY_LEAD.rank} ${stickyLeadRowBg(selectedPlayerId === player.id, index)}`}
                  >
                    {index + 1}
                  </td>
                  <td
                    className={`min-w-0 px-3 py-2 font-medium text-[var(--text)] ${STICKY_LEAD.player} ${stickyLeadRowBg(selectedPlayerId === player.id, index)}`}
                  >
                    <Link
                      href={`/analyst/players/${player.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate text-[var(--accent)] hover:underline"
                      title={player.name}
                    >
                      {player.name}
                      {player.jersey && (
                        <span className="ml-1 text-[var(--text-muted)]">#{player.jersey}</span>
                      )}
                    </Link>
                  </td>
                  <td
                    className={`${SCROLL_CELL_Z} px-3 py-2 text-center text-[var(--text)] tabular-nums`}
                  >
                    {player.bats != null ? BATS_LABEL[player.bats] ?? player.bats : "—"}
                  </td>
                  {/* Games played / started */}
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("gp")}>
                      {s?.gp ?? "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("gs")}>
                      {s?.gs ?? "—"}
                    </LeaderStat>
                  </td>
                  {/* Results */}
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("pa")}>
                      {s?.pa ?? "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("ab")}>
                      {s?.ab ?? "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("h")}>
                      {s?.h ?? "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("double")}>
                      {s?.double ?? "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("triple")}>
                      {s?.triple ?? "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("hr")}>
                      {s?.hr ?? "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("rbi")}>
                      {s?.rbi ?? "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("r")}>
                      {s?.r ?? "—"}
                    </LeaderStat>
                  </td>
                  {/* Plate discipline */}
                  <td className={`${SCROLL_CELL_Z} border-l border-[var(--border)] px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("pPa")}>
                      {s?.pPa != null ? formatPPa(s.pPa) : "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("kPct")}>
                      {s ? formatStat(s.kPct, "pct") : "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("bbPct")}>
                      {s ? formatStat(s.bbPct, "pct") : "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("bb")}>
                      {s?.bb ?? "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("ibb")}>
                      {s?.ibb ?? "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("hbp")}>
                      {s?.hbp ?? "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("so")}>
                      {s?.so ?? "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("gidp")}>
                      {s?.gidp ?? "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("fieldersChoice")}>
                      {s?.fieldersChoice ?? "—"}
                    </LeaderStat>
                  </td>
                  {/* Offensive production */}
                  <td className={`${SCROLL_CELL_Z} border-l border-[var(--border)] px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("avg")}>
                      {s ? formatStat(s.avg, "avg") : "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("obp")}>
                      {s ? formatStat(s.obp, "avg") : "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("slg")}>
                      {s ? formatStat(s.slg, "avg") : "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("ops")}>
                      {s ? formatStat(s.ops, "avg") : "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("opsPlus")}>
                      {s ? formatStat(s.opsPlus, "int") : "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("woba")}>
                      {s ? formatStat(s.woba, "avg") : "—"}
                    </LeaderStat>
                  </td>
                  {/* Baserunning */}
                  <td className={`${SCROLL_CELL_Z} border-l border-[var(--border)] px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("sb")}>
                      {s?.sb ?? "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("cs")}>
                      {overallBr?.cs ?? "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("sbPct")}>
                      {overallBr?.sbPct != null ? formatStat(overallBr.sbPct, "pct") : "—"}
                    </LeaderStat>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && (
        <p className="py-8 text-center text-sm text-[var(--text-muted)]">
          {search.trim() ? "No players match your search." : "No players yet."}
        </p>
      )}
    </div>
  );
}
