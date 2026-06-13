"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { comparePlayersByLastNameThenFull } from "@/lib/playerSort";
import { buildBattingPitchTypeTeamRows } from "@/lib/battingPitchTypeTeamRows";
import { mergePitchTypeTeamProfileFromBattingLines } from "@/lib/compute/pitchTypeProfileFromPas";
import {
  BAT_PITCH_TYPE_SHEET_SUFFIXES,
  BAT_PITCH_TYPE_STATS_HELPER_TEXT,
  battingPitchTypeAvg,
  battingPitchTypeProfileRate,
  formatBattingPitchTypeAvg,
  formatPitchTypeMix,
  formatPitchTypePct,
  visibleBatPitchTypeBuckets,
} from "@/lib/pitchTypeBattingDisplay";
import type {
  BattingFinalCountBucketKey,
  BattingStats,
  BattingStatsWithSplits,
  Game,
  PitchEvent,
  PitchTypeBucketKey,
  PlateAppearance,
  Player,
  StatsRunnersFilterKey,
} from "@/lib/types";
import type { SplitView } from "@/components/analyst/BattingStatsSheet";
import type { StatsVenueFilter } from "@/lib/statsVenueFilter";

type BatPitchTypeSortKey = "name" | "batTyped" | `mix:${PitchTypeBucketKey}` | `avg:${PitchTypeBucketKey}` | `k:${PitchTypeBucketKey}`;

export type BattingPitchTypeTeamSheetProps = {
  players: Player[];
  battingStatsWithSplits: Record<string, BattingStatsWithSplits>;
  pas?: PlateAppearance[];
  pitchEvents?: PitchEvent[];
  games?: Pick<Game, "id" | "our_side">[];
  splitView: SplitView;
  venueFilter?: StatsVenueFilter;
  runnersFilter: StatsRunnersFilterKey;
  countState: BattingFinalCountBucketKey | null;
  searchQuery?: string;
  playerProfileHref?: (playerId: string) => string;
  splitDisabled?: boolean;
};

const STICKY_LEAD = {
  rank: "sticky left-0 z-[100] isolate [transform:translateZ(0)] w-12 min-w-[3rem] shrink-0",
  player:
    "sticky left-12 z-[100] isolate [transform:translateZ(0)] w-[12rem] min-w-[12rem] max-w-[12rem] shrink-0 shadow-[2px_0_0_0_var(--border)]",
} as const;

const TH =
  "whitespace-nowrap py-2 px-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]";

function sortValue(line: BattingStats | undefined, key: BatPitchTypeSortKey): number | string {
  if (key === "name") return "";
  if (!line) return Number.NEGATIVE_INFINITY;
  if (key === "batTyped") return line.batTyped ?? 0;
  const [kind, bucket] = key.split(":") as [string, PitchTypeBucketKey];
  if (kind === "mix") return battingPitchTypeProfileRate(line, bucket, "mix") ?? Number.NEGATIVE_INFINITY;
  if (kind === "avg") return battingPitchTypeAvg(line, bucket) ?? Number.NEGATIVE_INFINITY;
  if (kind === "k") return battingPitchTypeProfileRate(line, bucket, "kPct") ?? Number.NEGATIVE_INFINITY;
  return Number.NEGATIVE_INFINITY;
}

function stickyLeadRowBg(index: number): string {
  const isEven = index % 2 === 0;
  const baseSolid = isEven ? "bg-[var(--bg-base)]" : "bg-[var(--bg-elevated)]";
  return `${baseSolid} group-hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--bg-base))]`;
}

export function BattingPitchTypeTeamSheet({
  players,
  battingStatsWithSplits,
  pas,
  pitchEvents,
  games,
  splitView,
  venueFilter = "all",
  runnersFilter,
  countState,
  searchQuery = "",
  playerProfileHref,
}: BattingPitchTypeTeamSheetProps) {
  const [sortKey, setSortKey] = useState<BatPitchTypeSortKey>("batTyped");
  const [sortDesc, setSortDesc] = useState(true);

  const rows = useMemo(() => {
    const list = buildBattingPitchTypeTeamRows({
      players,
      battingStatsWithSplits,
      pas,
      pitchEvents,
      games,
      splitView,
      venueFilter,
      runnersFilter,
      countState,
      searchQuery,
    });

    const lowerBetter = sortKey.startsWith("k:");
    list.sort((a, b) => {
      if (sortKey === "name") {
        return comparePlayersByLastNameThenFull(a.player, b.player);
      }
      const av = sortValue(a.line, sortKey);
      const bv = sortValue(b.line, sortKey);
      if (typeof av === "number" && typeof bv === "number") {
        const cmp = av - bv;
        if (cmp === 0) return comparePlayersByLastNameThenFull(a.player, b.player);
        const mult = sortDesc !== lowerBetter ? -1 : 1;
        return cmp * mult;
      }
      return 0;
    });
    return list;
  }, [players, searchQuery, battingStatsWithSplits, splitView, venueFilter, runnersFilter, countState, pas, pitchEvents, games, sortKey, sortDesc]);

  const visibleBuckets = useMemo(
    () => visibleBatPitchTypeBuckets(rows.map((r) => r.line)),
    [rows]
  );

  const teamLine = useMemo(() => {
    const lines = rows.map((r) => r.line);
    if (lines.length === 0) return undefined;
    const target = {
      avg: 0,
      obp: 0,
      slg: 0,
      ops: 0,
      opsPlus: 0,
      woba: 0,
    } as BattingStats;
    mergePitchTypeTeamProfileFromBattingLines(lines, target);
    return target;
  }, [rows]);

  const toggleSort = (key: BatPitchTypeSortKey) => {
    if (sortKey === key) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(key !== "name" && !key.startsWith("k:"));
    }
  };

  const sortIndicator = (key: BatPitchTypeSortKey) => (sortKey === key ? (sortDesc ? " ↓" : " ↑") : "");

  if (rows.every((r) => (r.line?.batTyped ?? 0) <= 0)) {
    return (
      <p className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-6 text-sm text-[var(--text-muted)]">
        No pitches with a logged pitch type in this sample. Tag pitch types on Record or the coach pad to build this
        table.
      </p>
    );
  }

  const typeCols = visibleBuckets.flatMap((bucket) => {
    const def = BAT_PITCH_TYPE_SHEET_SUFFIXES.find((d) => d.bucket === bucket)!;
    return [
      { key: `mix:${bucket}` as BatPitchTypeSortKey, label: `${def.abbrev} Mix`, bucket, field: "mix" as const },
      { key: `avg:${bucket}` as BatPitchTypeSortKey, label: `AVG ${def.abbrev}`, bucket, field: "avg" as const },
      { key: `k:${bucket}` as BatPitchTypeSortKey, label: `K% ${def.abbrev}`, bucket, field: "kPct" as const },
    ];
  });

  return (
    <div className="space-y-2">
      <p className="text-xs leading-snug text-[var(--text-muted)]">
        {countState != null
          ? `${BAT_PITCH_TYPE_STATS_HELPER_TEXT} Mix uses pitches seen at the selected count state; AVG and K% use the full sample when count is cleared.`
          : BAT_PITCH_TYPE_STATS_HELPER_TEXT}
      </p>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
              <th className={`${TH} ${STICKY_LEAD.rank} !text-center`}>#</th>
              <th
                className={`${TH} ${STICKY_LEAD.player} !text-left cursor-pointer`}
                onClick={() => toggleSort("name")}
              >
                Player{sortIndicator("name")}
              </th>
              <th
                className={`${TH} border-l border-[var(--border)] cursor-pointer`}
                onClick={() => toggleSort("batTyped")}
              >
                Typed{sortIndicator("batTyped")}
              </th>
              {typeCols.map((col) => (
                <th
                  key={col.key}
                  className={`${TH} ${col.key.startsWith("mix:") ? "border-l border-[var(--border)]" : ""} cursor-pointer`}
                  onClick={() => toggleSort(col.key)}
                >
                  {col.label}
                  {sortIndicator(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ player, line }, index) => (
              <tr key={player.id} className={`group border-b border-[var(--border)]`}>
                <td
                  className={`py-2 px-2 text-center tabular-nums text-[var(--text-muted)] ${STICKY_LEAD.rank} ${stickyLeadRowBg(index)}`}
                >
                  {index + 1}
                </td>
                <td
                  className={`py-2 px-2 font-medium text-[var(--text)] ${STICKY_LEAD.player} ${stickyLeadRowBg(index)}`}
                >
                  {playerProfileHref ? (
                    <Link href={playerProfileHref(player.id)} className="hover:text-[var(--accent)] hover:underline">
                      {player.name}
                    </Link>
                  ) : (
                    player.name
                  )}
                </td>
                <td className="border-l border-[var(--border)] py-2 px-2 text-right tabular-nums">
                  {line?.batTyped ?? "—"}
                </td>
                {typeCols.map((col) => (
                  <PitchTypeCell key={`${player.id}-${col.key}`} line={line} col={col} />
                ))}
              </tr>
            ))}
            {teamLine ? (
              <tr className="border-t-[3px] border-[color-mix(in_srgb,var(--accent)_85%,var(--border)_15%)] font-semibold">
                <td className={`py-2 px-2 ${STICKY_LEAD.rank} bg-[var(--bg-elevated)]`} />
                <td className={`py-2 px-2 ${STICKY_LEAD.player} bg-[var(--bg-elevated)]`}>Team</td>
                <td className="border-l border-[var(--border)] py-2 px-2 text-right tabular-nums bg-[var(--bg-elevated)]">
                  {teamLine.batTyped ?? "—"}
                </td>
                {typeCols.map((col) => (
                  <PitchTypeCell key={`team-${col.key}`} line={teamLine} col={col} bold />
                ))}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PitchTypeCell({
  line,
  col,
  bold = false,
}: {
  line: BattingStats | undefined;
  col: {
    key: BatPitchTypeSortKey;
    bucket: PitchTypeBucketKey;
    field: "mix" | "avg" | "kPct";
  };
  bold?: boolean;
}) {
  let text: ReactNode = "—";
  if (line) {
    if (col.field === "avg") {
      text = formatBattingPitchTypeAvg(battingPitchTypeAvg(line, col.bucket));
    } else if (col.field === "mix") {
      text = formatPitchTypeMix(battingPitchTypeProfileRate(line, col.bucket, "mix"));
    } else {
      text = formatPitchTypePct(battingPitchTypeProfileRate(line, col.bucket, "kPct"));
    }
  }
  const border = col.key.startsWith("mix:") ? "border-l border-[var(--border)]" : "";
  return (
    <td className={`py-2 px-2 text-right tabular-nums ${border} ${bold ? "bg-[var(--bg-elevated)]" : ""}`}>
      {text}
    </td>
  );
}
