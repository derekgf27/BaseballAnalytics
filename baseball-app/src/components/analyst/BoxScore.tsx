"use client";

import { useMemo } from "react";
import {
  boxScoreInningColumnCount,
  runsOnPaForLinescore,
  totalErrorsChargedToAway,
  totalErrorsChargedToHome,
} from "@/lib/compute/boxScore";
import type { Game, PlateAppearance } from "@/lib/types";

const HIT_RESULTS = ["single", "double", "triple", "hr"] as const;

function computeBoxScoreFromPAs(pas: PlateAppearance[]) {
  const runsByInning: Record<number, number> = {};
  let hits = 0;
  for (const pa of pas) {
    const inn = pa.inning;
    runsByInning[inn] = (runsByInning[inn] ?? 0) + runsOnPaForLinescore(pa);
    if (HIT_RESULTS.includes(pa.result as (typeof HIT_RESULTS)[number])) hits += 1;
  }
  return { runsByInning, hits };
}

interface BoxScoreProps {
  game: Game;
  /** All plate appearances for the game (caller passes full game list). */
  pas: PlateAppearance[];
  /** Current inning on Record (extends columns for live games). Omit on Review / PDF. */
  liveInning?: number;
  /** Tighter typography and cell padding (e.g. review page beside pitcher credits). */
  compact?: boolean;
  /** Large table for emphasis (e.g. game review); wins over `compact` when both set. */
  large?: boolean;
  /** Omit outer border/background (use inside a parent card). */
  bare?: boolean;
}

export function BoxScore({
  game,
  pas,
  liveInning = 0,
  compact = false,
  large = false,
  bare = false,
}: BoxScoreProps) {
  const innings = useMemo(() => {
    const n = boxScoreInningColumnCount(pas, liveInning);
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [pas, liveInning]);

  const pasAway = pas.filter((p) => p.inning_half === "top");
  const pasHome = pas.filter((p) => p.inning_half === "bottom");
  const awayStats = computeBoxScoreFromPAs(pasAway);
  const homeStats = computeBoxScoreFromPAs(pasHome);
  /** Show each team's own defensive errors in its row (standard linescore E column). */
  const awayE = totalErrorsChargedToAway(pas);
  const homeE = totalErrorsChargedToHome(pas);

  // Use recorded PA scoring for linescore/game review so values always match logged events.
  const awayR = Object.values(awayStats.runsByInning).reduce((s, n) => s + n, 0);
  const homeR = Object.values(homeStats.runsByInning).reduce((s, n) => s + n, 0);

  const isCompact = compact && !large;
  const cellPad = large
    ? "px-2 py-2.5 sm:px-2.5 sm:py-3"
    : isCompact
      ? "px-0 py-px leading-none"
      : "px-1 py-2";
  const teamPad = large
    ? "px-4 py-2.5 sm:px-5 sm:py-3"
    : isCompact
      ? "px-1 py-px pr-0.5 leading-tight"
      : "px-3 py-2";
  const headPad = large
    ? "px-2 py-2.5 sm:px-2.5 sm:py-3"
    : isCompact
      ? "px-0 py-px leading-none"
      : "px-1 py-2";
  const teamHeadPad = large
    ? "px-4 py-2.5 sm:px-5 sm:py-3"
    : isCompact
      ? "px-1 py-px pr-0.5 leading-none"
      : "px-3 py-2";
  const innW = large
    ? "w-11 min-w-[2.5rem] px-1 sm:w-12 sm:min-w-[2.85rem] sm:px-1.5"
    : isCompact
      ? "w-3 min-w-[0.65rem] max-w-[0.7rem] px-0"
      : "w-9";
  const rHEW = large
    ? "w-12 min-w-[2.65rem] px-1 sm:w-14 sm:min-w-[3rem] sm:px-1.5"
    : isCompact
      ? "w-4 min-w-[0.85rem] max-w-[1.15rem] px-0"
      : "w-9";
  const tableText = large
    ? "text-left text-base tabular-nums sm:text-lg"
    : isCompact
      ? "text-left text-[9px] leading-none sm:text-[10px]"
      : "text-left text-sm";
  const headText = large
    ? "text-sm font-bold sm:text-base"
    : isCompact
      ? "text-[8px] leading-none sm:text-[9px]"
      : "text-xs";
  const tableWidth = large || isCompact ? "w-auto" : "w-full min-w-0";
  /** Room for full club names without harsh ellipsis; numbers stay tight. */
  const teamColCompact =
    "w-[min(12rem,42vw)] min-w-[7.5rem] max-w-[13rem] whitespace-normal break-words align-top leading-snug";
  const teamColLarge =
    "min-w-[11rem] max-w-[min(100%,20rem)] whitespace-normal break-words align-middle leading-snug sm:min-w-[13rem] sm:max-w-[22rem]";
  const teamColClass = large ? teamColLarge : isCompact ? teamColCompact : "";
  const wrapClass =
    bare && (isCompact || large)
      ? "inline-block w-max max-w-full overflow-x-auto"
      : isCompact
        ? "inline-block w-max max-w-full overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-card)]"
        : "overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-card)]";

  return (
    <section className={wrapClass}>
      <table className={`box-score-linescore-table ${tableWidth} border-collapse ${tableText}`}>
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
            <th
              className={`font-display ${teamHeadPad} ${headText} ${large ? "" : "font-semibold"} uppercase tracking-wider text-white ${teamColClass}`}
            >
              Team
            </th>
            {innings.map((i) => (
              <th
                key={i}
                className={`font-display ${innW} ${headPad} text-center ${headText} ${large ? "" : "font-semibold"} uppercase tracking-wider text-white`}
              >
                {i}
              </th>
            ))}
            <th
              className={`font-display ${rHEW} border-l border-[var(--border)] ${headPad} text-center ${headText} ${large ? "" : "font-semibold"} uppercase tracking-wider text-white`}
            >
              R
            </th>
            <th
              className={`font-display ${rHEW} ${headPad} text-center ${headText} ${large ? "" : "font-semibold"} uppercase tracking-wider text-white`}
            >
              H
            </th>
            <th
              className={`font-display ${rHEW} ${headPad} text-center ${headText} ${large ? "" : "font-semibold"} uppercase tracking-wider text-white`}
            >
              E
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Away bats in top half */}
          <tr className="border-b border-[var(--border)]">
            <td
              className={`${teamPad} ${large ? "font-semibold" : "font-medium"} text-[var(--text)] ${teamColClass}`}
              title={game.away_team}
            >
              {game.away_team}
            </td>
            {innings.map((i) => (
              <td key={i} className={`${cellPad} text-center tabular-nums text-[var(--text)]`}>
                {(awayStats.runsByInning[i] ?? 0) || "0"}
              </td>
            ))}
            <td
              className={`border-l border-[var(--border)] ${cellPad} text-center tabular-nums ${large ? "font-bold" : "font-medium"} text-[var(--text)]`}
            >
              {awayR}
            </td>
            <td className={`${cellPad} text-center tabular-nums text-[var(--text)]`}>{awayStats.hits}</td>
            <td className={`${cellPad} text-center tabular-nums text-[var(--text)]`}>{awayE}</td>
          </tr>
          {/* Home bats in bottom half */}
          <tr className="border-b border-[var(--border)]">
            <td
              className={`${teamPad} ${large ? "font-semibold" : "font-medium"} text-[var(--text)] ${teamColClass}`}
              title={game.home_team}
            >
              {game.home_team}
            </td>
            {innings.map((i) => (
              <td key={i} className={`${cellPad} text-center tabular-nums text-[var(--text)]`}>
                {(homeStats.runsByInning[i] ?? 0) || "0"}
              </td>
            ))}
            <td
              className={`border-l border-[var(--border)] ${cellPad} text-center tabular-nums ${large ? "font-bold" : "font-medium"} text-[var(--text)]`}
            >
              {homeR}
            </td>
            <td className={`${cellPad} text-center tabular-nums text-[var(--text)]`}>{homeStats.hits}</td>
            <td className={`${cellPad} text-center tabular-nums text-[var(--text)]`}>{homeE}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
