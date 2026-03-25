"use client";

import { useMemo } from "react";
import { computeGamePitchingBox } from "@/lib/compute/gamePitchingBox";
import type { Game, PlateAppearance, Player } from "@/lib/types";

function playerMap(players: Player[]): Map<string, Player> {
  return new Map(players.map((p) => [p.id, p]));
}

interface GamePitchingBoxTableProps {
  game: Game;
  /** Home or away — pitchers who fielded for this team (defense). */
  side: "home" | "away";
  /** All PAs for the game (not filtered by half). */
  pas: PlateAppearance[];
  players: Player[];
  /** Tighter layout for Record PAs panel. */
  compact?: boolean;
  /** When true, omit the "Pitchers – …" heading (e.g. parent renders a shared header row). */
  hideHeading?: boolean;
}

export function GamePitchingBoxTable({
  game,
  side,
  pas,
  players,
  compact = false,
  hideHeading = false,
}: GamePitchingBoxTableProps) {
  const teamName = side === "home" ? game.home_team : game.away_team;
  const byId = useMemo(() => playerMap(players), [players]);
  const { rows, totals } = useMemo(
    () => computeGamePitchingBox(pas, side, byId),
    [pas, side, byId]
  );

  if (rows.length === 0) {
    return (
      <section>
        {!hideHeading ? (
          <h2
            className={
              compact
                ? "font-display mb-1 text-xs font-semibold uppercase tracking-wider text-white"
                : "font-display mb-2 text-sm font-semibold uppercase tracking-wider text-white"
            }
          >
            Pitchers – {teamName}
          </h2>
        ) : null}
        <p
          className={
            compact
              ? "rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2 py-2 text-xs text-[var(--text-muted)]"
              : "rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-4 text-sm text-[var(--text-muted)]"
          }
        >
          No pitching recorded yet.
        </p>
      </section>
    );
  }

  /** Player column grows; stat columns fixed width so headers align with numbers. */
  const thPlayer = compact
    ? "font-display py-1.5 pl-2 pr-2 text-left text-[10px] font-semibold uppercase tracking-wider text-white"
    : "font-display py-2 pl-3 pr-2 text-left text-xs font-semibold uppercase tracking-wider text-white";
  const tdPlayer = compact
    ? "max-w-[min(100%,12rem)] truncate py-1.5 pl-2 pr-2 text-left align-middle font-medium text-[var(--text)]"
    : "max-w-[min(100%,16rem)] truncate py-2 pl-3 pr-2 text-left align-middle font-medium text-[var(--text)]";
  /** Same width for each numeric column — thead and tbody share colgroup. */
  const thStat = compact
    ? "font-display w-10 min-w-[2.35rem] max-w-[2.75rem] whitespace-nowrap py-1.5 px-1 text-right text-[10px] font-semibold uppercase tracking-wider text-white"
    : "font-display w-11 min-w-[2.5rem] max-w-[3rem] whitespace-nowrap py-2 px-1.5 text-right text-xs font-semibold uppercase tracking-wider text-white";
  const tdStat = compact
    ? "w-10 min-w-[2.35rem] max-w-[2.75rem] whitespace-nowrap py-1.5 px-1 text-right tabular-nums text-[var(--text)]"
    : "w-11 min-w-[2.5rem] max-w-[3rem] whitespace-nowrap py-2 px-1.5 text-right tabular-nums text-[var(--text)]";

  return (
    <section className={compact ? "space-y-1" : "space-y-4"}>
      {!hideHeading ? (
        <h2
          className={
            compact
              ? "font-display text-xs font-semibold uppercase tracking-wider text-white"
              : "font-display text-sm font-semibold uppercase tracking-wider text-white"
          }
        >
          Pitchers – {teamName}
        </h2>
      ) : null}
      <div
        className={
          compact
            ? "overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-card)]"
            : "max-h-[min(70vh,32rem)] overflow-x-auto overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-card)]"
        }
      >
        <table
          className={`table-fixed w-full border-collapse text-left ${compact ? "min-w-[min(100%,26rem)] text-xs" : "min-w-[min(100%,32rem)] text-sm"}`}
        >
          <colgroup>
            <col className="min-w-0" />
            <col className={compact ? "w-10" : "w-11"} />
            <col className={compact ? "w-10" : "w-11"} />
            <col className={compact ? "w-10" : "w-11"} />
            <col className={compact ? "w-10" : "w-11"} />
            <col className={compact ? "w-10" : "w-11"} />
            <col className={compact ? "w-10" : "w-11"} />
            <col className={compact ? "w-10" : "w-11"} />
            <col className={compact ? "w-10" : "w-11"} />
          </colgroup>
          <thead className={compact ? "" : "sticky top-0 z-10 shadow-[0_1px_0_0_var(--border)]"}>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
              <th scope="col" className={thPlayer}>
                Player
              </th>
              <th scope="col" className={thStat}>
                IP
              </th>
              <th scope="col" className={thStat}>
                H
              </th>
              <th scope="col" className={thStat}>
                R
              </th>
              <th scope="col" className={thStat}>
                ER
              </th>
              <th scope="col" className={thStat}>
                BB
              </th>
              <th scope="col" className={thStat}>
                K
              </th>
              <th scope="col" className={thStat}>
                HR
              </th>
              <th scope="col" className={thStat}>
                ERA
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.playerId} className="border-b border-[var(--border)]">
                <td className={tdPlayer}>{row.name}</td>
                <td className={tdStat}>{row.ip}</td>
                <td className={tdStat}>{row.h}</td>
                <td className={tdStat}>{row.r}</td>
                <td className={tdStat}>{row.er}</td>
                <td className={tdStat}>{row.bb}</td>
                <td className={tdStat}>{row.k}</td>
                <td className={tdStat}>{row.hr}</td>
                <td className={tdStat}>{row.era}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-[var(--border)] bg-[var(--bg-elevated)] font-medium">
              <td className={tdPlayer}>Totals</td>
              <td className={tdStat}>{totals.ip}</td>
              <td className={tdStat}>{totals.h}</td>
              <td className={tdStat}>{totals.r}</td>
              <td className={tdStat}>{totals.er}</td>
              <td className={tdStat}>{totals.bb}</td>
              <td className={tdStat}>{totals.k}</td>
              <td className={tdStat}>{totals.hr}</td>
              <td className={tdStat}>{totals.era}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
