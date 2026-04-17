"use client";

import { useState, useMemo, useEffect, Fragment, type ReactNode } from "react";
import Link from "next/link";
import { analystPlayerProfileHref } from "@/lib/analystRoutes";
import { formatPPa } from "@/lib/format";
import { comparePlayersByLastNameThenFull } from "@/lib/playerSort";
import { aggregateBattingTeamLine } from "@/lib/compute/statSheetTeamTotals";
import { BATTING_STAT_HEADER_TOOLTIPS } from "@/lib/statHeaderTooltips";
import type {
  BattingFinalCountBucketKey,
  BattingStats,
  BattingStatsWithSplits,
  Player,
  StatsRunnersFilterKey,
} from "@/lib/types";
import {
  BATTING_SHEET_COLUMNS as COLUMNS,
  BATTING_SHEET_CONTACT_COLUMNS as CONTACT_COLUMNS,
  BATTING_SHEET_STAT_GROUP_BORDER_LEFT as STAT_GROUP_BORDER_LEFT,
  FINAL_COUNT_BUCKET_OPTIONS,
  type BattingSheetSortKey,
  battingSheetContactStatBorderLeft as contactStatBorderLeft,
  formatBattingSheetDataCell,
  formatBattingSheetNumber,
} from "./battingStatsSheetModel";
type BattingColumnMode = "standard" | "contact";

/** Platoon slice for the stat sheet (runner situation is a separate control). */
export type SplitView = "overall" | "vsL" | "vsR";

type SortKey = BattingSheetSortKey;

/** Columns where a lower value is better for default sort and leader highlight (e.g. fielding errors). */
const BATTING_LOWER_BETTER = new Set<SortKey>(["e"]);

const BATS_LABEL: Record<string, string> = { L: "L", R: "R", S: "S" };

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

/** Full-width rule above team totals (`border-separate` tables don’t paint `<tr>` borders reliably). */
const TEAM_FOOTER_TOP_RULE =
  "border-t-[3px] border-[color-mix(in_srgb,var(--accent)_85%,var(--border)_15%)]";

/** Stat-group dividers on the team row (matches accent-tinted top rule; plain `--border` reads too dim). */
const TEAM_FOOTER_GROUP_LEFT =
  "border-l-2 border-[color-mix(in_srgb,var(--accent)_58%,var(--border)_42%)]";

function getFinalCountMapForSplit(
  splits: Record<string, BattingStatsWithSplits>,
  playerId: string,
  split: SplitView,
  runners: StatsRunnersFilterKey
): Partial<Record<BattingFinalCountBucketKey, BattingStats | null>> | undefined {
  if (runners !== "all") return undefined;
  const sfc = splits[playerId]?.statsByFinalCount;
  if (!sfc) return undefined;
  if (split === "overall") return sfc.overall;
  if (split === "vsL") return sfc.vsL;
  return sfc.vsR;
}

function getBattingLineForSheet(
  splits: Record<string, BattingStatsWithSplits>,
  playerId: string,
  platoon: SplitView,
  runners: StatsRunnersFilterKey
): BattingStats | undefined {
  const s = splits[playerId];
  if (!s) return undefined;
  if (runners === "all") {
    if (platoon === "overall") return s.overall;
    if (platoon === "vsL") return s.vsL ?? undefined;
    return s.vsR ?? undefined;
  }
  const triple = s.runnerSituations?.[runners];
  if (!triple) return undefined;
  if (platoon === "overall") return triple.combined ?? undefined;
  if (platoon === "vsL") return triple.vsL ?? undefined;
  return triple.vsR ?? undefined;
}

/** Numeric value for leader comparison — matches displayed split/overall sources. */
function getNumericStatForLeader(
  player: Player,
  stats: BattingStats | undefined,
  splits: Record<string, BattingStatsWithSplits>,
  key: SortKey,
  splitView: SplitView
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
  if (key === "e") {
    const v = stats.e;
    return typeof v === "number" ? v : 0;
  }
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

function renderContactBattingDataCell(
  s: BattingStats | undefined,
  col: (typeof COLUMNS)[number],
  isL: (key: SortKey) => boolean
): ReactNode {
  const k = col.key;
  const v = s?.[k as keyof BattingStats];
  if (k === "pPa") {
    return (
      <LeaderStat show={isL(k)}>{s?.pPa != null ? formatPPa(s.pPa) : "—"}</LeaderStat>
    );
  }
  if (col.format === "pct") {
    return (
      <LeaderStat show={isL(k)}>{typeof v === "number" ? formatBattingSheetNumber(v, "pct") : "—"}</LeaderStat>
    );
  }
  if (col.format === "int") {
    return <LeaderStat show={isL(k)}>{typeof v === "number" ? v : "—"}</LeaderStat>;
  }
  return <LeaderStat show={isL(k)}>—</LeaderStat>;
}

function getStatValue(
  player: Player,
  stats: BattingStats | undefined,
  key: SortKey,
  splits: Record<string, BattingStatsWithSplits> | undefined,
  splitView: SplitView
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
      key === "e" ||
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
  /** When set, the Opponent dropdown is hidden and this flat list is used (e.g. your pitchers vs this opponent). */
  pitchersFlat?: { id: string; name: string }[];
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
  /** Shown beside the search field on the same row (e.g. reset URL filters). */
  sampleToolbarEnd?: ReactNode;
  /** Opponent + pitcher dropdowns (same row as Split / Search). */
  matchupToolbar?: BattingMatchupToolbarConfig;
  /** When true (e.g. specific pitcher selected), Split resets to Overall and the control is disabled. */
  splitDisabled?: boolean;
  /** With `onFinalCountBucketChange`, Final count is controlled by the parent (e.g. URL persistence). */
  finalCountBucket?: BattingFinalCountBucketKey | null;
  onFinalCountBucketChange?: (v: BattingFinalCountBucketKey | null) => void;
  /** Starting base state before the PA; `all` uses full sample. Ignored when `onRunnersFilterChange` is absent (internal state). */
  runnersFilter?: StatsRunnersFilterKey;
  onRunnersFilterChange?: (v: StatsRunnersFilterKey) => void;
  /** `grouped`: single filters card (split, runners, final count, matchup, columns, search) — e.g. Stats page. */
  toolbarVariant?: "default" | "grouped";
}

export function BattingStatsSheet({
  players = [],
  battingStatsWithSplits,
  heading,
  subheading,
  toolbarEnd,
  sampleToolbarEnd,
  matchupToolbar,
  splitDisabled = false,
  finalCountBucket: finalCountBucketProp,
  onFinalCountBucketChange,
  runnersFilter: runnersFilterProp,
  onRunnersFilterChange,
  toolbarVariant = "default",
}: BattingStatsSheetProps) {
  const [search, setSearch] = useState("");
  const [splitView, setSplitView] = useState<SplitView>("overall");
  const [runnersFilterInternal, setRunnersFilterInternal] = useState<StatsRunnersFilterKey>("all");
  const runnersControlled = onRunnersFilterChange != null;
  const runnersFilter = runnersControlled ? (runnersFilterProp ?? "all") : runnersFilterInternal;
  const setRunnersFilter = (v: StatsRunnersFilterKey) => {
    if (runnersControlled) onRunnersFilterChange(v);
    else setRunnersFilterInternal(v);
  };
  const [columnMode, setColumnMode] = useState<BattingColumnMode>("standard");
  /** When set, stats rows use the PA subset whose saved final count matches (works with Standard or Discipline columns). */
  const [finalCountBucketInternal, setFinalCountBucketInternal] = useState<BattingFinalCountBucketKey | null>(null);
  const finalCountControlled = onFinalCountBucketChange != null;
  const finalCountBucket = finalCountControlled ? (finalCountBucketProp ?? null) : finalCountBucketInternal;
  const setFinalCountBucket = (v: BattingFinalCountBucketKey | null) => {
    if (finalCountControlled) onFinalCountBucketChange(v);
    else setFinalCountBucketInternal(v);
  };

  useEffect(() => {
    if (splitDisabled && splitView !== "overall") setSplitView("overall");
  }, [splitDisabled, splitView]);

  useEffect(() => {
    if (runnersFilter === "all") return;
    if (finalCountControlled) {
      if (finalCountBucket != null) onFinalCountBucketChange?.(null);
    } else {
      setFinalCountBucketInternal((prev) => (prev == null ? prev : null));
    }
  }, [runnersFilter, finalCountControlled, finalCountBucket, onFinalCountBucketChange]);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const displayColumns = columnMode === "contact" ? CONTACT_COLUMNS : COLUMNS;

  useEffect(() => {
    setSortKey("name");
    setSortDir("asc");
  }, [columnMode]);

  const initialBattingStats = useMemo(() => {
    const out: Record<string, BattingStats> = {};
    for (const p of players) {
      let s: BattingStats | undefined;
      if (finalCountBucket != null) {
        const map = getFinalCountMapForSplit(battingStatsWithSplits, p.id, splitView, runnersFilter);
        s = map?.[finalCountBucket] ?? undefined;
      } else {
        s = getBattingLineForSheet(battingStatsWithSplits, p.id, splitView, runnersFilter);
      }
      if (s) out[p.id] = s;
    }
    return out;
  }, [players, battingStatsWithSplits, splitView, finalCountBucket, runnersFilter]);

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
      const sa = getStatValue(a, initialBattingStats[a.id], sortKey, battingStatsWithSplits, splitView);
      const sb = getStatValue(b, initialBattingStats[b.id], sortKey, battingStatsWithSplits, splitView);
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
  }, [
    filtered,
    initialBattingStats,
    battingStatsWithSplits,
    sortKey,
    sortDir,
    displayColumns,
    splitView,
    runnersFilter,
  ]);

  /** Per-column max among visible rows (filtered) — ties all get bold+italic. */
  const teamColumnMax = useMemo(() => {
    const keys = displayColumns.filter((c) => c.key !== "name").map((c) => c.key);
    const max: Partial<Record<SortKey, number>> = {};
    for (const key of keys) {
      let best: number | undefined;
      for (const p of filtered) {
        const s = initialBattingStats[p.id];
        const n = getNumericStatForLeader(p, s, battingStatsWithSplits, key, splitView);
        if (n === undefined || Number.isNaN(n)) continue;
        if (best === undefined) best = n;
        else if (BATTING_LOWER_BETTER.has(key)) {
          if (n < best) best = n;
        } else if (n > best) best = n;
      }
      if (best !== undefined) max[key] = best;
    }
    return max;
  }, [filtered, initialBattingStats, battingStatsWithSplits, displayColumns, splitView]);

  const battingTeamLine = useMemo(
    () => aggregateBattingTeamLine(filtered, initialBattingStats, battingStatsWithSplits),
    [filtered, initialBattingStats, battingStatsWithSplits]
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : BATTING_LOWER_BETTER.has(key) ? "asc" : "desc");
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

      {toolbarVariant === "grouped" ? (
        <div className="flex flex-col gap-3">
          <div className="min-w-0 rounded-lg border border-[var(--border)]/55 bg-[var(--bg-elevated)]/30 px-4 py-3">
            <div className="mb-3">
              <p className="font-display text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Filters
              </p>
            </div>
            <div
              className={`grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 ${
                matchupToolbar
                  ? "xl:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6"
                  : "xl:grid-cols-4 2xl:grid-cols-5"
              }`}
            >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Split
                  </span>
                  <select
                    value={splitView}
                    onChange={(e) => setSplitView(e.target.value as SplitView)}
                    disabled={splitDisabled}
                    title={
                      splitDisabled
                        ? "Split is off while a specific pitcher is selected (matchup line is already vs that arm)."
                        : undefined
                    }
                    className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Batting split view"
                  >
                    <option value="overall">Overall</option>
                    <option value="vsL">vs LHP</option>
                    <option value="vsR">vs RHP</option>
                  </select>
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Runners
                  </span>
                  <select
                    value={runnersFilter}
                    onChange={(e) => setRunnersFilter(e.target.value as StatsRunnersFilterKey)}
                    className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                    aria-label="Filter by base state before the plate appearance"
                    title="Uses offensive base state at the start of each PA (1st / 2nd / 3rd)."
                  >
                    <option value="all">All situations</option>
                    <option value="basesEmpty">Bases empty</option>
                    <option value="runnersOn">Runners on</option>
                    <option value="risp">RISP</option>
                    <option value="basesLoaded">Bases loaded</option>
                  </select>
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Final count
                  </span>
                  <select
                    value={finalCountBucket ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFinalCountBucket(v === "" ? null : (v as BattingFinalCountBucketKey));
                    }}
                    disabled={runnersFilter !== "all"}
                    className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Filter stats to plate appearances ending at this ball–strike count"
                    title={
                      runnersFilter !== "all"
                        ? "Clear Runners filter to use Final count (counts are only stored for the full sample splits)."
                        : "Optional. When set, table uses only PAs whose saved final count matches. Works with Standard or Discipline columns."
                    }
                  >
                    <option value="">All PAs</option>
                    {FINAL_COUNT_BUCKET_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                {matchupToolbar ? (
                  <>
                    {matchupToolbar.pitchersFlat === undefined ? (
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                          Opponent
                        </span>
                        <select
                          value={matchupToolbar.opponentKey}
                          onChange={(e) => {
                            const v = e.target.value;
                            matchupToolbar.onOpponentChange(v);
                            matchupToolbar.onPitcherChange("");
                          }}
                          className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                          aria-label="Filter by opponent"
                        >
                          <option value="">All opponents</option>
                          {matchupToolbar.opponents.map((o) => (
                            <option key={o.key} value={o.key}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        Pitcher
                      </span>
                      <select
                        value={matchupToolbar.pitcherId}
                        onChange={(e) => matchupToolbar.onPitcherChange(e.target.value)}
                        disabled={
                          matchupToolbar.pitchersFlat === undefined ? !matchupToolbar.opponentKey : false
                        }
                        className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={
                          matchupToolbar.pitchersFlat !== undefined
                            ? "Filter by batter (pitching side)"
                            : "Filter by opposing pitcher"
                        }
                      >
                        <option value="">
                          {matchupToolbar.pitchersFlat !== undefined
                            ? "All pitchers"
                            : matchupToolbar.opponentKey
                              ? "All pitchers"
                              : "Choose opponent first"}
                        </option>
                        {(matchupToolbar.pitchersFlat ??
                          matchupToolbar.pitchersByOpponent[matchupToolbar.opponentKey] ??
                          []
                        ).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : null}
              <div
                className={`col-span-full grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 ${
                  matchupToolbar
                    ? "xl:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6"
                    : "xl:grid-cols-4 2xl:grid-cols-5"
                }`}
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Columns
                  </span>
                  <select
                    value={columnMode}
                    onChange={(e) => setColumnMode(e.target.value as BattingColumnMode)}
                    className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                    aria-label="Stat column set"
                  >
                    <option value="standard">Standard</option>
                    <option value="contact">Discipline &amp; BIP</option>
                  </select>
                </div>
                <div
                  className={`flex min-w-0 flex-col gap-1.5 ${
                    matchupToolbar
                      ? "sm:col-span-1 lg:col-span-2 xl:col-span-3 2xl:col-span-4 min-[1800px]:col-span-5"
                      : "sm:col-span-1 lg:col-span-2 xl:col-span-3 2xl:col-span-4"
                  }`}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Search
                  </span>
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:gap-3 sm:justify-start">
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Player name…"
                      className="w-full max-w-[16rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none"
                    />
                    {sampleToolbarEnd ? <div className="shrink-0">{sampleToolbarEnd}</div> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {toolbarEnd ? <div className="flex shrink-0 justify-end">{toolbarEnd}</div> : null}
        </div>
      ) : (
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
              </select>
            </label>
            <label className="flex min-w-0 items-center gap-2 text-sm text-white">
              <span className="shrink-0">Runners</span>
              <select
                value={runnersFilter}
                onChange={(e) => setRunnersFilter(e.target.value as StatsRunnersFilterKey)}
                className="max-w-[12rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                aria-label="Filter by base state before the plate appearance"
                title="Uses offensive base state at the start of each PA (1st / 2nd / 3rd)."
              >
                <option value="all">All situations</option>
                <option value="basesEmpty">Bases empty</option>
                <option value="runnersOn">Runners on</option>
                <option value="risp">RISP</option>
                <option value="basesLoaded">Bases loaded</option>
              </select>
            </label>
            <label className="flex min-w-0 items-center gap-2 text-sm text-white">
              <span className="shrink-0">Columns</span>
              <select
                value={columnMode}
                onChange={(e) => setColumnMode(e.target.value as BattingColumnMode)}
                className="max-w-[14rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                aria-label="Stat column set"
              >
                <option value="standard">Standard</option>
                <option value="contact">Discipline &amp; BIP</option>
              </select>
            </label>
            <label className="flex min-w-0 items-center gap-2 text-sm text-white">
              <span className="shrink-0">Final count</span>
              <select
                value={finalCountBucket ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setFinalCountBucket(v === "" ? null : (v as BattingFinalCountBucketKey));
                }}
                disabled={runnersFilter !== "all"}
                className="max-w-[7.5rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Filter stats to plate appearances ending at this ball–strike count"
                title={
                  runnersFilter !== "all"
                    ? "Clear Runners filter to use Final count (counts are only stored for the full sample splits)."
                    : "Optional. When set, table uses only PAs whose saved final count matches. Works with Standard or Discipline columns."
                }
              >
                <option value="">All PAs</option>
                {FINAL_COUNT_BUCKET_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {matchupToolbar ? (
              <>
                {matchupToolbar.pitchersFlat === undefined ? (
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
                ) : null}
                <label className="flex min-w-0 max-w-full items-center gap-2 text-sm text-white">
                  <span className="shrink-0">Pitcher</span>
                  <select
                    value={matchupToolbar.pitcherId}
                    onChange={(e) => matchupToolbar.onPitcherChange(e.target.value)}
                    disabled={
                      matchupToolbar.pitchersFlat === undefined ? !matchupToolbar.opponentKey : false
                    }
                    className="min-w-0 max-w-[14rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={
                      matchupToolbar.pitchersFlat !== undefined
                        ? "Filter by batter (pitching side)"
                        : "Filter by opposing pitcher"
                    }
                  >
                    <option value="">
                      {matchupToolbar.pitchersFlat !== undefined
                        ? "All pitchers"
                        : matchupToolbar.opponentKey
                          ? "All pitchers"
                          : "Choose opponent first"}
                    </option>
                    {(matchupToolbar.pitchersFlat ??
                      matchupToolbar.pitchersByOpponent[matchupToolbar.opponentKey] ??
                      []
                    ).map((p) => (
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
      )}
      {finalCountBucket != null && (
        <p className="text-xs leading-snug text-[var(--text-muted)]">
          Showing stats for PAs whose{" "}
          <strong className="font-medium text-[var(--text)]">saved final count</strong> is{" "}
          <strong className="font-medium text-[var(--text)]">{finalCountBucket}</strong> (after Split). SB/CS and SB%
          still use full-season totals. Clear Final count to return to all PAs.
        </p>
      )}

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
              {displayColumns.map(({ key, label, align, tooltip }, idx) => (
                <Fragment key={key + String(idx)}>
                  <th
                    title={tooltip}
                    className={`border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)] ${
                      idx === 0 ? `font-display ${STICKY_LEAD.player}` : SCROLL_CELL_Z
                    } ${
                      (columnMode === "contact" ? contactStatBorderLeft(key) : STAT_GROUP_BORDER_LEFT[key])
                        ? "border-l border-[var(--border)]"
                        : ""
                    } ${
                      align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
                    } cursor-pointer select-none hover:opacity-85 ${sortKey === key ? "font-bold" : ""}`}
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
                      className={`font-display border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--accent)] ${SCROLL_CELL_Z}`}
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
                  getNumericStatForLeader(player, s, battingStatsWithSplits, key, splitView),
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
                      href={analystPlayerProfileHref(player.id)}
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
                  {columnMode === "contact" ? (
                    <>
                      {CONTACT_COLUMNS.slice(1).map((col) => (
                        <td
                          key={col.key}
                          className={`${SCROLL_CELL_Z}${
                            contactStatBorderLeft(col.key) ? " border-l border-[var(--border)]" : ""
                          } px-3 py-2 text-right tabular-nums text-[var(--text)] ${
                            col.align === "center" ? "text-center" : ""
                          }`}
                        >
                          {renderContactBattingDataCell(s, col, isL)}
                        </td>
                      ))}
                    </>
                  ) : (
                    <>
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
                      {s ? formatBattingSheetNumber(s.kPct, "pct") : "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("bbPct")}>
                      {s ? formatBattingSheetNumber(s.bbPct, "pct") : "—"}
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
                      {s ? formatBattingSheetNumber(s.avg, "avg") : "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("obp")}>
                      {s ? formatBattingSheetNumber(s.obp, "avg") : "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("slg")}>
                      {s ? formatBattingSheetNumber(s.slg, "avg") : "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("ops")}>
                      {s ? formatBattingSheetNumber(s.ops, "avg") : "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("opsPlus")}>
                      {s ? formatBattingSheetNumber(s.opsPlus, "int") : "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("woba")}>
                      {s ? formatBattingSheetNumber(s.woba, "avg") : "—"}
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
                      {overallBr?.sbPct != null ? formatBattingSheetNumber(overallBr.sbPct, "pct") : "—"}
                    </LeaderStat>
                  </td>
                  <td className={`${SCROLL_CELL_Z} border-l border-[var(--border)] px-3 py-2 text-right tabular-nums text-[var(--text)]`}>
                    <LeaderStat show={isL("e")}>{s?.e ?? "—"}</LeaderStat>
                  </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
          {sorted.length > 0 && battingTeamLine ? (
            <tfoot>
              <tr className="font-semibold text-[var(--text)] [&_td]:py-2.5">
                <td
                  className={`${TEAM_FOOTER_TOP_RULE} bg-[var(--bg-elevated)] px-3 py-2 text-center text-[var(--text-muted)] tabular-nums ${STICKY_LEAD.rank}`}
                >
                  —
                </td>
                <td
                  className={`${TEAM_FOOTER_TOP_RULE} min-w-0 bg-[var(--bg-elevated)] px-3 py-2 font-display font-semibold text-[var(--text)] ${STICKY_LEAD.player}`}
                >
                  Team
                </td>
                <td
                  className={`${TEAM_FOOTER_TOP_RULE} ${SCROLL_CELL_Z} bg-[var(--bg-elevated)] px-3 py-2 text-center text-[var(--text-muted)]`}
                >
                  —
                </td>
                {displayColumns.slice(1).map((col) => (
                  <td
                    key={`team-total-${col.key}`}
                    className={`${TEAM_FOOTER_TOP_RULE} ${SCROLL_CELL_Z} bg-[var(--bg-elevated)] px-3 py-2 text-right tabular-nums font-semibold text-[var(--accent)]${
                      (columnMode === "contact" ? contactStatBorderLeft(col.key) : STAT_GROUP_BORDER_LEFT[col.key])
                        ? ` ${TEAM_FOOTER_GROUP_LEFT}`
                        : ""
                    }`}
                    title={
                      col.key === "gp" || col.key === "gs"
                        ? "Team total not shown: summing each player’s games does not equal team games played."
                        : undefined
                    }
                  >
                    {formatBattingSheetDataCell(col, battingTeamLine, battingTeamLine)}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
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
