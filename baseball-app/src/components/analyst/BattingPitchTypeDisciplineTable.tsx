"use client";

import { useMemo, type ReactNode } from "react";
import {
  BAT_PITCH_TYPE_DISCIPLINE_HELPER_TEXT,
  buildBattingPitchTypeRows,
  formatPitchTypePct,
  type BattingPitchTypeRow,
} from "@/lib/pitchTypeBattingDisplay";
import type { BattingStats } from "@/lib/types";

type BattingPitchTypeDisciplineTableProps = {
  stats: BattingStats;
  platoonControl?: ReactNode;
  className?: string;
};

const TH =
  "whitespace-nowrap py-2 px-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]";
const TH_GROUP =
  "whitespace-nowrap py-1.5 px-2 text-center text-[9px] font-semibold uppercase tracking-widest text-[var(--text-faint)]";

export function BattingPitchTypeDisciplineTable({
  stats,
  platoonControl,
  className = "",
}: BattingPitchTypeDisciplineTableProps) {
  const rows = useMemo(() => buildBattingPitchTypeRows(stats), [stats]);
  const typed = stats.batTyped ?? 0;

  return (
    <section className={`card-tech rounded-lg border border-[var(--border)] p-4 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
          Discipline & BIP vs pitch type
        </h2>
        {platoonControl}
      </div>
      <p className="mt-1.5 text-xs text-[var(--text-muted)]">{BAT_PITCH_TYPE_DISCIPLINE_HELPER_TEXT}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-max min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th rowSpan={2} className={`${TH} !text-left pr-3 align-bottom`}>
                Pitch
              </th>
              <th rowSpan={2} className={`${TH} border-l border-[var(--border)] align-bottom`}>
                #
              </th>
              <th colSpan={5} className={`${TH_GROUP} border-l border-[var(--border)]`}>
                Discipline
              </th>
              <th colSpan={4} className={`${TH_GROUP} border-l border-[var(--border)]`}>
                BIP (PA ends in play)
              </th>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <th className={`${TH} border-l border-[var(--border)]`}>Sw%</th>
              <th className={TH}>Whiff%</th>
              <th className={TH}>2K Whiff%</th>
              <th className={TH}>Foul%</th>
              <th className={TH}>Contact%</th>
              <th className={`${TH} border-l border-[var(--border)]`}>GB%</th>
              <th className={TH}>LD%</th>
              <th className={TH}>FB%</th>
              <th className={TH}>IFF%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <DisciplineRowTr key={row.key} row={row} dimUnused={typed > 0 && !row.hasTypedPitches} />
            ))}
          </tbody>
        </table>
      </div>
      {typed > 0 ? (
        <p className="mt-2 text-[11px] text-[var(--text-faint)]">
          {typed.toLocaleString()} typed pitch{typed === 1 ? "" : "es"} seen in sample.
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-[var(--text-faint)]">
          No pitches with a logged pitch type in this sample. Tag pitch types on Record or the coach pad to fill in
          rates.
        </p>
      )}
    </section>
  );
}

function DisciplineRowTr({ row, dimUnused }: { row: BattingPitchTypeRow; dimUnused: boolean }) {
  const muted = dimUnused ? "text-[var(--text-faint)]" : "text-[var(--text)]";
  const td = `whitespace-nowrap py-2 px-2 text-right tabular-nums ${muted}`;
  const tdBorder = `${td} border-l border-[var(--border)]`;
  return (
    <tr className={`border-b border-[var(--border)] last:border-0 ${dimUnused ? "opacity-50" : ""}`}>
      <td className={`py-2 pr-3 font-medium ${muted}`}>{row.label}</td>
      <td className={tdBorder}>{row.pitches ?? "—"}</td>
      <td className={tdBorder}>{formatPitchTypePct(row.swingPct)}</td>
      <td className={td}>{formatPitchTypePct(row.whiffPct)}</td>
      <td className={td}>{formatPitchTypePct(row.twoStrikeWhiffPct)}</td>
      <td className={td}>{formatPitchTypePct(row.foulPct)}</td>
      <td className={td}>{formatPitchTypePct(row.contactPct)}</td>
      <td className={tdBorder}>{formatPitchTypePct(row.gbPct)}</td>
      <td className={td}>{formatPitchTypePct(row.ldPct)}</td>
      <td className={td}>{formatPitchTypePct(row.fbPct)}</td>
      <td className={td}>{formatPitchTypePct(row.iffPct)}</td>
    </tr>
  );
}
