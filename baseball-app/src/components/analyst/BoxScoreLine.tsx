"use client";

import type { Game, PlateAppearance } from "@/lib/types";
import {
  awayInningCell,
  boxScoreInningColumnCount,
  countHitsBottom,
  countHitsTop,
  effectiveInningHalfForLinescore,
  homeInningCell,
  totalErrorsChargedToAway,
  totalErrorsChargedToHome,
  totalRunsBottom,
  totalRunsTop,
} from "@/lib/compute/boxScore";

export interface BoxScoreLineProps {
  game: Game;
  pas: PlateAppearance[];
  /** Current inning from the record form (drives “not yet played” dashes). */
  liveInning: number;
  liveInningHalf: "top" | "bottom" | null;
}

function Cell({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="text-white/55 tabular-nums" aria-label="Not played">
        —
      </span>
    );
  }
  return <span className="tabular-nums text-white">{value}</span>;
}

export function BoxScoreLine({ game, pas, liveInning, liveInningHalf }: BoxScoreLineProps) {
  const effHalf = effectiveInningHalfForLinescore(liveInning, liveInningHalf, pas);
  const nCols = boxScoreInningColumnCount(pas, liveInning);
  const innings = Array.from({ length: nCols }, (_, i) => i + 1);

  const awayName = game.away_team;
  const homeName = game.home_team;

  const rAway = totalRunsTop(pas);
  const rHome = totalRunsBottom(pas);
  const hAway = countHitsTop(pas);
  const hHome = countHitsBottom(pas);
  /** Away row: E = errors committed by home defense while away bats (top). Home row: E = errors by away defense. */
  const eAway = totalErrorsChargedToHome(pas);
  const eHome = totalErrorsChargedToAway(pas);

  return (
    <div className="min-w-0">
      <h3 className="font-display mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Box score
      </h3>
      <div
        className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[#0a0d12]"
        role="table"
        aria-label="Linescore by inning"
      >
        <div
          className="grid min-w-[min(100%,520px)] gap-x-1 gap-y-0 px-2 py-2 text-[11px] text-white sm:text-xs"
          style={{
            gridTemplateColumns: `minmax(5.5rem,1fr) repeat(${nCols}, minmax(1.75rem,1fr)) minmax(1.5rem,auto) minmax(1.5rem,auto) minmax(1.5rem,auto)`,
          }}
        >
          {/* Header row */}
          <div
            className="border-b border-[var(--border)]/60 py-1.5 pr-1 font-semibold uppercase tracking-wide text-white"
            role="columnheader"
          >
            Team
          </div>
          {innings.map((inn) => (
            <div
              key={`h-${inn}`}
              className="border-b border-[var(--border)]/60 py-1.5 text-center font-semibold tabular-nums text-white"
              role="columnheader"
            >
              {inn}
            </div>
          ))}
          <div
            className="border-b border-l border-[var(--border)]/60 py-1.5 text-center font-semibold text-white"
            role="columnheader"
          >
            R
          </div>
          <div
            className="border-b border-[var(--border)]/60 py-1.5 text-center font-semibold text-white"
            role="columnheader"
          >
            H
          </div>
          <div
            className="border-b border-[var(--border)]/60 py-1.5 text-center font-semibold text-white"
            role="columnheader"
          >
            E
          </div>

          {/* Away */}
          <div
            className="border-b border-[var(--border)]/40 py-2 pr-1 text-left font-medium leading-tight text-white"
            role="rowheader"
          >
            <span className="truncate">{awayName}</span>
          </div>
          {innings.map((inn) => (
            <div
              key={`a-${inn}`}
              className="border-b border-[var(--border)]/40 py-2 text-center font-mono"
              role="cell"
            >
              <Cell value={awayInningCell(pas, inn, liveInning)} />
            </div>
          ))}
          <div
            className="border-b border-l border-[var(--border)]/40 py-2 text-center font-mono font-semibold tabular-nums text-[var(--text)]"
            role="cell"
          >
            {rAway}
          </div>
          <div
            className="border-b border-[var(--border)]/40 py-2 text-center font-mono font-semibold tabular-nums text-[var(--text)]"
            role="cell"
          >
            {hAway}
          </div>
          <div
            className="border-b border-[var(--border)]/40 py-2 text-center font-mono font-semibold tabular-nums text-[var(--text)]"
            role="cell"
          >
            {eAway}
          </div>

          {/* Home */}
          <div className="py-2 pr-1 text-left font-medium leading-tight text-[var(--text)]" role="rowheader">
            <span className="truncate">{homeName}</span>
          </div>
          {innings.map((inn) => (
            <div key={`h2-${inn}`} className="py-2 text-center font-mono" role="cell">
              <Cell value={homeInningCell(pas, inn, liveInning, effHalf)} />
            </div>
          ))}
          <div
            className="border-l border-[var(--border)]/40 py-2 text-center font-mono font-semibold tabular-nums text-white"
            role="cell"
          >
            {rHome}
          </div>
          <div className="py-2 text-center font-mono font-semibold tabular-nums text-white" role="cell">
            {hHome}
          </div>
          <div className="py-2 text-center font-mono font-semibold tabular-nums text-white" role="cell">
            {eHome}
          </div>
        </div>
      </div>
    </div>
  );
}
