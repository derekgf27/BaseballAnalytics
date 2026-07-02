"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import Link from "next/link";
import type { BattingStats, Player } from "@/lib/types";
import type { LineupAggregateRates } from "@/lib/compute/battingStats";
import { fmtDecimalNoLeadingZero, formatPPa } from "@/lib/format";
import { getPlayerPrimaryPosition } from "@/lib/playerRoster";
export type LineupSplitView = "overall" | "vsL" | "vsR" | "risp";

const LINEUP_POSITIONS = [
  "P",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
  "DH",
] as const;

const SLASH_LINE_STATS: { key: "avg" | "obp" | "slg"; label: string }[] = [
  { key: "avg", label: "AVG" },
  { key: "obp", label: "OBP" },
  { key: "slg", label: "SLG" },
];

const BATTING_TAIL_LABELS: { key: keyof BattingStats; label: string; format: "avg" | "int" | "pct" }[] = [
  { key: "kPct", label: "K%", format: "pct" },
  { key: "pPa", label: "P/PA", format: "avg" },
];

function formatLineupBattingCell(
  s: BattingStats | undefined,
  key: keyof BattingStats,
  format: "avg" | "int" | "pct"
): string {
  if (!s) return "—";
  if (key === "pPa") {
    return s.pPa != null && !Number.isNaN(s.pPa) ? formatPPa(s.pPa) : "—";
  }
  if (format === "pct") {
    const v = s[key];
    if (typeof v !== "number" || Number.isNaN(v)) return "—";
    return `${(v * 100).toFixed(1)}%`;
  }
  return fmtDecimalNoLeadingZero(Number(s[key]) || 0, 3);
}

function formatStat(value: number, format: "avg" | "int"): string {
  if (format === "int") return String(value);
  return fmtDecimalNoLeadingZero(value, 3);
}

function batsShort(bats: string | null | undefined): string {
  if (bats == null || bats === "") return "—";
  const c = bats.toUpperCase()[0];
  return c === "S" ? "S" : c === "L" ? "L" : c === "R" ? "R" : bats;
}

export type PoolSortKey = "name" | "obp" | "ops" | "avg";

export type RosterTableRow = {
  player: Player;
  spot: number | null;
  position: string;
  inLineup: boolean;
};

type LineupAggregateDisplayKey = keyof LineupAggregateRates;

function formatAggregateStat(q: LineupAggregateRates, key: LineupAggregateDisplayKey): string {
  if (key === "kPct" || key === "bbPct") {
    const v = q[key];
    return v != null && !Number.isNaN(v) ? `${(v * 100).toFixed(1)}%` : "—";
  }
  if (key === "pPa") {
    return q.pPa != null && !Number.isNaN(q.pPa) ? formatPPa(q.pPa) : "—";
  }
  if (key === "opsPlus") {
    return q.opsPlus != null && !Number.isNaN(q.opsPlus) ? String(Math.round(q.opsPlus)) : "—";
  }
  if (key === "bbPerK") {
    return q.bbPerK != null && !Number.isNaN(q.bbPerK) ? q.bbPerK.toFixed(2) : "—";
  }
  const v = q[key];
  return typeof v === "number" && !Number.isNaN(v) ? formatStat(v, "avg") : "—";
}

const LINEUP_AGGREGATE_STATS: { key: LineupAggregateDisplayKey; label: string }[] = [
  { key: "avg", label: "AVG" },
  { key: "obp", label: "OBP" },
  { key: "slg", label: "SLG" },
  { key: "ops", label: "OPS" },
  { key: "opsPlus", label: "OPS+" },
  { key: "bbPct", label: "BB%" },
  { key: "kPct", label: "K%" },
  { key: "bbPerK", label: "BB/K" },
  { key: "pPa", label: "P/PA" },
];

export function LineupCollectiveStatsBar({
  lineupQuality,
  embedded = false,
}: {
  lineupQuality: LineupAggregateRates | null;
  /** Inside game card: no outer border; stats align to the right on wide screens. */
  embedded?: boolean;
}) {
  const statsSize = embedded ? "text-sm" : "text-xs";

  return (
    <div
      className={
        embedded
          ? "flex min-w-0 flex-1 flex-col gap-3 lg:border-l lg:border-[var(--neo-border)] lg:pl-6"
          : "shrink-0 rounded-lg border border-[var(--neo-border)] bg-[var(--bg-card)] px-3 py-2.5"
      }
    >
      <div className="flex flex-col gap-2">
        <p className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--neo-accent)] md:text-base">
          Lineup stats
        </p>
        {lineupQuality == null ? (
          <span className={`${statsSize} text-[var(--neo-text-muted)]`}>
            Add players to see combined rates
          </span>
        ) : (
          <div
            className={`flex flex-wrap items-baseline tabular-nums text-[var(--neo-text)] ${statsSize} gap-x-3 gap-y-1`}
          >
            {LINEUP_AGGREGATE_STATS.map(({ key, label }, i) => (
              <span key={key} className="contents">
                {i > 0 ? <span className="text-[var(--neo-border)]">·</span> : null}
                <span>
                  {label}{" "}
                  <strong className="text-[var(--neo-accent)]">
                    {formatAggregateStat(lineupQuality, key)}
                  </strong>
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DraggablePoolChip({
  player,
  onAdd,
}: {
  player: Player;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
    data: { player },
  });
  const pos = getPlayerPrimaryPosition(player) ?? "—";

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={onAdd}
      className={`w-full touch-none select-none rounded border border-[var(--neo-border)] bg-[var(--bg-elevated)] px-3 py-2 text-left text-sm leading-snug text-[var(--neo-text)] transition hover:border-[var(--neo-accent)]/50 hover:bg-[var(--neo-accent-dim)] active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
      title={`Add ${player.name} to lineup`}
    >
      <span className="block truncate font-medium">{player.name}</span>
      <span className="mt-0.5 block text-xs text-[var(--neo-text-muted)]">
        {pos} · {batsShort(player.bats)}
      </span>
    </button>
  );
}

export function AvailablePlayerGrid({
  players,
  onAddPlayer,
}: {
  players: Player[];
  onAddPlayer: (player: Player) => void;
}) {
  if (players.length === 0) {
    return (
      <p className="text-center text-[11px] text-[var(--neo-text-muted)]">
        All players are in the lineup.{" "}
        <Link href="/analyst/roster" className="text-[var(--neo-accent)] hover:underline">
          Roster
        </Link>
      </p>
    );
  }

  return (
    <ul className="grid list-none grid-cols-1 gap-1.5 p-0 sm:grid-cols-2" aria-label="Available players">
      {players.map((player) => (
        <li key={player.id}>
          <DraggablePoolChip player={player} onAdd={() => onAddPlayer(player)} />
        </li>
      ))}
    </ul>
  );
}

export function PlayerPoolDropZone({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "player-pool" });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[12rem] flex-col rounded-lg border border-dashed border-[var(--neo-border)] bg-[var(--bg-input)]/80 p-3 transition lg:min-h-0 ${className} ${
        isOver ? "border-[var(--neo-accent)] bg-[var(--neo-accent-dim)]" : ""
      }`}
    >
      <p className="mb-2 shrink-0 text-[10px] uppercase tracking-wider text-[var(--neo-text-muted)]">
        Drop here to remove from lineup
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function DraggableLineupName({ player }: { player: Player }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
    data: { player },
  });
  return (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab touch-none select-none font-medium active:cursor-grabbing ${isDragging ? "opacity-50" : ""}`}
    >
      {player.name}
    </span>
  );
}

const LINEUP_ROW_GRID =
  "grid grid-cols-[2.75rem_minmax(3.25rem,4rem)_minmax(0,1fr)_2rem] items-center";

export function LineupOrderPanel({
  lineup,
  loading,
  positionsTakenByOthers,
  onPositionChange,
  duplicatePositions,
  className = "",
}: {
  lineup: { player: Player | null; position: string }[];
  loading: boolean;
  positionsTakenByOthers: (slotIndex: number) => Set<string>;
  onPositionChange: (slotIndex: number, position: string) => void;
  duplicatePositions: string[];
  className?: string;
}) {
  if (loading) {
    return (
      <p className={`py-4 text-center text-xs text-[var(--neo-text-muted)] ${className}`}>
        Loading lineup…
      </p>
    );
  }

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      {duplicatePositions.length > 0 ? (
        <p className="mb-2 shrink-0 rounded border border-[var(--warning)]/40 bg-[var(--warning-dim)] px-2 py-1 text-[10px] text-[var(--warning)]">
          Duplicate: {duplicatePositions.join(", ")}
        </p>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--neo-border)]">
        <div
          className={`${LINEUP_ROW_GRID} shrink-0 border-b border-[var(--neo-border)] bg-[var(--bg-elevated)] text-[10px] font-medium uppercase text-[var(--neo-text-muted)]`}
        >
          <div className="px-1 py-1.5 text-center">#</div>
          <div className="py-1.5 text-center">Pos</div>
          <div className="px-2 py-1.5">Player</div>
          <div className="py-1.5 text-center">B</div>
        </div>
        <div className="grid min-h-0 flex-1 grid-rows-9">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
            const slot = lineup[i];
            const player = slot?.player ?? null;
            const taken = positionsTakenByOthers(i);
            return (
              <LineupSlotRow
                key={i}
                slotIndex={i}
                player={player}
                position={slot?.position ?? ""}
                positionsTakenByOthers={taken}
                onPositionChange={onPositionChange}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LineupSlotRow({
  slotIndex,
  player,
  position,
  positionsTakenByOthers,
  onPositionChange,
}: {
  slotIndex: number;
  player: Player | null;
  position: string;
  positionsTakenByOthers: Set<string>;
  onPositionChange: (slotIndex: number, position: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${slotIndex}` });

  return (
    <div
      ref={setNodeRef}
      className={`${LINEUP_ROW_GRID} min-h-0 border-b border-[var(--neo-border)] last:border-0 ${
        isOver ? "bg-[var(--neo-accent-dim)]" : slotIndex % 2 === 0 ? "bg-[var(--bg-card)]" : "bg-[var(--bg-elevated)]"
      }`}
    >
      <div className="flex h-full items-center justify-center px-1">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--neo-accent)] text-[10px] font-bold text-[var(--bg-base)]">
          {slotIndex + 1}
        </span>
      </div>
      <div className="flex h-full items-center justify-center px-0.5">
        {player ? (
          <select
            value={position && LINEUP_POSITIONS.includes(position as (typeof LINEUP_POSITIONS)[number]) ? position : LINEUP_POSITIONS[0]}
            onChange={(e) => onPositionChange(slotIndex, e.target.value)}
            className="w-full min-w-0 rounded border border-[var(--neo-border)] bg-[var(--bg-input)] px-0.5 py-1 text-center text-[10px] text-[var(--neo-text)]"
            aria-label={`Position slot ${slotIndex + 1}`}
          >
            {LINEUP_POSITIONS.map((pos) => (
              <option key={pos} value={pos} disabled={positionsTakenByOthers.has(pos)}>
                {pos}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[var(--text-faint)]">—</span>
        )}
      </div>
      <div className="flex h-full min-w-0 items-center px-2">
        {player ? (
          <DraggableLineupName player={player} />
        ) : (
          <span className="text-[var(--text-faint)]">Empty</span>
        )}
      </div>
      <div className="flex h-full items-center justify-center text-center text-xs font-semibold text-[var(--neo-text)]">
        {player ? batsShort(player.bats) : "—"}
      </div>
    </div>
  );
}

const ROSTER_STATS_GRID =
  "grid grid-cols-[2.25rem_2.75rem_minmax(0,1.2fr)_3rem_3rem_3rem_3.25rem_3.25rem_3.25rem] items-center";

const ROSTER_STAT_HEADER_CLASS =
  "font-display text-[11px] font-semibold uppercase tracking-wider text-[var(--neo-accent)]";

export function UnifiedRosterStatsTable({
  rows,
  statsMap,
  onAddPlayer,
  onRemovePlayer,
}: {
  rows: RosterTableRow[];
  statsMap: Record<string, BattingStats>;
  onAddPlayer: (player: Player) => void;
  onRemovePlayer: (playerId: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--neo-border)] bg-[var(--bg-card)]">
      <div
        className={`${ROSTER_STATS_GRID} shrink-0 border-b border-[var(--neo-border)] bg-[var(--bg-elevated)]`}
      >
        <div className="py-2.5 pl-2 pr-1 text-center text-[11px] font-medium uppercase tracking-wide text-[var(--neo-text-muted)]">
          #
        </div>
        <div className="px-1 py-2.5 text-center text-[11px] font-medium uppercase tracking-wide text-[var(--neo-text-muted)]">
          Pos
        </div>
        <div className="px-2 py-2.5 text-[11px] font-medium uppercase tracking-wide text-[var(--neo-text-muted)]">
          Player
        </div>
        {SLASH_LINE_STATS.map(({ label }) => (
          <div key={label} className={`px-1 py-2.5 text-center ${ROSTER_STAT_HEADER_CLASS}`}>
            {label}
          </div>
        ))}
        <div className={`px-1 py-2.5 text-center ${ROSTER_STAT_HEADER_CLASS}`}>OPS</div>
        {BATTING_TAIL_LABELS.map(({ label }) => (
          <div key={label} className={`px-1 py-2.5 text-center ${ROSTER_STAT_HEADER_CLASS}`}>
            {label}
          </div>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-8 text-sm text-[var(--neo-text-muted)]">
          No players on roster.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            className="grid min-h-full divide-y divide-[var(--neo-border)]/60"
            style={{ gridTemplateRows: `repeat(${rows.length}, minmax(2.5rem, 1fr))` }}
          >
          {rows.map(({ player, spot, position, inLineup }) => {
            const s = statsMap[player.id];
            return (
              <div
                key={player.id}
                className={`${ROSTER_STATS_GRID} min-h-0 text-sm ${
                  inLineup ? "bg-[var(--neo-accent-dim)]/35" : "hover:bg-[var(--bg-elevated)]"
                }`}
              >
                <div className="flex h-full items-center justify-center pl-2 pr-1 text-center text-base font-semibold tabular-nums text-[var(--neo-accent)]">
                  {spot ?? "—"}
                </div>
                <div className="flex h-full items-center justify-center px-1 text-center text-[var(--text-muted)]">
                  {inLineup ? position || "—" : "—"}
                </div>
                <div className="flex h-full min-w-0 items-center px-2">
                  <button
                    type="button"
                    onClick={() => (inLineup ? onRemovePlayer(player.id) : onAddPlayer(player))}
                    className="truncate text-left text-[15px] font-medium leading-snug text-[var(--neo-accent)] hover:underline"
                    title={inLineup ? "Remove from lineup" : "Add to next open spot"}
                  >
                    {player.name}
                    {player.jersey ? (
                      <span className="ml-1.5 text-sm font-normal text-[var(--text-muted)]">#{player.jersey}</span>
                    ) : null}
                  </button>
                </div>
                {SLASH_LINE_STATS.map(({ key }) => (
                  <div
                    key={key}
                    className="flex h-full items-center justify-center px-1 text-center text-[15px] tabular-nums text-[var(--text)]"
                  >
                    {formatLineupBattingCell(s, key, "avg")}
                  </div>
                ))}
                <div className="flex h-full items-center justify-center px-1 text-center text-[15px] tabular-nums text-[var(--text)]">
                  {formatLineupBattingCell(s, "ops", "avg")}
                </div>
                {BATTING_TAIL_LABELS.map(({ key, format }) => (
                  <div
                    key={key}
                    className="flex h-full items-center justify-center px-1 text-center text-[15px] tabular-nums text-[var(--text)]"
                  >
                    {formatLineupBattingCell(s, key, format)}
                  </div>
                ))}
              </div>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}

export function RosterStatsControls({
  poolSortBy,
  poolSplitView,
  onSortChange,
  onSplitChange,
}: {
  poolSortBy: PoolSortKey;
  poolSplitView: LineupSplitView;
  onSortChange: (v: PoolSortKey) => void;
  onSplitChange: (v: LineupSplitView) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-1.5 text-xs text-[var(--neo-text-muted)]">
        Sort
        <select
          value={poolSortBy}
          onChange={(e) => onSortChange(e.target.value as PoolSortKey)}
          className="input-tech rounded border border-[var(--neo-border)] bg-[var(--neo-bg-base)] px-2.5 py-1.5 text-sm text-[var(--neo-text)]"
          aria-label="Sort roster by stat"
        >
          <option value="name">Name</option>
          <option value="obp">OBP</option>
          <option value="ops">OPS</option>
          <option value="avg">AVG</option>
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-xs text-[var(--neo-text-muted)]">
        Split
        <select
          value={poolSplitView}
          onChange={(e) => onSplitChange(e.target.value as LineupSplitView)}
          className="input-tech rounded border border-[var(--neo-border)] bg-[var(--neo-bg-base)] px-2.5 py-1.5 text-sm text-[var(--neo-text)]"
          aria-label="Stat split"
        >
          <option value="overall">Overall</option>
          <option value="vsL">vs LHP</option>
          <option value="vsR">vs RHP</option>
        </select>
      </label>
    </div>
  );
}

export function LineupSaveActions({
  gameMode,
  templateName = "",
  onTemplateNameChange,
  onSave,
  onClear,
  saveStatus,
  saveErrorMessage,
  hasAnyPlayerInLineup,
  saveDisabled,
}: {
  gameMode: boolean;
  templateName?: string;
  onTemplateNameChange: (v: string) => void;
  onSave: () => void;
  onClear: () => void;
  saveStatus: "idle" | "saving" | "ok" | "err";
  saveErrorMessage: string | null;
  hasAnyPlayerInLineup: boolean;
  saveDisabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!gameMode ? (
        <input
          type="text"
          value={templateName ?? ""}
          onChange={(e) => onTemplateNameChange(e.target.value)}
          placeholder="Template name"
          className="input-tech w-32 px-2 py-1 text-xs"
          aria-label="Template name"
        />
      ) : null}
      <button
        type="button"
        onClick={onSave}
        disabled={saveDisabled || !hasAnyPlayerInLineup || saveStatus === "saving"}
        className="rounded-lg bg-[var(--neo-accent)] px-2.5 py-1 text-xs font-medium text-[var(--bg-base)] disabled:opacity-50"
      >
        {saveStatus === "saving" ? "Saving…" : "Save"}
      </button>
      {saveStatus === "ok" ? <span className="text-xs text-[var(--neo-success)]">Saved</span> : null}
      {saveStatus === "err" ? (
        <span className="text-xs text-[var(--danger)]" title={saveErrorMessage ?? undefined}>
          {saveErrorMessage ?? "Save failed"}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onClear}
        disabled={!hasAnyPlayerInLineup || saveStatus === "saving"}
        className="rounded-lg border border-[var(--neo-border)] px-2.5 py-1 text-xs text-[var(--neo-text-muted)] hover:text-[var(--neo-text)] disabled:opacity-50"
      >
        Clear
      </button>
    </div>
  );
}

export function LineupFooterTools({
  onSuggestObp,
  onSuggestAvg,
  suggestDisabled,
  initialSavedLineups,
  loadStatus,
  onLoadTemplate,
  onDeleteTemplate,
}: {
  onSuggestObp: () => void;
  onSuggestAvg: () => void;
  suggestDisabled: boolean;
  initialSavedLineups: { id: string; name: string }[];
  loadStatus: "idle" | "loading";
  onLoadTemplate: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
}) {
  return (
    <section className="shrink-0 neo-card p-3">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0">
          <div className="section-label">Optimization</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSuggestObp}
              disabled={suggestDisabled}
              className="rounded-lg border border-[var(--neo-accent)]/50 bg-[var(--neo-accent-dim)] px-2.5 py-1 text-xs font-medium text-[var(--neo-accent)] disabled:opacity-50"
            >
              Suggest OBP
            </button>
            <button
              type="button"
              onClick={onSuggestAvg}
              disabled={suggestDisabled}
              className="rounded-lg border border-[var(--neo-accent)]/50 bg-[var(--neo-accent-dim)] px-2.5 py-1 text-xs font-medium text-[var(--neo-accent)] disabled:opacity-50"
            >
              Suggest AVG
            </button>
          </div>
        </div>
        {initialSavedLineups.length > 0 ? (
          <div className="min-w-0 flex-1 border-l border-[var(--neo-border)] pl-4">
            <div className="section-label">Templates</div>
            <ul className="mt-2 flex flex-wrap gap-2" role="list">
              {initialSavedLineups.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center gap-2 rounded border border-[var(--neo-border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs"
                >
                  <span className="font-medium text-[var(--neo-text)]">{l.name}</span>
                  <button
                    type="button"
                    onClick={() => onLoadTemplate(l.id)}
                    disabled={loadStatus === "loading"}
                    className="text-[var(--neo-accent)] hover:underline disabled:opacity-50"
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTemplate(l.id)}
                    className="text-[var(--danger)] hover:underline"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
