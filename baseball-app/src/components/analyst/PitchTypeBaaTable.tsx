"use client";

import { useMemo, type ReactNode } from "react";
import {
  PITCH_TYPE_STATS_HELPER_TEXT,
  buildPitchTypeBaaRows,
  buildPitchTypeBaaRowsVisible,
  formatPitchTypeBaa,
  formatPitchTypeMix,
  formatPitchTypePct,
  formatPitchTypeRate,
  type PitchTypeBaaRow,
} from "@/lib/pitchTypeBaaDisplay";
import type { PitchingRateLine } from "@/lib/types";

type PitchTypeBaaTableProps = {
  rates: PitchingRateLine;
  sampleLabel?: string;
  platoonControl?: ReactNode;
  showAllPitchTypes?: boolean;
  className?: string;
};

const TH =
  "whitespace-nowrap py-2 px-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]";
const TH_GROUP =
  "whitespace-nowrap py-1.5 px-2 text-center text-[9px] font-semibold uppercase tracking-widest text-[var(--text-faint)]";

export function PitchTypeBaaTable({
  rates,
  sampleLabel,
  platoonControl,
  showAllPitchTypes = false,
  className = "",
}: PitchTypeBaaTableProps) {
  const rows = useMemo(
    () => (showAllPitchTypes ? buildPitchTypeBaaRows(rates) : buildPitchTypeBaaRowsVisible(rates)),
    [rates, showAllPitchTypes]
  );
  const typed = rates.plTyped ?? 0;

  if (!showAllPitchTypes && typed <= 0 && rows.length === 0) {
    return (
      <section className={`card-tech rounded-lg border border-[var(--border)] p-4 ${className}`}>
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Pitch type stats</h2>
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
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Pitch type stats</h2>
        <div className="flex flex-wrap items-center gap-3">
          {sampleLabel ? (
            <span className="text-xs font-medium text-[var(--accent)]">{sampleLabel}</span>
          ) : null}
          {platoonControl}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-[var(--text-muted)]">{PITCH_TYPE_STATS_HELPER_TEXT}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-max min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th rowSpan={2} className={`${TH} !text-left pr-3 align-bottom`}>
                Pitch
              </th>
              <th colSpan={5} className={`${TH_GROUP} border-l border-[var(--border)]`}>
                Usage
              </th>
              <th colSpan={4} className={`${TH_GROUP} border-l border-[var(--border)]`}>
                Command
              </th>
              <th colSpan={4} className={`${TH_GROUP} border-l border-[var(--border)]`}>
                Discipline
              </th>
              <th colSpan={11} className={`${TH_GROUP} border-l border-[var(--border)]`}>
                Results (PA ends on pitch)
              </th>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <th className={`${TH} border-l border-[var(--border)]`}>Mix</th>
              <th className={TH}>1st%</th>
              <th className={TH}>Ahead%</th>
              <th className={TH}>Behind%</th>
              <th className={TH}>PA end%</th>
              <th className={`${TH} border-l border-[var(--border)]`}>Strike%</th>
              <th className={TH}>Ball%</th>
              <th className={TH}>Called%</th>
              <th className={TH}>Foul%</th>
              <th className={`${TH} border-l border-[var(--border)]`}>Sw%</th>
              <th className={TH}>Whiff%</th>
              <th className={TH}>2K Whiff%</th>
              <th className={TH}>Contact%</th>
              <th className={`${TH} border-l border-[var(--border)]`}>AB</th>
              <th className={TH}>H</th>
              <th className={TH}>BAA</th>
              <th className={TH}>K%</th>
              <th className={TH}>BB%</th>
              <th className={TH}>HR%</th>
              <th className={TH}>XBH%</th>
              <th className={TH}>SLG</th>
              <th className={TH}>ISO</th>
              <th className={TH}>GB%</th>
              <th className={TH}>LD%</th>
              <th className={TH}>FB%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PitchTypeBaaRowTr key={row.key} row={row} dimUnused={typed > 0 && !row.hasTypedPitches} />
            ))}
          </tbody>
        </table>
      </div>
      {typed > 0 ? (
        <p className="mt-2 text-[11px] text-[var(--text-faint)]">
          {typed.toLocaleString()} typed pitch{typed === 1 ? "" : "es"} in sample.
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

function PitchTypeBaaRowTr({ row, dimUnused }: { row: PitchTypeBaaRow; dimUnused: boolean }) {
  const muted = dimUnused ? "text-[var(--text-faint)]" : "text-[var(--text)]";
  const td = `whitespace-nowrap py-2 px-2 text-right tabular-nums ${muted}`;
  const tdBorder = `${td} border-l border-[var(--border)]`;
  return (
    <tr className={`border-b border-[var(--border)] last:border-0 ${dimUnused ? "opacity-50" : ""}`}>
      <td className={`py-2 pr-3 font-medium ${muted}`}>{row.label}</td>
      <td className={tdBorder}>{formatPitchTypeMix(row.mix)}</td>
      <td className={td}>{formatPitchTypeMix(row.firstPitchMix)}</td>
      <td className={td}>{formatPitchTypeMix(row.mixAhead)}</td>
      <td className={td}>{formatPitchTypeMix(row.mixBehind)}</td>
      <td className={td}>{formatPitchTypeMix(row.paEndPct)}</td>
      <td className={tdBorder}>{formatPitchTypePct(row.strikePct)}</td>
      <td className={td}>{formatPitchTypePct(row.ballPct)}</td>
      <td className={td}>{formatPitchTypePct(row.calledStrikePct)}</td>
      <td className={td}>{formatPitchTypePct(row.foulPct)}</td>
      <td className={tdBorder}>{formatPitchTypePct(row.swingPct)}</td>
      <td className={td}>{formatPitchTypePct(row.whiffPct)}</td>
      <td className={td}>{formatPitchTypePct(row.twoStrikeWhiffPct)}</td>
      <td className={td}>{formatPitchTypePct(row.contactPct)}</td>
      <td className={tdBorder}>{row.ab ?? "—"}</td>
      <td className={td}>{row.h ?? "—"}</td>
      <td className={`${td} font-medium`}>{formatPitchTypeBaa(row.baa)}</td>
      <td className={td}>{formatPitchTypePct(row.kPct)}</td>
      <td className={td}>{formatPitchTypePct(row.bbPct)}</td>
      <td className={td}>{formatPitchTypePct(row.hrPct)}</td>
      <td className={td}>{formatPitchTypePct(row.xbhPct)}</td>
      <td className={td}>{formatPitchTypeRate(row.slg)}</td>
      <td className={td}>{formatPitchTypeRate(row.iso)}</td>
      <td className={td}>{formatPitchTypePct(row.gbPct)}</td>
      <td className={td}>{formatPitchTypePct(row.ldPct)}</td>
      <td className={td}>{formatPitchTypePct(row.fbPct)}</td>
    </tr>
  );
}
