"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { comparePlayersByLastNameThenFull } from "@/lib/playerSort";
import { buildBattingPitchTypeTeamRows } from "@/lib/battingPitchTypeTeamRows";
import { mergePitchTypeTeamProfileFromBattingLines } from "@/lib/compute/pitchTypeProfileFromPas";
import {
  BAT_PITCH_TYPE_DISCIPLINE_HELPER_TEXT,
  BAT_PITCH_TYPE_SHEET_SUFFIXES,
  battingPitchTypeDisciplineRate,
  formatPitchTypePct,
  visibleBatPitchTypeBuckets,
  type BatPitchTypeDisciplineFieldKey,
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

type BatDisciplineSortKey =
  | "name"
  | "batTyped"
  | `sw:${PitchTypeBucketKey}`
  | `wh:${PitchTypeBucketKey}`
  | `foul:${PitchTypeBucketKey}`
  | `gb:${PitchTypeBucketKey}`
  | `ld:${PitchTypeBucketKey}`
  | `fb:${PitchTypeBucketKey}`
  | `iff:${PitchTypeBucketKey}`;

export type BattingPitchTypeDisciplineTeamSheetProps = {
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
};

const STICKY_LEAD = {
  rank: "sticky left-0 z-[100] isolate [transform:translateZ(0)] w-12 min-w-[3rem] shrink-0",
  player:
    "sticky left-12 z-[100] isolate [transform:translateZ(0)] w-[12rem] min-w-[12rem] max-w-[12rem] shrink-0 shadow-[2px_0_0_0_var(--border)]",
} as const;

const TH =
  "whitespace-nowrap py-2 px-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]";

const DISCIPLINE_FIELDS: { prefix: string; field: BatPitchTypeDisciplineFieldKey; label: string }[] = [
  { prefix: "sw", field: "swingPct", label: "Sw%" },
  { prefix: "wh", field: "whiffPct", label: "Whiff%" },
  { prefix: "foul", field: "foulPct", label: "Foul%" },
  { prefix: "gb", field: "gbPct", label: "GB%" },
  { prefix: "ld", field: "ldPct", label: "LD%" },
  { prefix: "fb", field: "fbPct", label: "FB%" },
  { prefix: "iff", field: "iffPct", label: "IFF%" },
];

function sortValue(line: BattingStats | undefined, key: BatDisciplineSortKey): number | string {
  if (key === "name") return "";
  if (!line) return Number.NEGATIVE_INFINITY;
  if (key === "batTyped") return line.batTyped ?? 0;
  const [kind, bucket] = key.split(":") as [string, PitchTypeBucketKey];
  const field = DISCIPLINE_FIELDS.find((d) => d.prefix === kind)?.field;
  if (!field) return Number.NEGATIVE_INFINITY;
  return battingPitchTypeDisciplineRate(line, bucket, field) ?? Number.NEGATIVE_INFINITY;
}

function stickyLeadRowBg(index: number): string {
  const isEven = index % 2 === 0;
  const baseSolid = isEven ? "bg-[var(--bg-base)]" : "bg-[var(--bg-elevated)]";
  return `${baseSolid} group-hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--bg-base))]`;
}

export function BattingPitchTypeDisciplineTeamSheet({
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
}: BattingPitchTypeDisciplineTeamSheetProps) {
  const [sortKey, setSortKey] = useState<BatDisciplineSortKey>("batTyped");
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
    list.sort((a, b) => {
      if (sortKey === "name") return comparePlayersByLastNameThenFull(a.player, b.player);
      const av = sortValue(a.line, sortKey);
      const bv = sortValue(b.line, sortKey);
      if (typeof av === "number" && typeof bv === "number") {
        const cmp = av - bv;
        if (cmp === 0) return comparePlayersByLastNameThenFull(a.player, b.player);
        return sortDesc ? -cmp : cmp;
      }
      return 0;
    });
    return list;
  }, [players, battingStatsWithSplits, pas, pitchEvents, games, splitView, venueFilter, runnersFilter, countState, searchQuery, sortKey, sortDesc]);

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

  const toggleSort = (key: BatDisciplineSortKey) => {
    if (sortKey === key) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(key !== "name");
    }
  };

  const sortIndicator = (key: BatDisciplineSortKey) => (sortKey === key ? (sortDesc ? " ↓" : " ↑") : "");

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
    return DISCIPLINE_FIELDS.map(({ prefix, field, label }) => ({
      key: `${prefix}:${bucket}` as BatDisciplineSortKey,
      label: `${def.abbrev} ${label}`,
      bucket,
      field,
      isGroupStart: prefix === "sw",
    }));
  });

  return (
    <div className="space-y-2">
      <p className="text-xs leading-snug text-[var(--text-muted)]">
        {countState != null
          ? `${BAT_PITCH_TYPE_DISCIPLINE_HELPER_TEXT} Discipline rates use pitches seen at the selected count state; BIP mix uses the full sample (clear count to align).`
          : BAT_PITCH_TYPE_DISCIPLINE_HELPER_TEXT}
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
                  className={`${TH} ${col.isGroupStart ? "border-l border-[var(--border)]" : ""} cursor-pointer`}
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
              <tr key={player.id} className="group border-b border-[var(--border)]">
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
                  <DisciplineCell key={`${player.id}-${col.key}`} line={line} col={col} />
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
                  <DisciplineCell key={`team-${col.key}`} line={teamLine} col={col} bold />
                ))}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DisciplineCell({
  line,
  col,
  bold = false,
}: {
  line: BattingStats | undefined;
  col: {
    bucket: PitchTypeBucketKey;
    field: BatPitchTypeDisciplineFieldKey;
    isGroupStart: boolean;
  };
  bold?: boolean;
}) {
  const text = line ? formatPitchTypePct(battingPitchTypeDisciplineRate(line, col.bucket, col.field)) : "—";
  const border = col.isGroupStart ? "border-l border-[var(--border)]" : "";
  return (
    <td className={`py-2 px-2 text-right tabular-nums ${border} ${bold ? "bg-[var(--bg-elevated)]" : ""}`}>
      {text}
    </td>
  );
}
