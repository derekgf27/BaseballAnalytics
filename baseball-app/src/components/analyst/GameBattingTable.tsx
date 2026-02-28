"use client";

import { battingStatsFromPAs } from "@/lib/compute/battingStats";
import type { Game, PlateAppearance, Player } from "@/lib/types";

export interface GameBattingRow {
  playerId: string;
  name: string;
  position: string;
  ab: number;
  r: number;
  h: number;
  rbi: number;
  bb: number;
  k: number;
  avg: number;
  ops: number;
  double: number;
  triple: number;
  hr: number;
  tb: number;
  sb: number;
}

function formatAvgOps(value: number): string {
  if (value === 0) return ".000";
  const s = value.toFixed(3);
  return s.startsWith("0.") ? s.slice(1) : s;
}

function computeGameBatting(
  pas: PlateAppearance[],
  players: Player[],
  lineupOrder?: string[] | null,
  lineupPositionByPlayerId?: Record<string, string | null>
): GameBattingRow[] {
  const list = players ?? [];
  const playerMap = new Map(list.map((p) => [p.id, p]));
  const batterIdsInGame = new Set(pas.map((pa) => pa.batter_id).filter(Boolean));

  const order: string[] = [];
  if (lineupOrder?.length) {
    for (const playerId of lineupOrder) {
      order.push(playerId);
    }
    for (const id of batterIdsInGame) {
      if (!order.includes(id)) order.push(id);
    }
  } else {
    const seen = new Set<string>();
    for (const pa of pas) {
      if (!seen.has(pa.batter_id)) {
        seen.add(pa.batter_id);
        order.push(pa.batter_id);
      }
    }
  }

  const rows: GameBattingRow[] = [];
  for (const batterId of order) {
    const player = playerMap.get(batterId);
    if (!player) continue;
    const playerPAs = pas.filter((p) => p.batter_id === batterId);
    const stats = battingStatsFromPAs(playerPAs);

    const r = playerPAs.reduce(
      (sum, pa) => sum + (pa.runs_scored_player_ids?.includes(batterId) ? 1 : 0),
      0
    );
    const d = stats?.double ?? 0;
    const t = stats?.triple ?? 0;
    const hrCount = stats?.hr ?? 0;
    const singles = (stats?.h ?? 0) - d - t - hrCount;
    const tb = singles + 2 * d + 3 * t + 4 * hrCount;

    const gamePosition = lineupPositionByPlayerId?.[batterId];
    rows.push({
      playerId: batterId,
      name: player.name,
      position:
        gamePosition != null && gamePosition !== ""
          ? gamePosition
          : player.positions?.[0] ?? "",
      ab: stats?.ab ?? 0,
      r,
      h: stats?.h ?? 0,
      rbi: stats?.rbi ?? 0,
      bb: (stats?.bb ?? 0) + (stats?.ibb ?? 0),
      k: stats?.so ?? 0,
      avg: stats?.avg ?? 0,
      ops: stats?.ops ?? 0,
      double: d,
      triple: t,
      hr: hrCount,
      tb,
      sb: stats?.sb ?? 0,
    });
  }
  return rows;
}

interface GameBattingTableProps {
  game: Game;
  pas: PlateAppearance[];
  players?: Player[] | null;
  /** Game lineup: player IDs in slot order (1–9). When set, table follows this order for easier reading. */
  lineupOrder?: string[] | null;
  /** Position for each player in this game (e.g. "LF", "3B"). Overrides player's default position when set. */
  lineupPositionByPlayerId?: Record<string, string | null>;
  /** Player ID to highlight in the table (e.g. current batter in Record PAs). */
  highlightedBatterId?: string | null;
  /** Tighter layout for side panel (smaller text, padding, min-width). */
  compact?: boolean;
  /** Pending stolen bases by batter ID (e.g. from current form before save). Shown in BATTING section immediately. */
  pendingStolenBasesByBatterId?: Record<string, number>;
}

export function GameBattingTable({
  game,
  pas,
  players,
  lineupOrder,
  lineupPositionByPlayerId,
  highlightedBatterId,
  compact = false,
  pendingStolenBasesByBatterId,
}: GameBattingTableProps) {
  const rows = computeGameBatting(
    pas,
    players ?? [],
    lineupOrder,
    lineupPositionByPlayerId
  );
  const rowsWithPending = rows.map((r) => ({
    ...r,
    sb: r.sb + (pendingStolenBasesByBatterId?.[r.playerId] ?? 0),
  }));
  const isHome = game.our_side === "home";
  const teamLabel = isHome ? game.home_team : game.away_team;

  const totals = rowsWithPending.reduce(
    (acc, r) => ({
      ab: acc.ab + r.ab,
      r: acc.r + r.r,
      h: acc.h + r.h,
      rbi: acc.rbi + r.rbi,
      bb: acc.bb + r.bb,
      k: acc.k + r.k,
    }),
    { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, k: 0 }
  );

  const battingNotes = rowsWithPending.filter(
    (r) => r.double > 0 || r.hr > 0 || r.tb > 0 || r.rbi > 0 || r.sb > 0
  );

  if (rowsWithPending.length === 0) {
    return (
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Batters – {teamLabel}
        </h2>
        <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-4 text-sm text-[var(--text-muted)]">
          No plate appearances recorded for this game.
        </p>
      </section>
    );
  }

  return (
    <section className={compact ? "space-y-1" : "space-y-4"}>
      <h2 className={compact ? "text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]" : "text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]"}>
        Batters – {teamLabel}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
        <table className={`w-full border-collapse text-left ${compact ? "min-w-0 text-xs" : "min-w-[520px] text-sm"}`}>
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
              <th className={compact ? "px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]" : "px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"}>
                Player
              </th>
              <th className={compact ? "w-6 px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]" : "w-10 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"}>
                AB
              </th>
              <th className={compact ? "w-6 px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]" : "w-10 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"}>R</th>
              <th className={compact ? "w-6 px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]" : "w-10 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"}>H</th>
              <th className={compact ? "w-6 px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]" : "w-10 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"}>RBI</th>
              <th className={compact ? "w-6 px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]" : "w-10 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"}>BB</th>
              <th className={compact ? "w-6 px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]" : "w-10 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"}>K</th>
              <th className={compact ? "w-8 px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]" : "w-12 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"}>AVG</th>
              <th className={compact ? "w-8 px-1 py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]" : "w-12 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"}>OPS</th>
            </tr>
          </thead>
          <tbody>
            {rowsWithPending.map((row) => (
              <tr
                key={row.playerId}
                className={`border-b border-[var(--border)] ${
                  highlightedBatterId && row.playerId === highlightedBatterId
                    ? "bg-[var(--accent)]/15"
                    : ""
                }`}
              >
                <td className={compact ? "px-1.5 py-1 font-medium text-[var(--text)]" : "px-3 py-2 font-medium text-[var(--text)]"}>
                  {row.position ? `${row.name} ${row.position}` : row.name}
                </td>
                <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{row.ab}</td>
                <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{row.r}</td>
                <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{row.h}</td>
                <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{row.rbi}</td>
                <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{row.bb}</td>
                <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{row.k}</td>
                <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{formatAvgOps(row.avg)}</td>
                <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{formatAvgOps(row.ops)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-[var(--border)] bg-[var(--bg-elevated)] font-medium">
              <td className={compact ? "px-1.5 py-1 text-[var(--text)]" : "px-3 py-2 text-[var(--text)]"}>Totals</td>
              <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{rowsWithPending.reduce((s, r) => s + r.ab, 0)}</td>
              <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{totals.r}</td>
              <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{totals.h}</td>
              <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{totals.rbi}</td>
              <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{totals.bb}</td>
              <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text)]" : "px-2 py-2 text-right tabular-nums text-[var(--text)]"}>{totals.k}</td>
              <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text-muted)]" : "px-2 py-2 text-right tabular-nums text-[var(--text-muted)]"}>—</td>
              <td className={compact ? "px-1 py-1 text-right tabular-nums text-[var(--text-muted)]" : "px-2 py-2 text-right tabular-nums text-[var(--text-muted)]"}>—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {battingNotes.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Batting
          </h3>
          <dl className="space-y-1.5 text-sm text-[var(--text)]">
            {battingNotes.some((r) => r.double > 0) && (
              <div>
                <dt className="inline font-semibold text-[var(--text-muted)]">2B: </dt>
                <dd className="inline">
                  {battingNotes
                    .filter((r) => r.double > 0)
                    .map((r) => `${r.name} ${r.double}`)
                    .join("; ")}
                </dd>
              </div>
            )}
            {battingNotes.some((r) => r.hr > 0) && (
              <div>
                <dt className="inline font-semibold text-[var(--text-muted)]">HR: </dt>
                <dd className="inline">
                  {battingNotes
                    .filter((r) => r.hr > 0)
                    .map((r) => `${r.name} ${r.hr}`)
                    .join("; ")}
                </dd>
              </div>
            )}
            {battingNotes.some((r) => r.tb > 0) && (
              <div>
                <dt className="inline font-semibold text-[var(--text-muted)]">TB: </dt>
                <dd className="inline">
                  {battingNotes
                    .map((r) => (r.tb > 0 ? `${r.name} ${r.tb}` : null))
                    .filter(Boolean)
                    .join("; ")}
                </dd>
              </div>
            )}
            {battingNotes.some((r) => r.rbi > 0) && (
              <div>
                <dt className="inline font-semibold text-[var(--text-muted)]">RBI: </dt>
                <dd className="inline">
                  {battingNotes
                    .filter((r) => r.rbi > 0)
                    .map((r) => `${r.name} ${r.rbi}`)
                    .join("; ")}
                </dd>
              </div>
            )}
            {battingNotes.some((r) => r.sb > 0) && (
              <div>
                <dt className="inline font-semibold text-[var(--text-muted)]">SB: </dt>
                <dd className="inline">
                  {battingNotes
                    .filter((r) => r.sb > 0)
                    .map((r) => `${r.name} ${r.sb}`)
                    .join("; ")}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </section>
  );
}
