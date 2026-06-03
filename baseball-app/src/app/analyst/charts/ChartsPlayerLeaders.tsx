"use client";

import Link from "next/link";
import { fmtDecimalNoLeadingZero } from "@/lib/format";
import type { LeaderSortKey } from "./chartTypes";
import { chartsSelectClass } from "./chartsUi";
import type { PlayerLeaderRow } from "./useChartsDerivedData";

const LEADER_ROWS_PER_COLUMN = 5;
export const LEADER_MAX_PLAYERS = LEADER_ROWS_PER_COLUMN * 2;

type ChartsPlayerLeadersProps = {
  leaders: PlayerLeaderRow[];
  leaderSort: LeaderSortKey;
  controlsDisabled?: boolean;
  onLeaderSortChange: (sort: LeaderSortKey) => void;
};

const LEADER_ROW_GRID =
  "grid grid-cols-[1.3rem_minmax(0,1fr)_repeat(5,2rem)_1.75rem] items-center gap-x-1 gap-y-0.5";

function LeaderRow({ player, rank }: { player: PlayerLeaderRow; rank: number }) {
  return (
    <div className={`${LEADER_ROW_GRID} rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-1.5 py-1 text-xs`}>
      <span className="text-center tabular-nums text-[var(--neo-accent)]">{rank}</span>
      <div className="min-w-0">
        <Link
          href={`/analyst/roster/${player.playerId}`}
          className="charts-player-leader-name block truncate font-medium text-[var(--text)] hover:text-[var(--neo-accent)] hover:underline"
          title={player.name}
        >
          {player.name}
        </Link>
      </div>
      <span className="text-right tabular-nums text-[var(--text-muted)]">
        {fmtDecimalNoLeadingZero(player.avg, 3)}
      </span>
      <span className="text-right tabular-nums text-[var(--text-muted)]">{player.hits}</span>
      <span className="text-right tabular-nums text-[var(--text-muted)]">
        {player.ops != null ? fmtDecimalNoLeadingZero(player.ops, 3) : "—"}
      </span>
      <span className="text-right tabular-nums text-[var(--text-muted)]">{(player.kPct * 100).toFixed(1)}</span>
      <span className="text-right tabular-nums text-[var(--text-muted)]">{(player.bbPct * 100).toFixed(1)}</span>
      <span className="text-right text-sm font-semibold tabular-nums text-[var(--neo-accent)]">{player.pa}</span>
    </div>
  );
}

function LeaderColumnHeader() {
  return (
    <div
      className={`${LEADER_ROW_GRID} px-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-faint)]`}
      aria-hidden
    >
      <span>#</span>
      <span>Player</span>
      <span className="text-right">AVG</span>
      <span className="text-right">H</span>
      <span className="text-right">OPS</span>
      <span className="text-right">K%</span>
      <span className="text-right">BB%</span>
      <span className="text-right">PA</span>
    </div>
  );
}

function splitLeadersIntoColumns(players: PlayerLeaderRow[]): [PlayerLeaderRow[], PlayerLeaderRow[]] {
  const half = Math.ceil(players.length / 2);
  return [players.slice(0, half), players.slice(half)];
}

export function ChartsPlayerLeaders({
  leaders,
  leaderSort,
  controlsDisabled,
  onLeaderSortChange,
}: ChartsPlayerLeadersProps) {
  const visible = leaders.slice(0, LEADER_MAX_PLAYERS);
  const [leftColumn, rightColumn] = splitLeadersIntoColumns(visible);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-3">
      <div className="charts-snapshot-card-header mb-2 flex flex-nowrap items-center justify-between gap-2">
        <div className="charts-snapshot-section-title shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[var(--neo-accent)]">
          Player Leaders
        </div>
        <div className="reports-screen-only flex shrink-0 flex-wrap items-center gap-2 text-[10px]">
          <label className="flex items-center gap-1 text-[var(--text-muted)]">
            Sort
            <select
              disabled={controlsDisabled}
              value={leaderSort}
              onChange={(e) => onLeaderSortChange(e.target.value as LeaderSortKey)}
              className={chartsSelectClass}
            >
              <option value="pa">PA</option>
              <option value="ops">OPS</option>
              <option value="avg">AVG</option>
            </select>
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">No players in this filter.</p>
      ) : (
        <div className="charts-player-leaders-columns grid grid-cols-1 gap-3 md:grid-cols-2">
          {[leftColumn, rightColumn].map((column, colIdx) => (
            <div key={colIdx} className="charts-player-leaders-column min-w-0 space-y-1">
              <LeaderColumnHeader />
              {column.map((p, rowIdx) => {
                const rank = colIdx === 0 ? rowIdx + 1 : leftColumn.length + rowIdx + 1;
                return <LeaderRow key={p.playerId} player={p} rank={rank} />;
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
