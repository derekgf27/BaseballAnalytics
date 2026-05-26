"use client";

import { useMemo, useState } from "react";
import { PitchTypeBaaTable } from "@/components/analyst/PitchTypeBaaTable";
import { BATTING_STAT_HEADER_TOOLTIPS } from "@/lib/statHeaderTooltips";
import { FINAL_COUNT_BUCKET_OPTIONS } from "@/components/analyst/battingStatsSheetModel";
import {
  PITCHING_COMPARE_STANDARD_COLUMNS,
  formatPitchingCompareCell,
  pitchingCompareStatBorderLeft,
  type PitchCompareColumnDef,
} from "@/components/analyst/pitchingStatsSheetModel";
import type { BattingFinalCountBucketKey, PitchingStats, PitchingStatsWithSplits } from "@/lib/types";

type PitchingProfilePlatoon = "overall" | "vsLHB" | "vsRHB";

/** True when the pitcher has logged at least one game or inning. */
export function hasPitchingProfileStats(splits: PitchingStatsWithSplits | null): boolean {
  if (!splits) return false;
  const o = splits.overall;
  return o.g > 0 || o.ip > 0;
}

export function PlayerPitchingProfileSections({
  pitchingSplits,
}: {
  pitchingSplits: PitchingStatsWithSplits;
}) {
  const [finalCountBucket, setFinalCountBucket] = useState<BattingFinalCountBucketKey | null>(null);
  const [baaPlatoon, setBaaPlatoon] = useState<PitchingProfilePlatoon>("overall");
  const dataCols = PITCHING_COMPARE_STANDARD_COLUMNS;
  const thAlign = "text-right";
  const overall = pitchingSplits.overall;
  const seasonLineStats =
    finalCountBucket != null
      ? pitchingSplits.statsByFinalCount?.overall?.[finalCountBucket] ?? undefined
      : overall;

  const statBorderLeft = (key: PitchCompareColumnDef["key"]) => pitchingCompareStatBorderLeft(key);

  const splitRows: {
    label: string;
    s: PitchingStats | null | undefined;
    countLine: Partial<Record<BattingFinalCountBucketKey, PitchingStats | null>> | undefined;
  }[] = [
    { label: "vs LHB", s: pitchingSplits.vsLHB, countLine: pitchingSplits.statsByFinalCount?.vsLHB },
    { label: "vs RHB", s: pitchingSplits.vsRHB, countLine: pitchingSplits.statsByFinalCount?.vsRHB },
    {
      label: "RISP",
      s: pitchingSplits.runnerSituations?.risp?.combined,
      countLine: undefined,
    },
  ];

  const baaSampleStats = useMemo(() => {
    if (baaPlatoon === "vsLHB") return pitchingSplits.vsLHB ?? pitchingSplits.overall;
    if (baaPlatoon === "vsRHB") return pitchingSplits.vsRHB ?? pitchingSplits.overall;
    return pitchingSplits.overall;
  }, [pitchingSplits, baaPlatoon]);

  return (
    <>
      <section className="card-tech rounded-lg border border-[var(--border)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Season line</h2>
          <label className="flex min-w-0 items-center gap-2 text-sm text-white">
            <span className="shrink-0">Final count</span>
            <select
              value={finalCountBucket ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setFinalCountBucket(v === "" ? null : (v as BattingFinalCountBucketKey));
              }}
              className="max-w-[7.5rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
              aria-label="Filter season line and splits to PAs ending at this final count"
            >
              <option value="">All PAs</option>
              {FINAL_COUNT_BUCKET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {dataCols.map((col) => (
                  <th
                    key={col.key}
                    title={col.tooltip}
                    className={`py-2 px-3 text-xs font-semibold uppercase tracking-wider text-[var(--accent)] ${thAlign}${
                      statBorderLeft(col.key) ? " border-l border-[var(--border)]" : ""
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--border)] last:border-0">
                {dataCols.map((col) => (
                  <td
                    key={col.key}
                    className={`py-2 px-3 tabular-nums text-[var(--text)] ${thAlign}${
                      statBorderLeft(col.key) ? " border-l border-[var(--border)]" : ""
                    }`}
                  >
                    {formatPitchingCompareCell(col, seasonLineStats ?? undefined)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <PitchTypeBaaTable
        rates={baaSampleStats.rates}
        showAllPitchTypes
        platoonControl={
          <label className="flex min-w-0 items-center gap-2 text-sm text-white">
            <span className="shrink-0 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Split</span>
            <select
              value={baaPlatoon}
              onChange={(e) => setBaaPlatoon(e.target.value as PitchingProfilePlatoon)}
              className="max-w-[8rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
              aria-label="Platoon split for BAA by pitch type"
            >
              <option value="overall">Overall</option>
              <option value="vsLHB">vs LHB</option>
              <option value="vsRHB">vs RHB</option>
            </select>
          </label>
        }
      />

      <div className="card-tech rounded-lg border border-[var(--border)] p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Pitching splits</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th
                  title={BATTING_STAT_HEADER_TOOLTIPS.split}
                  className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-[var(--accent)]"
                >
                  Split
                </th>
                {dataCols.map((col) => (
                  <th
                    key={col.key}
                    title={col.tooltip}
                    className={`py-2 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)] ${thAlign}${
                      statBorderLeft(col.key) ? " border-l border-[var(--border)]" : ""
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {splitRows.map(({ label, s, countLine }) => {
                const splitLine =
                  finalCountBucket != null && countLine
                    ? countLine[finalCountBucket] ?? undefined
                    : s ?? undefined;
                return (
                  <tr key={label} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 pr-4 font-medium text-[var(--text)]">{label}</td>
                    {s || (finalCountBucket != null && countLine) ? (
                      dataCols.map((col) => (
                        <td
                          key={col.key}
                          className={`py-2 px-2 tabular-nums text-[var(--text)] ${thAlign}${
                            statBorderLeft(col.key) ? " border-l border-[var(--border)]" : ""
                          }`}
                        >
                          {formatPitchingCompareCell(col, splitLine ?? undefined)}
                        </td>
                      ))
                    ) : (
                      <td colSpan={dataCols.length} className="py-2 px-2 text-right italic text-[var(--text-faint)]">
                        No PAs
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
