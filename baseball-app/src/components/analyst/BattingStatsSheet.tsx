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
  PitchEvent,
  PlateAppearance,
  Player,
  StatsRunnersFilterKey,
} from "@/lib/types";
import {
  BATTING_SHEET_COLUMNS as COLUMNS,
  BATTING_SHEET_CONTACT_COLUMNS as CONTACT_COLUMNS,
  BATTING_SHEET_DISCIPLINE_COLUMNS as DISCIPLINE_COLUMNS,
  BATTING_SHEET_FINAL_COUNT_COLUMNS as FINAL_COUNT_COLUMNS,
  BATTING_SHEET_STAT_GROUP_BORDER_LEFT as STAT_GROUP_BORDER_LEFT,
  FINAL_COUNT_BUCKET_OPTIONS,
  type BattingSheetColumnMode,
  type BattingSheetSortKey,
  battingSheetContactStatBorderLeft as contactStatBorderLeft,
  battingSheetProfileCompactStatBorderLeft,
  formatBattingSheetDataCell,
  formatBattingSheetNumber,
} from "./battingStatsSheetModel";
import { GroupedStatsFiltersPanel } from "@/components/analyst/GroupedStatsFiltersPanel";
import { StatsRunnersFilterSelect } from "@/components/analyst/StatsRunnersFilterSelect";
import { battingStatsForFinalCountBucket } from "@/lib/compute/battingStatsWithSplitsFromPas";
import { battingStatsForSheetLiveFilters } from "@/lib/compute/statsSheetLiveFilters";
import {
  applyCountStateContactToBattingStats,
  battingStatsForCountStateReached,
  buildCountStateContactByBatter,
  countStatePaQualificationForRunnersFilter,
} from "@/lib/compute/statsSheetCountStateContact";
import { STATS_RUNNERS_LABEL } from "@/lib/statsRunnersFilter";
type BattingColumnMode = BattingSheetColumnMode;

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
  splitView: SplitView,
  useFilteredSample: boolean
): number | undefined {
  if (key === "name") return undefined;
  if (key === "cs" || key === "sbPct") {
    if (useFilteredSample && stats) {
      if (key === "sbPct") {
        const v = stats.sbPct;
        return typeof v === "number" && !Number.isNaN(v) ? v : undefined;
      }
      const v = stats.cs;
      return typeof v === "number" ? v : undefined;
    }
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
  splitView: SplitView,
  useFilteredSample: boolean
): string | number | undefined {
  if (key === "name") return player.name;
  if (key === "cs" || key === "sbPct") {
    if (useFilteredSample && stats) {
      const v = stats[key];
      return typeof v === "number" ? v : key === "cs" ? 0 : undefined;
    }
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
  /** With `onSplitViewChange`, platoon split is controlled by the parent. */
  splitView?: SplitView;
  onSplitViewChange?: (v: SplitView) => void;
  /** With `onFinalCountBucketChange`, Final count is controlled by the parent (e.g. URL persistence). */
  finalCountBucket?: BattingFinalCountBucketKey | null;
  onFinalCountBucketChange?: (v: BattingFinalCountBucketKey | null) => void;
  /** Starting base state before the PA; `all` uses full sample. Ignored when `onRunnersFilterChange` is absent (internal state). */
  runnersFilter?: StatsRunnersFilterKey;
  onRunnersFilterChange?: (v: StatsRunnersFilterKey) => void;
  /** `grouped`: filter card. `section`: table only (parent supplies heading / search / locked slice). */
  toolbarVariant?: "default" | "grouped" | "section";
  /** When set, split/runners/count/columns are fixed and hidden from the toolbar. */
  lockedSplitView?: SplitView;
  lockedRunnersFilter?: StatsRunnersFilterKey;
  lockedFinalCountBucket?: BattingFinalCountBucketKey | null;
  lockedColumnMode?: BattingColumnMode;
  /** Shared search from the team stats page (all sections). */
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  /** Hide the footnote under final-count / discipline filters (section parent may explain once). */
  hideFilterFootnote?: boolean;
  /** Player name link target (default: analyst roster profile). */
  playerProfileHref?: (playerId: string) => string;
  /** Optional PA/pitch-event scope for pitch-count-state contact rates on Final count. */
  pas?: PlateAppearance[];
  pitchEvents?: PitchEvent[];
  /** Game ids where each player was in the starting lineup (for G/GS on live-filtered samples). */
  startedGameIdsByPlayer?: Record<string, string[]>;
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
  splitView: splitViewProp,
  onSplitViewChange,
  finalCountBucket: finalCountBucketProp,
  onFinalCountBucketChange,
  runnersFilter: runnersFilterProp,
  onRunnersFilterChange,
  toolbarVariant = "default",
  lockedSplitView,
  lockedRunnersFilter,
  lockedFinalCountBucket,
  lockedColumnMode,
  searchQuery: searchQueryProp,
  onSearchQueryChange,
  hideFilterFootnote = false,
  playerProfileHref = analystPlayerProfileHref,
  pas,
  pitchEvents,
  startedGameIdsByPlayer = {},
}: BattingStatsSheetProps) {
  const [searchInternal, setSearchInternal] = useState("");
  const searchControlled = onSearchQueryChange != null;
  const search = searchControlled ? (searchQueryProp ?? "") : searchInternal;
  const setSearch = (v: string) => {
    if (searchControlled) onSearchQueryChange(v);
    else setSearchInternal(v);
  };
  const [splitViewInternal, setSplitViewInternal] = useState<SplitView>("overall");
  const splitControlled = onSplitViewChange != null;
  const splitView = splitControlled ? (splitViewProp ?? "overall") : splitViewInternal;
  const setSplitView = (v: SplitView) => {
    if (splitControlled) onSplitViewChange(v);
    else setSplitViewInternal(v);
  };
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
  const effectiveSplitView = lockedSplitView ?? splitView;
  const effectiveRunnersFilter = lockedRunnersFilter ?? runnersFilter;
  const effectiveFinalCountBucket =
    lockedFinalCountBucket !== undefined ? lockedFinalCountBucket : finalCountBucket;
  const effectiveColumnMode = lockedColumnMode ?? columnMode;

  useEffect(() => {
    if (splitDisabled && splitView !== "overall") setSplitView("overall");
  }, [splitDisabled, splitView]);

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const usesDisciplineCountState =
    effectiveColumnMode === "discipline" && effectiveFinalCountBucket != null;

  const displayColumns = useMemo(() => {
    const base =
      effectiveColumnMode === "contact"
        ? CONTACT_COLUMNS
        : effectiveColumnMode === "discipline"
          ? DISCIPLINE_COLUMNS
          : effectiveColumnMode === "finalCount"
            ? FINAL_COUNT_COLUMNS
            : COLUMNS;
    if (!usesDisciplineCountState) return base;
    return base.map((c) =>
      c.key === "kPct"
        ? { ...c, tooltip: BATTING_STAT_HEADER_TOOLTIPS.kPctAtCountState }
        : c
    );
  }, [effectiveColumnMode, usesDisciplineCountState]);

  const countStateMode = effectiveColumnMode === "contact" || usesDisciplineCountState;
  const usesContactCells = effectiveColumnMode === "contact" || effectiveColumnMode === "discipline";
  const standardColumnBorderLeft = (key: SortKey) =>
    effectiveColumnMode === "finalCount"
      ? battingSheetProfileCompactStatBorderLeft("finalCount", key)
      : STAT_GROUP_BORDER_LEFT[key] === true;
  const countFilterLabel = countStateMode ? "Count state" : "Final count";
  const countFilterAria = countStateMode
    ? "Filter discipline rates to pitches thrown at this ball-strike count state"
    : "Filter stats to plate appearances ending at this ball-strike count";
  const countFilterTitle = countStateMode
    ? "In Discipline mode, Sw% / Whiff% / Foul% use pitches thrown at this count state."
    : "Optional. When set, table uses only PAs whose saved final count matches (combines with Runners when both are set).";

  useEffect(() => {
    setSortKey("name");
    setSortDir("asc");
  }, [effectiveColumnMode]);

  const groupedFiltersSummary = useMemo(() => {
    const parts: string[] = [];
    if (effectiveRunnersFilter !== "all") parts.push(STATS_RUNNERS_LABEL[effectiveRunnersFilter]);
    if (effectiveFinalCountBucket) {
      const label = FINAL_COUNT_BUCKET_OPTIONS.find((o) => o.value === effectiveFinalCountBucket)?.label;
      if (label) parts.push(label);
    }
    if (matchupToolbar?.opponentKey) {
      const opp = matchupToolbar.opponents.find((o) => o.key === matchupToolbar.opponentKey);
      parts.push(opp ? `vs ${opp.label}` : "Opponent");
    }
    if (matchupToolbar?.pitcherId) parts.push("Pitcher");
    if (search.trim()) parts.push("Search");
    return parts.length > 0 ? parts.join(" · ") : null;
  }, [effectiveRunnersFilter, effectiveFinalCountBucket, matchupToolbar, search]);

  const pitchCountStateContactByPlayer = useMemo(
    () =>
      countStateMode && effectiveFinalCountBucket != null
        ? buildCountStateContactByBatter(
            players,
            pas,
            pitchEvents,
            effectiveSplitView,
            effectiveRunnersFilter,
            effectiveFinalCountBucket,
            countStatePaQualificationForRunnersFilter(effectiveRunnersFilter)
          )
        : {},
    [
      countStateMode,
      effectiveFinalCountBucket,
      effectiveRunnersFilter,
      players,
      pas,
      pitchEvents,
      effectiveSplitView,
    ]
  );

  const sampleUsesFilteredLine =
    effectiveRunnersFilter !== "all" || effectiveFinalCountBucket != null;

  const initialBattingStats = useMemo(() => {
    const out: Record<string, BattingStats> = {};
    const canLiveFilter =
      pas != null &&
      pas.length > 0 &&
      effectiveFinalCountBucket != null &&
      effectiveRunnersFilter !== "all";
    for (const p of players) {
      let s: BattingStats | undefined;
      if (effectiveFinalCountBucket != null) {
        if (canLiveFilter) {
          const started = new Set(startedGameIdsByPlayer[p.id] ?? []);
          s = battingStatsForSheetLiveFilters(
            p.id,
            pas,
            effectiveSplitView,
            effectiveRunnersFilter,
            effectiveFinalCountBucket,
            started,
            pitchEvents
          );
        } else if (countStateMode) {
          const started = new Set(startedGameIdsByPlayer[p.id] ?? []);
          s = battingStatsForCountStateReached(
            p.id,
            pas ?? [],
            pitchEvents ?? [],
            effectiveSplitView,
            effectiveRunnersFilter,
            effectiveFinalCountBucket,
            started
          );
        } else {
          const map = getFinalCountMapForSplit(
            battingStatsWithSplits,
            p.id,
            effectiveSplitView,
            effectiveRunnersFilter
          );
          s = map?.[effectiveFinalCountBucket] ?? undefined;
        }
        if (s && countStateMode) {
          s = applyCountStateContactToBattingStats(s, pitchCountStateContactByPlayer[p.id]);
        } else if (s && effectiveFinalCountBucket != null) {
          s = battingStatsForFinalCountBucket(s, effectiveFinalCountBucket) ?? s;
        }
      } else {
        s = getBattingLineForSheet(
          battingStatsWithSplits,
          p.id,
          effectiveSplitView,
          effectiveRunnersFilter
        );
      }
      if (s) out[p.id] = s;
    }
    return out;
  }, [
    players,
    battingStatsWithSplits,
    effectiveSplitView,
    effectiveFinalCountBucket,
    effectiveRunnersFilter,
    effectiveColumnMode,
    pitchCountStateContactByPlayer,
    pas,
    pitchEvents,
    startedGameIdsByPlayer,
  ]);

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
      const sa = getStatValue(
        a,
        initialBattingStats[a.id],
        sortKey,
        battingStatsWithSplits,
        effectiveSplitView,
        sampleUsesFilteredLine
      );
      const sb = getStatValue(
        b,
        initialBattingStats[b.id],
        sortKey,
        battingStatsWithSplits,
        effectiveSplitView,
        sampleUsesFilteredLine
      );
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
    effectiveSplitView,
    sampleUsesFilteredLine,
  ]);

  /** Per-column max among visible rows (filtered) — ties all get bold+italic. */
  const teamColumnMax = useMemo(() => {
    const keys = displayColumns.filter((c) => c.key !== "name").map((c) => c.key);
    const max: Partial<Record<SortKey, number>> = {};
    for (const key of keys) {
      let best: number | undefined;
      for (const p of filtered) {
        const s = initialBattingStats[p.id];
        const n = getNumericStatForLeader(
          p,
          s,
          battingStatsWithSplits,
          key,
          effectiveSplitView,
          sampleUsesFilteredLine
        );
        if (n === undefined || Number.isNaN(n)) continue;
        if (best === undefined) best = n;
        else if (BATTING_LOWER_BETTER.has(key)) {
          if (n < best) best = n;
        } else if (n > best) best = n;
      }
      if (best !== undefined) max[key] = best;
    }
    return max;
  }, [
    filtered,
    initialBattingStats,
    battingStatsWithSplits,
    displayColumns,
    effectiveSplitView,
    sampleUsesFilteredLine,
  ]);

  const battingTeamLine = useMemo(
    () =>
      aggregateBattingTeamLine(
        filtered,
        initialBattingStats,
        battingStatsWithSplits,
        sampleUsesFilteredLine
      ),
    [filtered, initialBattingStats, battingStatsWithSplits, sampleUsesFilteredLine]
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

      {toolbarVariant === "section" ? null : toolbarVariant === "grouped" ? (
        <div className="flex flex-col gap-3">
          <GroupedStatsFiltersPanel activeSummary={groupedFiltersSummary}>
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
                  <StatsRunnersFilterSelect
                    value={runnersFilter}
                    onChange={setRunnersFilter}
                    className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {countFilterLabel}
                  </span>
                  <select
                    value={finalCountBucket ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFinalCountBucket(v === "" ? null : (v as BattingFinalCountBucketKey));
                    }}
                    className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={countFilterAria}
                    title={countFilterTitle}
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
          </GroupedStatsFiltersPanel>
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
              <StatsRunnersFilterSelect
                value={runnersFilter}
                onChange={setRunnersFilter}
                className="max-w-[12rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
              />
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
              <span className="shrink-0">{countFilterLabel}</span>
              <select
                value={finalCountBucket ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setFinalCountBucket(v === "" ? null : (v as BattingFinalCountBucketKey));
                }}
                className="max-w-[7.5rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={countFilterAria}
                title={countFilterTitle}
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
      {!hideFilterFootnote && effectiveFinalCountBucket != null && (
        <p className="text-xs leading-snug text-[var(--text-muted)]">
          {countStateMode ? (
            <>
              {effectiveRunnersFilter !== "all" ? (
                <>
                  <strong className="font-medium text-[var(--text)]">PA, G, K%, and BB%</strong> use plate appearances that match
                  Runners + saved final count{" "}
                  <strong className="font-medium text-[var(--text)]">{effectiveFinalCountBucket}</strong>.
                </>
              ) : (
                <>
                  <strong className="font-medium text-[var(--text)]">PA, G, K%, and BB%</strong> use every plate appearance that{" "}
                  <strong className="font-medium text-[var(--text)]">reached {effectiveFinalCountBucket}</strong> (at least one logged
                  pitch started at that count); K% is the full-AB strikeout rate on those PAs, not strikeouts on the{" "}
                  {effectiveFinalCountBucket} pitch alone.
                </>
              )}{" "}
              Sw%, Whiff%, Foul%, GB/LD/FB/IFF%, and P/PA use{" "}
              <strong className="font-medium text-[var(--text)]">pitches thrown at {effectiveFinalCountBucket}</strong> on those
              PAs only (BIP types from balls in play at that count).
            </>
          ) : (
            <>
              Stats for plate appearances whose <strong className="font-medium text-[var(--text)]">saved final count</strong> is{" "}
              <strong className="font-medium text-[var(--text)]">{effectiveFinalCountBucket}</strong>
              {effectiveRunnersFilter !== "all" ? (
                <>
                  {" "}
                  with{" "}
                  <strong className="font-medium text-[var(--text)]">
                    {STATS_RUNNERS_LABEL[effectiveRunnersFilter]}
                  </strong>
                </>
              ) : null}
              .
            </>
          )}
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
                      (usesContactCells
                        ? contactStatBorderLeft(key)
                        : standardColumnBorderLeft(key))
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
                  getNumericStatForLeader(
                    player,
                    s,
                    battingStatsWithSplits,
                    key,
                    effectiveSplitView,
                    sampleUsesFilteredLine
                  ),
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
                      href={playerProfileHref(player.id)}
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
                  {usesContactCells ? (
                    <>
                      {displayColumns.slice(1).map((col) => (
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
                  ) : effectiveColumnMode === "finalCount" ? (
                    <>
                      {FINAL_COUNT_COLUMNS.slice(1).map((col) => (
                        <td
                          key={col.key}
                          className={`${SCROLL_CELL_Z}${
                            standardColumnBorderLeft(col.key) ? " border-l border-[var(--border)]" : ""
                          } px-3 py-2 text-right tabular-nums text-[var(--text)] ${
                            col.align === "center" ? "text-center" : ""
                          }`}
                        >
                          <LeaderStat show={isL(col.key)}>
                            {formatBattingSheetDataCell(col, s, s)}
                          </LeaderStat>
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
                      (usesContactCells
                        ? contactStatBorderLeft(col.key)
                        : standardColumnBorderLeft(col.key))
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
