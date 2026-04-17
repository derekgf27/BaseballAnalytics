"use client";

import { runsOnPaForLinescore, totalErrorsChargedToAway, totalErrorsChargedToHome } from "@/lib/compute/boxScore";
import { REGULATION_INNINGS } from "@/lib/leagueConfig";
import type { Game, PlateAppearance } from "@/lib/types";

const HIT_RESULTS = ["single", "double", "triple", "hr"] as const;
const INNINGS = Array.from({ length: REGULATION_INNINGS }, (_, i) => i + 1);

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
}

export function BoxScore({ game, pas }: BoxScoreProps) {
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

  return (
    <section className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
      <table className="w-full min-w-[320px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
            <th className="font-display px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white">
              Team
            </th>
            {INNINGS.map((i) => (
              <th
                key={i}
                className="font-display w-9 px-1 py-2 text-center text-xs font-semibold uppercase tracking-wider text-white"
              >
                {i}
              </th>
            ))}
            <th className="font-display w-9 border-l border-[var(--border)] px-1 py-2 text-center text-xs font-semibold uppercase tracking-wider text-white">
              R
            </th>
            <th className="font-display w-9 px-1 py-2 text-center text-xs font-semibold uppercase tracking-wider text-white">
              H
            </th>
            <th className="font-display w-9 px-1 py-2 text-center text-xs font-semibold uppercase tracking-wider text-white">
              E
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Away bats in top half */}
          <tr className="border-b border-[var(--border)]">
            <td className="px-3 py-2 font-medium text-[var(--text)]">
              {game.away_team}
            </td>
            {INNINGS.map((i) => (
              <td key={i} className="px-1 py-2 text-center tabular-nums text-[var(--text)]">
                {(awayStats.runsByInning[i] ?? 0) || "0"}
              </td>
            ))}
            <td className="border-l border-[var(--border)] px-1 py-2 text-center tabular-nums font-medium text-[var(--text)]">
              {awayR}
            </td>
            <td className="px-1 py-2 text-center tabular-nums text-[var(--text)]">{awayStats.hits}</td>
            <td className="px-1 py-2 text-center tabular-nums text-[var(--text)]">{awayE}</td>
          </tr>
          {/* Home bats in bottom half */}
          <tr className="border-b border-[var(--border)]">
            <td className="px-3 py-2 font-medium text-[var(--text)]">
              {game.home_team}
            </td>
            {INNINGS.map((i) => (
              <td key={i} className="px-1 py-2 text-center tabular-nums text-[var(--text)]">
                {(homeStats.runsByInning[i] ?? 0) || "0"}
              </td>
            ))}
            <td className="border-l border-[var(--border)] px-1 py-2 text-center tabular-nums font-medium text-[var(--text)]">
              {homeR}
            </td>
            <td className="px-1 py-2 text-center tabular-nums text-[var(--text)]">{homeStats.hits}</td>
            <td className="px-1 py-2 text-center tabular-nums text-[var(--text)]">{homeE}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
