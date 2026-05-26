"use client";

import { useMemo } from "react";
import {
  PITCH_TYPE_BAA_HELPER_TEXT,
  buildPitchTypeBaaRowsVisible,
  formatPitchTypeBaa,
  pitchTypeBaaColumnLabel,
} from "@/lib/pitchTypeBaaDisplay";
import { comparePitchingLineFromSplits, type CompareStatScope } from "@/components/analyst/pitchingStatsSheetModel";
import type { Player, PitchingStatsWithSplits } from "@/lib/types";

function ComparePitchTypeBaaThreeColumn({
  playerA,
  playerB,
  lineA,
  lineB,
}: {
  playerA: Player | null;
  playerB: Player | null;
  lineA: ReturnType<typeof buildPitchTypeBaaRowsVisible>;
  lineB: ReturnType<typeof buildPitchTypeBaaRowsVisible>;
}) {
  const rowKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const r of lineA) keys.add(r.key);
    for (const r of lineB) keys.add(r.key);
    return [...keys];
  }, [lineA, lineB]);

  const rowA = (key: string) => lineA.find((r) => r.key === key);
  const rowB = (key: string) => lineB.find((r) => r.key === key);

  if (rowKeys.length === 0) {
    return (
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        No typed pitches in this sample for either pitcher.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-[36%]" />
          <col className="w-[28%]" />
          <col className="w-[36%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="pb-2 pl-0 pr-1 pt-1 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              {playerA?.name ?? "Player 1"}
            </th>
            <th className="pb-2 px-0.5 pt-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              Pitch · BAA
            </th>
            <th className="pb-2 pl-1 pr-0 pt-1 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              {playerB?.name ?? "Player 2"}
            </th>
          </tr>
        </thead>
        <tbody>
          {rowKeys.map((key) => {
            const a = rowA(key);
            const b = rowB(key);
            const abbrev = a?.abbrev ?? b?.abbrev ?? key;
            const baaA = a?.baa;
            const baaB = b?.baa;
            const abA = a?.ab;
            const abB = b?.ab;
            let hiA = false;
            let hiB = false;
            if (baaA != null && baaB != null && Math.abs(baaA - baaB) > 1e-9) {
              if (baaA < baaB) hiA = true;
              else hiB = true;
            }
            const tdBase = "py-1 text-base tabular-nums leading-snug sm:text-[1.0625rem]";
            const tdMuted = `${tdBase} font-normal text-[var(--text)]`;
            const tdWin = `${tdBase} font-semibold italic text-[var(--compare-stat-win-fg)]`;
            const centerTitle = `${pitchTypeBaaColumnLabel(abbrev)}${abA != null || abB != null ? ` (AB ${abA ?? "—"} / ${abB ?? "—"})` : ""}`;
            return (
              <tr key={key} className="border-b border-[var(--border)]/55">
                <td className={`pl-0 pr-1 text-right ${hiA ? tdWin : tdMuted}`}>
                  {formatPitchTypeBaa(baaA)}
                </td>
                <td
                  className="py-1 px-0.5 text-center text-sm font-semibold uppercase leading-none tracking-wide text-[var(--accent)]"
                  title={centerTitle}
                >
                  {abbrev}
                </td>
                <td className={`pl-1 pr-0 text-left ${hiB ? tdWin : tdMuted}`}>
                  {formatPitchTypeBaa(baaB)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ComparePitchTypeBaaPanel({
  playerA,
  playerB,
  pitchingA,
  pitchingB,
  compareScope,
  scopeLabel,
}: {
  playerA: Player | null;
  playerB: Player | null;
  pitchingA: PitchingStatsWithSplits | null;
  pitchingB: PitchingStatsWithSplits | null;
  compareScope: CompareStatScope;
  scopeLabel: string;
}) {
  const statsA = comparePitchingLineFromSplits(pitchingA, compareScope);
  const statsB = comparePitchingLineFromSplits(pitchingB, compareScope);

  const rowsA = useMemo(
    () => (statsA ? buildPitchTypeBaaRowsVisible(statsA.rates) : []),
    [statsA]
  );
  const rowsB = useMemo(
    () => (statsB ? buildPitchTypeBaaRowsVisible(statsB.rates) : []),
    [statsB]
  );

  if (!playerA && !playerB) return null;

  return (
    <section className="card-tech mx-auto w-full max-w-xl rounded-lg border border-[var(--border)] p-3 sm:max-w-2xl sm:p-3.5">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
        BAA by pitch type
      </h2>
      <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
        <span className="font-medium text-[var(--text)]">{scopeLabel}</span>
        {" · "}
        {PITCH_TYPE_BAA_HELPER_TEXT}
      </p>
      <div className="mt-2">
        <ComparePitchTypeBaaThreeColumn playerA={playerA} playerB={playerB} lineA={rowsA} lineB={rowsB} />
      </div>
    </section>
  );
}
