"use client";

import type { Game, PlateAppearance } from "@/lib/types";

const HIT_RESULTS = ["single", "double", "triple", "hr"] as const;
const INNINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function computeBoxScoreFromPAs(pas: PlateAppearance[]) {
  const runsByInning: Record<number, number> = {};
  let hits = 0;
  for (const pa of pas) {
    const inn = pa.inning;
    runsByInning[inn] = (runsByInning[inn] ?? 0) + (pa.runs_scored_player_ids?.length ?? 0);
    if (HIT_RESULTS.includes(pa.result as (typeof HIT_RESULTS)[number])) hits += 1;
  }
  return { runsByInning, hits };
}

interface BoxScoreProps {
  game: Game;
  pas: PlateAppearance[];
}

export function BoxScore({ game, pas }: BoxScoreProps) {
  const { runsByInning, hits: ourHits } = computeBoxScoreFromPAs(pas);
  const ourRunsByInning = runsByInning;
  const isHome = game.our_side === "home";
  const awayR = game.final_score_away ?? 0;
  const homeR = game.final_score_home ?? 0;

  return (
    <section className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
      <table className="w-full min-w-[320px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
            <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Team
            </th>
            {INNINGS.map((i) => (
              <th
                key={i}
                className="w-9 px-1 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
              >
                {i}
              </th>
            ))}
            <th className="w-9 px-1 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              R
            </th>
            <th className="w-9 px-1 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              H
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Away row */}
          <tr className="border-b border-[var(--border)]">
            <td className="px-3 py-2 font-medium text-[var(--text)]">
              {isHome ? game.away_team : game.home_team}
              {!isHome && (
                <span className="ml-1 text-xs text-[var(--text-muted)]">(us)</span>
              )}
            </td>
            {INNINGS.map((i) => (
              <td key={i} className="px-1 py-2 text-center tabular-nums text-[var(--text)]">
                {!isHome ? (ourRunsByInning[i] ?? 0) || "0" : "—"}
              </td>
            ))}
            <td className="px-1 py-2 text-center tabular-nums font-medium text-[var(--text)]">
              {isHome ? awayR : homeR}
            </td>
            <td className="px-1 py-2 text-center tabular-nums text-[var(--text)]">
              {!isHome ? ourHits : "—"}
            </td>
          </tr>
          {/* Home row */}
          <tr className="border-b border-[var(--border)]">
            <td className="px-3 py-2 font-medium text-[var(--text)]">
              {isHome ? game.home_team : game.away_team}
              {isHome && (
                <span className="ml-1 text-xs text-[var(--text-muted)]">(us)</span>
              )}
            </td>
            {INNINGS.map((i) => (
              <td key={i} className="px-1 py-2 text-center tabular-nums text-[var(--text)]">
                {isHome ? (ourRunsByInning[i] ?? 0) || "0" : "—"}
              </td>
            ))}
            <td className="px-1 py-2 text-center tabular-nums font-medium text-[var(--text)]">
              {isHome ? homeR : awayR}
            </td>
            <td className="px-1 py-2 text-center tabular-nums text-[var(--text)]">
              {isHome ? ourHits : "—"}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
