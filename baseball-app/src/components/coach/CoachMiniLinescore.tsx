"use client";

import type { PlateAppearance } from "@/lib/types";
import {
  awayInningCell,
  boxScoreInningColumnCount,
  countHitsBottom,
  countHitsTop,
  effectiveInningHalfForLinescore,
  homeInningCell,
  inferLiveLinescoreFromPAs,
  totalErrorsChargedToAway,
  totalErrorsChargedToHome,
  totalRunsBottom,
  totalRunsTop,
} from "@/lib/compute/boxScore";

export interface CoachMiniLinescoreProps {
  awayTeam: string;
  homeTeam: string;
  pas: PlateAppearance[];
}

function Cell({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="tabular-nums text-[var(--neo-text-muted)]/70" aria-label="Not played">
        —
      </span>
    );
  }
  return <span className="tabular-nums text-[var(--neo-text)]">{value}</span>;
}

export function CoachMiniLinescore({
  awayTeam,
  homeTeam,
  pas,
}: CoachMiniLinescoreProps) {
  const { liveInning, liveHalf } = inferLiveLinescoreFromPAs(pas);
  const effHalf = effectiveInningHalfForLinescore(liveInning, liveHalf, pas);
  const nCols = boxScoreInningColumnCount(pas, liveInning);
  const innings = Array.from({ length: nCols }, (_, i) => i + 1);

  const rAway = totalRunsTop(pas);
  const rHome = totalRunsBottom(pas);
  const hAway = countHitsTop(pas);
  const hHome = countHitsBottom(pas);
  const eAway = totalErrorsChargedToHome(pas);
  const eHome = totalErrorsChargedToAway(pas);

  return (
    <div className="min-w-0 max-w-full">
      <div className="max-w-full overflow-x-auto" aria-label="Linescore by inning">
        <div
          className="grid w-max min-w-0 gap-x-0 gap-y-0 px-0 py-0 text-xs sm:text-sm"
          style={{
            /* Inning cols: content-width only — avoid 1fr spreading digits across the row */
            gridTemplateColumns: `minmax(0, 12rem) repeat(${nCols}, minmax(1.35rem, max-content)) minmax(1.35rem, max-content) minmax(1.35rem, max-content) minmax(1.35rem, max-content)`,
          }}
        >
          <div className="border-b border-[var(--neo-border)]/70 py-1 pr-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--neo-text-muted)] sm:py-1.5 sm:pr-1 sm:text-xs">
            Team
          </div>
          {innings.map((inn) => (
            <div
              key={`h-${inn}`}
              className="border-b border-[var(--neo-border)]/70 py-1 text-center text-[10px] font-semibold tabular-nums text-[var(--neo-text-muted)] sm:py-1.5 sm:text-xs"
            >
              {inn}
            </div>
          ))}
          <div className="border-b border-l border-[var(--neo-border)]/70 py-1 text-center text-[10px] font-semibold text-[var(--neo-text-muted)] sm:py-1.5 sm:text-xs">
            R
          </div>
          <div className="border-b border-[var(--neo-border)]/70 py-1 text-center text-[10px] font-semibold text-[var(--neo-text-muted)] sm:py-1.5 sm:text-xs">
            H
          </div>
          <div className="border-b border-[var(--neo-border)]/70 py-1 text-center text-[10px] font-semibold text-[var(--neo-text-muted)] sm:py-1.5 sm:text-xs">
            E
          </div>

          <div
            className="border-b border-[var(--neo-border)]/50 min-w-0 truncate py-1 pr-1 text-left text-xs font-medium leading-tight text-[var(--neo-text)] sm:py-1.5 sm:text-sm"
            title={awayTeam}
          >
            {awayTeam}
          </div>
          {innings.map((inn) => (
            <div
              key={`a-${inn}`}
              className="border-b border-[var(--neo-border)]/50 py-1 text-center font-mono tabular-nums sm:py-1.5"
            >
              <Cell value={awayInningCell(pas, inn, liveInning)} />
            </div>
          ))}
          <div className="border-b border-l border-[var(--neo-border)]/50 py-1 text-center font-mono text-xs font-semibold tabular-nums text-[var(--neo-accent)] sm:py-1.5 sm:text-sm">
            {rAway}
          </div>
          <div className="border-b border-[var(--neo-border)]/50 py-1 text-center font-mono text-xs font-semibold tabular-nums text-[var(--neo-text)] sm:py-1.5 sm:text-sm">
            {hAway}
          </div>
          <div className="border-b border-[var(--neo-border)]/50 py-1 text-center font-mono text-xs font-semibold tabular-nums text-[var(--neo-text)] sm:py-1.5 sm:text-sm">
            {eAway}
          </div>

          <div
            className="min-w-0 truncate py-1 pr-1 text-left text-xs font-medium leading-tight text-[var(--neo-text)] sm:py-1.5 sm:text-sm"
            title={homeTeam}
          >
            {homeTeam}
          </div>
          {innings.map((inn) => (
            <div
              key={`hb-${inn}`}
              className="py-1 text-center font-mono tabular-nums sm:py-1.5"
            >
              <Cell value={homeInningCell(pas, inn, liveInning, effHalf)} />
            </div>
          ))}
          <div className="border-l border-[var(--neo-border)]/50 py-1 text-center font-mono text-xs font-semibold tabular-nums text-[var(--neo-accent)] sm:py-1.5 sm:text-sm">
            {rHome}
          </div>
          <div className="py-1 text-center font-mono text-xs font-semibold tabular-nums text-[var(--neo-text)] sm:py-1.5 sm:text-sm">
            {hHome}
          </div>
          <div className="py-1 text-center font-mono text-xs font-semibold tabular-nums text-[var(--neo-text)] sm:py-1.5 sm:text-sm">
            {eHome}
          </div>
        </div>
      </div>
    </div>
  );
}
