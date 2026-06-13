"use client";

import { useMemo, type ReactNode } from "react";
import {
  BAT_PITCH_TYPE_STATS_HELPER_TEXT,
  buildBattingPitchTypeRows,
  buildBattingPitchTypeRowsVisible,
  formatBattingPitchTypeAvg,
  formatPitchTypeMix,
  formatPitchTypePct,
  formatPitchTypeRate,
  type BattingPitchTypeRow,
} from "@/lib/pitchTypeBattingDisplay";
import type { BattingStats } from "@/lib/types";

type BattingPitchTypeTableProps = {
  stats: BattingStats;
  sampleLabel?: string;
  platoonControl?: ReactNode;
  showAllPitchTypes?: boolean;
  className?: string;
};

const TH =
  "whitespace-nowrap py-2 px-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]";
const TH_GROUP =
  "whitespace-nowrap py-1.5 px-2 text-center text-[9px] font-semibold uppercase tracking-widest text-[var(--text-faint)]";

export function BattingPitchTypeTable({
  stats,
  sampleLabel,
  platoonControl,
  showAllPitchTypes = false,
  className = "",
}: BattingPitchTypeTableProps) {
  const rows = useMemo(
    () => (showAllPitchTypes ? buildBattingPitchTypeRows(stats) : buildBattingPitchTypeRowsVisible(stats)),
    [stats, showAllPitchTypes]
  );
  const typed = stats.batTyped ?? 0;

  if (!showAllPitchTypes && typed <= 0 && rows.length === 0) {
    return (
      <section className={`card-tech rounded-lg border border-[var(--border)] p-4 ${className}`}>
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
          Results vs pitch type
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          No pitches with a logged pitch type in this sample. Tag pitch types on Record or the coach pad to build
          this table.
        </p>
      </section>
    );
  }

  return (
    <section className={`card-tech rounded-lg border border-[var(--border)] p-4 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
          Results vs pitch type
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {sampleLabel ? (
            <span className="text-xs font-medium text-[var(--accent)]">{sampleLabel}</span>
          ) : null}
          {platoonControl}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-[var(--text-muted)]">{BAT_PITCH_TYPE_STATS_HELPER_TEXT}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-max min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th rowSpan={2} className={`${TH} !text-left pr-3 align-bottom`}>
                Pitch
              </th>
              <th colSpan={3} className={`${TH_GROUP} border-l border-[var(--border)]`}>
                Seen
              </th>
              <th colSpan={10} className={`${TH_GROUP} border-l border-[var(--border)]`}>
                Results (PA ends on pitch)
              </th>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <th className={`${TH} border-l border-[var(--border)]`}>Mix</th>
              <th className={TH}>1st%</th>
              <th className={TH}>PA end%</th>
              <th className={`${TH} border-l border-[var(--border)]`}>AB</th>
              <th className={TH}>H</th>
              <th className={TH}>AVG</th>
              <th className={TH}>OBP</th>
              <th className={TH}>OPS</th>
              <th className={TH}>K%</th>
              <th className={TH}>BB%</th>
              <th className={TH}>HR%</th>
              <th className={TH}>SLG</th>
              <th className={TH}>ISO</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <ResultsRowTr key={row.key} row={row} dimUnused={typed > 0 && !row.hasTypedPitches} />
            ))}
          </tbody>
        </table>
      </div>
      {typed > 0 ? (
        <p className="mt-2 text-[11px] text-[var(--text-faint)]">
          {typed.toLocaleString()} typed pitch{typed === 1 ? "" : "es"} seen in sample.
        </p>
      ) : showAllPitchTypes ? (
        <p className="mt-2 text-[11px] text-[var(--text-faint)]">
          No pitches with a logged pitch type in this sample. Tag pitch types on Record or the coach pad to fill in
          rates.
        </p>
      ) : null}
    </section>
  );
}

function ResultsRowTr({ row, dimUnused }: { row: BattingPitchTypeRow; dimUnused: boolean }) {
  const muted = dimUnused ? "text-[var(--text-faint)]" : "text-[var(--text)]";
  const td = `whitespace-nowrap py-2 px-2 text-right tabular-nums ${muted}`;
  const tdBorder = `${td} border-l border-[var(--border)]`;
  return (
    <tr className={`border-b border-[var(--border)] last:border-0 ${dimUnused ? "opacity-50" : ""}`}>
      <td className={`py-2 pr-3 font-medium ${muted}`}>{row.label}</td>
      <td className={tdBorder}>{formatPitchTypeMix(row.mix)}</td>
      <td className={td}>{formatPitchTypeMix(row.firstPitchMix)}</td>
      <td className={td}>{formatPitchTypeMix(row.paEndPct)}</td>
      <td className={tdBorder}>{row.ab ?? "—"}</td>
      <td className={td}>{row.h ?? "—"}</td>
      <td className={`${td} font-medium`}>{formatBattingPitchTypeAvg(row.avg)}</td>
      <td className={td}>{formatBattingPitchTypeAvg(row.obp)}</td>
      <td className={td}>{formatPitchTypeRate(row.ops)}</td>
      <td className={td}>{formatPitchTypePct(row.kPct)}</td>
      <td className={td}>{formatPitchTypePct(row.bbPct)}</td>
      <td className={td}>{formatPitchTypePct(row.hrPct)}</td>
      <td className={td}>{formatPitchTypeRate(row.slg)}</td>
      <td className={td}>{formatPitchTypeRate(row.iso)}</td>
    </tr>
  );
}
