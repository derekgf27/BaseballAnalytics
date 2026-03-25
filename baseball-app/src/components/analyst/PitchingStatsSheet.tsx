"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { comparePlayersByLastNameThenFull } from "@/lib/playerSort";
import { formatPPa } from "@/lib/format";
import { REGULATION_INNINGS } from "@/lib/leagueConfig";
import { PITCHING_STAT_HEADER_TOOLTIPS } from "@/lib/statHeaderTooltips";
import type { PitchingStats, PitchingStatsWithSplits, Player } from "@/lib/types";

const THROWS_LABEL: Record<string, string> = { L: "L", R: "R" };

/** Same idea as batting `SplitView` — which batter-handedness sample to show. */
export type PitchingSplitView = "overall" | "vsLHB" | "vsRHB";

type PitchSortKey =
  | "name"
  | "g"
  | "gs"
  | "ip"
  | "h"
  | "r"
  | "er"
  | "hr"
  | "so"
  | "bb"
  | "hbp"
  | "era"
  | "fip"
  | "whip"
  | "k7"
  | "bb7"
  | "h7"
  | "hr7"
  | "kPct"
  | "bbPct"
  | "strikePct"
  | "fpsPct"
  | "pPa";

type ColFormat = "name" | "int" | "era" | "ip" | "rate7" | "pct" | "pPa";

const RI = REGULATION_INNINGS;

const COLUMNS: {
  key: PitchSortKey;
  label: string;
  align: "left" | "right";
  format: ColFormat;
  tooltip: string;
  borderLeft?: boolean;
}[] = [
  { key: "name", label: "Player", align: "left", format: "name", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.player },
  { key: "g", label: "G", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.g },
  { key: "gs", label: "GS", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.gs },
  { key: "ip", label: "IP", align: "right", format: "ip", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.ip },
  { key: "h", label: "H", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.h, borderLeft: true },
  { key: "r", label: "R", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.r },
  { key: "er", label: "ER", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.er },
  { key: "hr", label: "HR", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.hr },
  { key: "so", label: "SO", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.so, borderLeft: true },
  { key: "bb", label: "BB", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.bb },
  { key: "hbp", label: "HBP", align: "right", format: "int", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.hbp },
  { key: "era", label: `ERA (${RI})`, align: "right", format: "era", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.era, borderLeft: true },
  { key: "fip", label: `FIP (${RI})`, align: "right", format: "era", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.fip },
  { key: "whip", label: "WHIP", align: "right", format: "era", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.whip },
  { key: "k7", label: `K/${RI}`, align: "right", format: "rate7", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.k7, borderLeft: true },
  { key: "bb7", label: `BB/${RI}`, align: "right", format: "rate7", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.bb7 },
  { key: "h7", label: `H/${RI}`, align: "right", format: "rate7", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.h7 },
  { key: "hr7", label: `HR/${RI}`, align: "right", format: "rate7", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.hr7 },
  { key: "kPct", label: "K%", align: "right", format: "pct", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.kPctPitch },
  { key: "bbPct", label: "BB%", align: "right", format: "pct", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.bbPctPitch },
  { key: "strikePct", label: "Strike%", align: "right", format: "pct", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.strikePctPitch, borderLeft: true },
  { key: "fpsPct", label: "FPS%", align: "right", format: "pct", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.fpsPctPitch },
  { key: "pPa", label: "P/PA", align: "right", format: "pPa", tooltip: PITCHING_STAT_HEADER_TOOLTIPS.pPaPitch },
];

const LOWER_BETTER = new Set<PitchSortKey>([
  "era",
  "fip",
  "whip",
  "h",
  "r",
  "er",
  "hr",
  "bb",
  "hbp",
  "bb7",
  "h7",
  "hr7",
  "bbPct",
  "pPa",
]);

const HIGHER_BETTER = new Set<PitchSortKey>(["so", "k7", "kPct"]);

const OVERALL_PER7: PitchSortKey[] = ["k7", "bb7", "h7", "hr7"];

const STICKY_LEAD = {
  rank: "sticky left-0 z-[100] isolate [transform:translateZ(0)] w-12 min-w-[3rem] shrink-0",
  player:
    "sticky left-12 z-[100] isolate [transform:translateZ(0)] w-[12rem] min-w-[12rem] max-w-[12rem] shrink-0",
  throws:
    "sticky left-[15rem] z-[100] isolate [transform:translateZ(0)] w-10 min-w-[2.5rem] max-w-[2.5rem] shrink-0 shadow-[2px_0_0_0_var(--border)]",
} as const;

const SCROLL_CELL_Z = "relative !z-0";

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

function formatEraLike(value: number): string {
  if (value === 0) return "0.00";
  return value.toFixed(2);
}

function getPitchingStatsForSplit(
  splits: Record<string, PitchingStatsWithSplits>,
  playerId: string,
  split: PitchingSplitView
): PitchingStats | undefined {
  const s = splits[playerId];
  if (!s) return undefined;
  if (split === "overall") return s.overall;
  if (split === "vsLHB") return s.vsLHB ?? undefined;
  return s.vsRHB ?? undefined;
}

function getPitchingStatValue(stats: PitchingStats | undefined, key: PitchSortKey): number | undefined {
  if (!stats || key === "name") return undefined;
  switch (key) {
    case "g":
      return stats.g;
    case "gs":
      return stats.gs;
    case "ip":
      return stats.ip;
    case "h":
      return stats.h;
    case "r":
      return stats.r;
    case "era":
      return stats.era;
    case "er":
      return stats.er;
    case "hr":
      return stats.hr;
    case "so":
      return stats.so;
    case "bb":
      return stats.bb;
    case "hbp":
      return stats.hbp;
    case "fip":
      return stats.fip;
    case "whip":
      return stats.whip;
    case "k7":
      return stats.rates.k7;
    case "bb7":
      return stats.rates.bb7;
    case "h7":
      return stats.rates.h7;
    case "hr7":
      return stats.rates.hr7;
    case "kPct":
      return stats.rates.kPct;
    case "bbPct":
      return stats.rates.bbPct;
    case "strikePct":
      return stats.rates.strikePct ?? undefined;
    case "fpsPct":
      return stats.rates.fpsPct ?? undefined;
    case "pPa":
      return stats.rates.pPa ?? undefined;
    default:
      return undefined;
  }
}

function getSortValue(stats: PitchingStats | undefined, key: PitchSortKey): number {
  if (key === "name") return 0;
  if (!stats) return key === "ip" ? -1 : 0;
  if (key === "ip") return stats.ip;
  const n = getPitchingStatValue(stats, key);
  return n ?? -1;
}

function displayCell(stats: PitchingStats | undefined, key: PitchSortKey, format: ColFormat): string {
  if (!stats) return "—";
  if (key === "name") return "";
  if (key === "ip") return stats.ipDisplay;
  if (format === "era") {
    const v = getPitchingStatValue(stats, key);
    if (v === undefined) return "—";
    if ((key === "era" || key === "fip" || key === "whip") && stats.ip <= 0) return "—";
    return formatEraLike(v);
  }
  if (format === "rate7") {
    const v = getPitchingStatValue(stats, key);
    if (v === undefined) return "—";
    if (OVERALL_PER7.includes(key) && stats.ip <= 0) return "—";
    return formatEraLike(v);
  }
  if (format === "pct") {
    const v = getPitchingStatValue(stats, key);
    if (v === undefined) return "—";
    return `${(v * 100).toFixed(1)}%`;
  }
  if (format === "pPa") {
    const p = stats.rates.pPa;
    if (p == null || Number.isNaN(p)) return "—";
    return formatPPa(p);
  }
  const n = getPitchingStatValue(stats, key);
  if (n === undefined) return "—";
  return String(n);
}

function LeaderStat({ children, show }: { children: ReactNode; show: boolean }) {
  return show ? <span className="font-bold italic">{children}</span> : <>{children}</>;
}

function isLeaderMatch(key: PitchSortKey, val: number | undefined, best: number | undefined): boolean {
  if (val === undefined || best === undefined) return false;
  if (Number.isNaN(val) || Number.isNaN(best)) return false;
  return Math.abs(val - best) <= 1e-6;
}

/** Opponent + batter (opposition hitter) filters — mirrors batting sheet Opponent / Pitcher. */
export interface PitchingMatchupToolbarConfig {
  opponents: { key: string; label: string }[];
  battersByOpponent: Record<string, { id: string; name: string }[]>;
  opponentKey: string;
  batterId: string;
  onOpponentChange: (opponentKey: string) => void;
  onBatterChange: (batterId: string) => void;
}

export interface PitchingStatsSheetProps {
  players?: Player[];
  pitchingStatsWithSplits?: Record<string, PitchingStatsWithSplits>;
  heading?: string;
  subheading?: string;
  toolbarEnd?: ReactNode;
  matchupToolbar?: PitchingMatchupToolbarConfig;
  /** When true (e.g. specific batter selected), platoon split resets to Overall and is disabled. */
  splitDisabled?: boolean;
}

export function PitchingStatsSheet({
  players = [],
  pitchingStatsWithSplits = {},
  heading,
  subheading,
  toolbarEnd,
  matchupToolbar,
  splitDisabled = false,
}: PitchingStatsSheetProps) {
  const [search, setSearch] = useState("");
  const [splitView, setSplitView] = useState<PitchingSplitView>("overall");

  useEffect(() => {
    if (splitDisabled && splitView !== "overall") setSplitView("overall");
  }, [splitDisabled, splitView]);
  const [sortKey, setSortKey] = useState<PitchSortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const initialPitchingStats = useMemo(() => {
    const out: Record<string, PitchingStats> = {};
    for (const p of players) {
      const s = getPitchingStatsForSplit(pitchingStatsWithSplits, p.id, splitView);
      if (s) out[p.id] = s;
    }
    return out;
  }, [players, pitchingStatsWithSplits, splitView]);

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
      const sa = initialPitchingStats[a.id];
      const sb = initialPitchingStats[b.id];
      const va = getSortValue(sa, sortKey);
      const vb = getSortValue(sb, sortKey);
      const cmp = va - vb;
      const diff = sortDir === "asc" ? cmp : -cmp;
      if (diff !== 0) return diff;
      return comparePlayersByLastNameThenFull(a, b);
    });
  }, [filtered, initialPitchingStats, sortKey, sortDir]);

  const teamColumnBest = useMemo(() => {
    const keys = COLUMNS.filter((c) => c.key !== "name").map((c) => c.key);
    const best: Partial<Record<PitchSortKey, number>> = {};
    for (const key of keys) {
      const vals: number[] = [];
      for (const p of filtered) {
        const s = initialPitchingStats[p.id];
        const n = getPitchingStatValue(s, key);
        if (n === undefined || Number.isNaN(n)) continue;
        if ((key === "era" || key === "fip" || key === "whip") && s && s.ip <= 0) continue;
        if (OVERALL_PER7.includes(key) && s && s.ip <= 0) continue;
        vals.push(n);
      }
      if (vals.length === 0) continue;
      if (HIGHER_BETTER.has(key)) {
        best[key] = Math.max(...vals);
      } else if (LOWER_BETTER.has(key)) {
        best[key] = Math.min(...vals);
      } else {
        best[key] = Math.max(...vals);
      }
    }
    return best;
  }, [filtered, initialPitchingStats]);

  const handleSort = (key: PitchSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      if (key === "name") {
        setSortDir("asc");
      } else if (HIGHER_BETTER.has(key)) {
        setSortDir("desc");
      } else {
        setSortDir(LOWER_BETTER.has(key) ? "asc" : "desc");
      }
    }
  };

  const isL = (key: PitchSortKey, s: PitchingStats | undefined) => {
    if (key === "name") return false;
    const val = getPitchingStatValue(s, key);
    const b = teamColumnBest[key];
    if (val === undefined || b === undefined) return false;
    if ((key === "era" || key === "fip" || key === "whip") && s && s.ip <= 0) return false;
    if (OVERALL_PER7.includes(key) && s && s.ip <= 0) return false;
    return isLeaderMatch(key, val, b);
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
              onChange={(e) => setSplitView(e.target.value as PitchingSplitView)}
              disabled={splitDisabled}
              title={
                splitDisabled
                  ? "Platoon split is off while a specific batter is selected."
                  : undefined
              }
              className="max-w-[11rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Pitching split view"
            >
              <option value="overall">Overall</option>
              <option value="vsLHB">vs LHB</option>
              <option value="vsRHB">vs RHB</option>
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
                    matchupToolbar.onBatterChange("");
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
                <span className="shrink-0">Batter</span>
                <select
                  value={matchupToolbar.batterId}
                  onChange={(e) => matchupToolbar.onBatterChange(e.target.value)}
                  disabled={!matchupToolbar.opponentKey}
                  className="min-w-0 max-w-[14rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Filter by opposing batter"
                >
                  <option value="">{matchupToolbar.opponentKey ? "All batters" : "Select opponent"}</option>
                  {(matchupToolbar.battersByOpponent[matchupToolbar.opponentKey] ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
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
                title={PITCHING_STAT_HEADER_TOOLTIPS.rank}
              >
                #
              </th>
              <th
                title={COLUMNS[0].tooltip}
                className={`font-display border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] ${STICKY_LEAD.player} ${COLUMNS[0].align === "right" ? "text-right" : "text-left"} cursor-pointer select-none hover:text-[var(--text)] ${sortKey === COLUMNS[0].key ? "text-[var(--accent)]" : ""}`}
                onClick={() => handleSort(COLUMNS[0].key)}
              >
                {COLUMNS[0].label}
                {sortKey === COLUMNS[0].key && (
                  <span className="ml-1 text-[var(--accent)]" aria-hidden>
                    {sortDir === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </th>
              <th
                title={PITCHING_STAT_HEADER_TOOLTIPS.throws}
                className={`font-display border-b border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] ${STICKY_LEAD.throws}`}
              >
                T
              </th>
              {COLUMNS.slice(1).map(({ key, label, align, tooltip, borderLeft }, idx) => (
                <th
                  key={key}
                  title={tooltip}
                  className={`border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] ${SCROLL_CELL_Z} ${borderLeft ? "border-l border-[var(--border)]" : idx === 0 ? "border-l border-[var(--border)]" : ""} ${align === "right" ? "text-right" : "text-left"} cursor-pointer select-none hover:text-[var(--text)] ${sortKey === key ? "text-[var(--accent)]" : ""}`}
                  onClick={() => handleSort(key)}
                >
                  {label}
                  {sortKey === key && (
                    <span className="ml-1 text-[var(--accent)]" aria-hidden>
                      {sortDir === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((player, index) => {
              const s = initialPitchingStats[player.id];
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
                    className={`${STICKY_LEAD.throws} px-2 py-2 text-center text-[var(--text)] ${stickyLeadRowBg(selectedPlayerId === player.id, index)}`}
                  >
                    {player.throws != null ? THROWS_LABEL[player.throws] ?? player.throws : "—"}
                  </td>
                  {COLUMNS.slice(1).map((col, idx) => (
                    <td
                      key={col.key}
                      className={`${SCROLL_CELL_Z} px-3 py-2 text-right tabular-nums text-[var(--text)] ${col.borderLeft ? "border-l border-[var(--border)]" : idx === 0 ? "border-l border-[var(--border)]" : ""}`}
                    >
                      <LeaderStat show={isL(col.key, s)}>{displayCell(s, col.key, col.format)}</LeaderStat>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && (
        <p className="py-8 text-center text-sm text-[var(--text-muted)]">
          {search.trim() ? "No pitchers match your search." : "No pitchers on roster."}
        </p>
      )}
    </div>
  );
}
