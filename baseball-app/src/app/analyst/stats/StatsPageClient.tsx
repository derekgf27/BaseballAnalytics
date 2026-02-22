"use client";

import { useState, useMemo, Fragment } from "react";
import Link from "next/link";
import type { BattingStats, BattingStatsWithSplits, Player } from "@/lib/types";

export type SplitView = "overall" | "vsL" | "vsR";

const BATS_LABEL: Record<string, string> = { L: "L", R: "R", S: "S" };

type SortKey =
  | "name"
  | "pa"
  | "ab"
  | "h"
  | "double"
  | "triple"
  | "hr"
  | "rbi"
  | "r"
  | "sb"
  | "bb"
  | "ibb"
  | "hbp"
  | "so"
  | "kPct"
  | "bbPct"
  | "avg"
  | "obp"
  | "slg"
  | "ops"
  | "opsPlus"
  | "woba";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" | "center"; format: "name" | "int" | "avg" | "pct" }[] = [
  { key: "name", label: "Player", align: "left", format: "name" },
  { key: "pa", label: "PA", align: "right", format: "int" },
  { key: "ab", label: "AB", align: "right", format: "int" },
  { key: "h", label: "H", align: "right", format: "int" },
  { key: "double", label: "2B", align: "right", format: "int" },
  { key: "triple", label: "3B", align: "right", format: "int" },
  { key: "hr", label: "HR", align: "right", format: "int" },
  { key: "rbi", label: "RBI", align: "right", format: "int" },
  { key: "r", label: "R", align: "right", format: "int" },
  { key: "sb", label: "SB", align: "right", format: "int" },
  { key: "bb", label: "BB", align: "right", format: "int" },
  { key: "ibb", label: "IBB", align: "right", format: "int" },
  { key: "hbp", label: "HBP", align: "right", format: "int" },
  { key: "so", label: "SO", align: "right", format: "int" },
  { key: "kPct", label: "K%", align: "right", format: "pct" },
  { key: "bbPct", label: "BB%", align: "right", format: "pct" },
  { key: "avg", label: "AVG", align: "right", format: "avg" },
  { key: "obp", label: "OBP", align: "right", format: "avg" },
  { key: "slg", label: "SLG", align: "right", format: "avg" },
  { key: "ops", label: "OPS", align: "right", format: "avg" },
  { key: "opsPlus", label: "OPS+", align: "right", format: "int" },
  { key: "woba", label: "wOBA", align: "right", format: "avg" },
];

function formatStat(value: number | undefined, format: "int" | "avg" | "pct"): string {
  if (value === undefined) return "—";
  if (format === "int") return String(value);
  if (format === "pct") return `${(value * 100).toFixed(1)}%`;
  return value.toFixed(3);
}

function getStatValue(
  player: Player,
  stats: BattingStats | undefined,
  key: SortKey
): string | number | undefined {
  if (key === "name") return player.name;
  if (!stats) {
    if (key === "pa" || key === "ab" || key === "h" || key === "double" || key === "triple" || key === "hr" || key === "rbi" || key === "r" || key === "sb" || key === "bb" || key === "ibb" || key === "hbp" || key === "so" || key === "kPct" || key === "bbPct") return 0;
    return undefined;
  }
  const v = stats[key as keyof BattingStats];
  return typeof v === "number" ? v : undefined;
}

interface StatsPageClientProps {
  initialPlayers: Player[];
  initialBattingStatsWithSplits: Record<string, BattingStatsWithSplits>;
}

function getStatsForSplit(splits: Record<string, BattingStatsWithSplits>, playerId: string, split: SplitView): BattingStats | undefined {
  const s = splits[playerId];
  if (!s) return undefined;
  if (split === "overall") return s.overall;
  if (split === "vsL") return s.vsL ?? undefined;
  return s.vsR ?? undefined;
}

export function StatsPageClient({ initialPlayers, initialBattingStatsWithSplits }: StatsPageClientProps) {
  const [search, setSearch] = useState("");
  const [splitView, setSplitView] = useState<SplitView>("overall");
  const [sortKey, setSortKey] = useState<SortKey>("pa");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const initialBattingStats = useMemo(() => {
    const out: Record<string, BattingStats> = {};
    for (const p of initialPlayers) {
      const s = getStatsForSplit(initialBattingStatsWithSplits, p.id, splitView);
      if (s) out[p.id] = s;
    }
    return out;
  }, [initialPlayers, initialBattingStatsWithSplits, splitView]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialPlayers;
    return initialPlayers.filter((p) => p.name.toLowerCase().includes(q));
  }, [initialPlayers, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const sa = getStatValue(a, initialBattingStats[a.id], sortKey);
      const sb = getStatValue(b, initialBattingStats[b.id], sortKey);
      const aNum = typeof sa === "number" ? sa : sa === undefined ? (sortKey === "name" ? "" : -1) : String(sa).toLowerCase();
      const bNum = typeof sb === "number" ? sb : sb === undefined ? (sortKey === "name" ? "" : -1) : String(sb).toLowerCase();
      if (sortKey === "name") {
        const cmp = String(aNum).localeCompare(String(bNum));
        return sortDir === "asc" ? cmp : -cmp;
      }
      const na = Number(aNum);
      const nb = Number(bNum);
      const cmp = na - nb;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, initialBattingStats, sortKey, sortDir]);

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
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">Batting stats</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {splitView === "overall"
            ? "All players, derived from plate appearances. Sort by clicking column headers."
            : splitView === "vsL"
              ? "Stats when batter faced a left-handed pitcher (record pitcher hand when recording PAs)."
              : "Stats when batter faced a right-handed pitcher (record pitcher hand when recording PAs)."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <span>Split</span>
          <select
            value={splitView}
            onChange={(e) => setSplitView(e.target.value as SplitView)}
            className="rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            aria-label="Batting split view"
          >
            <option value="overall">Overall</option>
            <option value="vsL">vs LHP</option>
            <option value="vsR">vs RHP</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <span>Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Player name…"
            className="rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-[var(--bg-elevated)]">
              <th className="border-b border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                #
              </th>
              {COLUMNS.map(({ key, label, align }, idx) => (
                <Fragment key={key + String(idx)}>
                  <th
                    className={`border-b border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] ${
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
                    <>
                      <th className="border-b border-[var(--border)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        POS
                      </th>
                      <th className="border-b border-[var(--border)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Bats
                      </th>
                    </>
                  )}
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((player, index) => {
              const s = initialBattingStats[player.id];
              const pos = player.positions?.[0] ?? "—";
              const bats = player.bats != null ? BATS_LABEL[player.bats] ?? player.bats : "—";
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
                  className={`cursor-pointer border-b border-[var(--border)] last:border-0 transition-colors ${
                    selectedPlayerId === player.id
                      ? "bg-[var(--accent-dim)]"
                      : index % 2 === 0
                        ? "bg-[var(--bg-base)] hover:bg-[var(--accent-dim)]"
                        : "bg-[var(--bg-elevated)] hover:bg-[var(--accent-dim)]"
                  }`}
                >
                  <td className="px-3 py-2 text-center text-[var(--text-muted)] tabular-nums">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2 font-medium text-[var(--text)]">
                    <Link
                      href={`/analyst/players/${player.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[var(--accent)] hover:underline"
                    >
                      {player.name}
                      {player.jersey && (
                        <span className="ml-1 text-[var(--text-muted)]">#{player.jersey}</span>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-center text-[var(--text)]">
                    {player.positions?.[0] ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-center text-[var(--text)] tabular-nums">
                    {player.bats != null ? BATS_LABEL[player.bats] ?? player.bats : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s?.pa ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s?.ab ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s?.h ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s?.double ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s?.triple ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s?.hr ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s?.rbi ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s?.r ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s?.sb ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s?.bb ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s?.ibb ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s?.hbp ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s?.so ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s ? formatStat(s.kPct, "pct") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s ? formatStat(s.bbPct, "pct") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s ? formatStat(s.avg, "avg") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s ? formatStat(s.obp, "avg") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s ? formatStat(s.slg, "avg") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s ? formatStat(s.ops, "avg") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s ? formatStat(s.opsPlus, "int") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                    {s ? formatStat(s.woba, "avg") : "—"}
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
