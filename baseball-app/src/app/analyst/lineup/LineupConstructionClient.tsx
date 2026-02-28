"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import type { BattingStats, BattingStatsWithSplits, Player, SavedLineup } from "@/lib/types";

export type LineupSplitView = "overall" | "vsL" | "vsR";
import { fetchSavedLineupWithSlots, saveLineupTemplate, deleteSavedLineup } from "./actions";

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

type LineupSlotState = { player: Player | null; position: string };

const BATTING_STAT_LABELS: { key: keyof BattingStats; label: string; format: "avg" | "int" }[] = [
  { key: "avg", label: "AVG", format: "avg" },
  { key: "obp", label: "OBP", format: "avg" },
  { key: "slg", label: "SLG", format: "avg" },
  { key: "ops", label: "OPS", format: "avg" },
  { key: "opsPlus", label: "OPS+", format: "int" },
  { key: "woba", label: "wOBA", format: "avg" },
];

function formatStat(value: number, format: "avg" | "int"): string {
  if (format === "int") return String(value);
  const s = value.toFixed(3);
  return s.startsWith("0.") ? s.slice(1) : s;
}

type PoolSortKey = "name" | "obp" | "woba" | "ops" | "avg";

function getStatValue(statsMap: Record<string, BattingStats>, playerId: string, key: PoolSortKey): number {
  if (key === "name") return 0;
  const s = statsMap[playerId];
  if (!s) return -1;
  const v = (s as unknown as Record<string, unknown>)[key];
  return typeof v === "number" ? v : -1;
}

/** Suggest batting order: fill 9 slots with best 9 by stat (or reorder current 9). */
function suggestOrder(
  players: Player[],
  statsMap: Record<string, BattingStats>,
  stat: "obp" | "woba"
): { player: Player; position: string }[] {
  const key = stat;
  const withStat = players.map((p) => ({
    player: p,
    value: getStatValue(statsMap, p.id, key),
  }));
  withStat.sort((a, b) => b.value - a.value);
  const top9 = withStat.slice(0, 9).map(({ player }) => player);
  return top9.map((player) => {
    const primary = player.positions?.[0];
    const position =
      primary && LINEUP_POSITIONS.includes(primary as (typeof LINEUP_POSITIONS)[number]) ? primary : "DH";
    return { player, position };
  });
}

interface LineupConstructionClientProps {
  initialPlayers: Player[];
  initialBattingStatsWithSplits: Record<string, BattingStatsWithSplits>;
  initialSavedLineups: SavedLineup[];
}

function getStatsForLineupSplit(splits: Record<string, BattingStatsWithSplits>, playerId: string, split: LineupSplitView): BattingStats | undefined {
  const s = splits[playerId];
  if (!s) return undefined;
  if (split === "overall") return s.overall;
  if (split === "vsL") return s.vsL ?? undefined;
  return s.vsR ?? undefined;
}

const batsLabel: Record<string, string> = { L: "Left", R: "Right", S: "Switch" };
const throwsLabel: Record<string, string> = { L: "Left", R: "Right" };

function formatHandedness(bats: string | null | undefined, throws: string | null | undefined): string {
  const b = bats != null && bats !== "" ? batsLabel[bats] ?? bats : "—";
  const t = throws != null && throws !== "" ? throwsLabel[throws] ?? throws : "—";
  return `Bats: ${b} · Throws: ${t}`;
}

function PlayerCard({
  player,
  isDragging,
  compact,
}: {
  player: Player;
  isDragging?: boolean;
  /** Inline one-line display for lineup slots so all 9 fit on screen */
  compact?: boolean;
}) {
  const position = player.positions?.[0] ?? "—";
  const handedness = formatHandedness(player.bats, player.throws);
  if (compact) {
    return (
      <div
        className={`flex cursor-grab items-center gap-2 active:cursor-grabbing ${
          isDragging ? "opacity-50" : ""
        }`}
      >
        <span className="truncate text-base font-medium text-[var(--text)]">{player.name}</span>
        {player.jersey && (
          <span className="shrink-0 text-sm text-[var(--text-muted)]">#{player.jersey}</span>
        )}
      </div>
    );
  }
  return (
    <div
      className={`card-tech flex cursor-grab items-center gap-3 rounded-lg border p-3 active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[var(--text)]">{player.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
          {player.jersey && <span>#{player.jersey}</span>}
          <span>{position}</span>
          <span className="font-semibold text-[var(--text)]">{handedness}</span>
        </div>
      </div>
    </div>
  );
}

function DraggablePlayer({ player, compact }: { player: Player; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
    data: { player },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={compact ? "min-w-0 flex-1" : undefined}>
      <PlayerCard player={player} isDragging={isDragging} compact={compact} />
    </div>
  );
}

function batsShort(bats: string | null | undefined): string {
  if (bats == null || bats === "") return "—";
  return bats === "S" ? "S" : bats === "L" ? "L" : bats === "R" ? "R" : bats;
}

function LineupTableRow({
  slotIndex,
  player,
  position,
  positionsTakenByOthers,
  onPositionChange,
  rowStriped,
}: {
  slotIndex: number;
  player: Player | null;
  position: string;
  positionsTakenByOthers: Set<string>;
  onPositionChange: (slotIndex: number, value: string) => void;
  rowStriped: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${slotIndex}` });

  return (
    <tr
      ref={setNodeRef}
      className={`border-b border-[var(--border)] transition ${
        isOver ? "bg-[var(--accent-dim)]" : rowStriped ? "bg-[var(--bg-card)]" : "bg-[var(--bg-elevated)]"
      }`}
    >
      <td className="w-12 border-r border-[var(--border)] px-3 py-2 text-center">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-[var(--accent)] text-sm font-bold text-[var(--bg-base)]">
          {slotIndex + 1}
        </span>
      </td>
      <td className="min-w-[5.5rem] w-24 border-r border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-2 text-center">
        {player ? (
          <select
            value={position || LINEUP_POSITIONS[0]}
            onChange={(e) => onPositionChange(slotIndex, e.target.value)}
            className="min-w-[3rem] w-full rounded border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1 text-center text-sm font-medium text-[var(--text)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            aria-label={`Position for slot ${slotIndex + 1}`}
          >
            {LINEUP_POSITIONS.map((pos) => (
              <option key={pos} value={pos} disabled={positionsTakenByOthers.has(pos)}>
                {pos}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-[var(--text-faint)]">—</span>
        )}
      </td>
      <td className="min-w-0 px-3 py-2">
        {player ? (
          <DraggablePlayer player={player} compact />
        ) : (
          <span className="text-sm text-[var(--text-faint)]">Drop player here</span>
        )}
      </td>
      <td className="w-12 border-l border-[var(--border)] px-3 py-2 text-center text-sm font-semibold text-[var(--text)]">
        {player ? batsShort(player.bats) : "—"}
      </td>
    </tr>
  );
}

function PlayerPoolDroppable({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "player-pool" });
  return (
    <div
      ref={setNodeRef}
      className={`transition-opacity ${isOver ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)] rounded-lg" : ""}`}
    >
      {children}
    </div>
  );
}

function PlayerStatsTable({
  players,
  statsMap,
  emptyMessage,
  showSpot,
}: {
  players: Player[];
  statsMap: Record<string, BattingStats>;
  emptyMessage: string;
  showSpot?: boolean;
}) {
  if (players.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-[var(--text-faint)]">{emptyMessage}</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
            {showSpot && (
              <th className="py-1.5 pr-2 text-center text-xs font-semibold uppercase">#</th>
            )}
            <th className="py-1.5 pr-2 text-xs font-semibold uppercase">Player</th>
            {BATTING_STAT_LABELS.map(({ key, label }) => (
              <th key={key} className="py-1.5 px-2 text-center text-xs font-semibold uppercase">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => {
            const s = statsMap[player.id];
            return (
              <tr key={player.id} className="border-b border-[var(--border)] last:border-0">
                {showSpot && (
                  <td className="py-1.5 pr-2 text-center text-[var(--text-muted)]">
                    {index + 1}
                  </td>
                )}
                <td className="py-1.5 pr-2 font-medium text-[var(--text)]">
                  {player.name}
                  {player.jersey && (
                    <span className="ml-1 text-[var(--text-muted)]">#{player.jersey}</span>
                  )}
                </td>
                {BATTING_STAT_LABELS.map(({ key, format }) => (
                  <td key={key} className="py-1.5 px-2 text-center text-[var(--text)] tabular-nums">
                    {s ? formatStat(Number(s[key]) || 0, format) : "—"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function LineupConstructionClient({
  initialPlayers,
  initialBattingStatsWithSplits,
  initialSavedLineups = [],
}: LineupConstructionClientProps) {
  const router = useRouter();
  const [lineupSplitView, setLineupSplitView] = useState<LineupSplitView>("overall");
  const [lineup, setLineup] = useState<LineupSlotState[]>(() =>
    Array.from({ length: 9 }, () => ({ player: null, position: "" }))
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading">("idle");
  const [poolSortBy, setPoolSortBy] = useState<PoolSortKey>("name");

  const initialBattingStats: Record<string, BattingStats> = {};
  for (const p of initialPlayers) {
    const s = getStatsForLineupSplit(initialBattingStatsWithSplits, p.id, lineupSplitView);
    if (s) initialBattingStats[p.id] = s;
  }

  useEffect(() => {
    if (saveStatus !== "ok") return;
    const t = setTimeout(() => setSaveStatus("idle"), 2500);
    return () => clearTimeout(t);
  }, [saveStatus]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const inLineupIds = new Set(
    lineup.filter((s) => s.player != null).map((s) => s.player!.id)
  );
  const availablePlayers = initialPlayers.filter((p) => !inLineupIds.has(p.id));
  const sortedAvailablePlayers = [...availablePlayers].sort((a, b) => {
    if (poolSortBy === "name") return (a.name ?? "").localeCompare(b.name ?? "");
    const va = getStatValue(initialBattingStats, a.id, poolSortBy);
    const vb = getStatValue(initialBattingStats, b.id, poolSortBy);
    return vb - va;
  });

  const lineupPlayers = lineup.map((s) => s.player).filter((p): p is Player => p != null);
  const lineupQuality =
    lineupPlayers.length === 9
      ? {
          obp:
            lineupPlayers.reduce(
              (s, p) => s + Math.max(0, getStatValue(initialBattingStats, p.id, "obp")),
              0
            ) / 9,
          woba:
            lineupPlayers.reduce(
              (s, p) => s + Math.max(0, getStatValue(initialBattingStats, p.id, "woba")),
              0
            ) / 9,
        }
      : null;

  function handleSuggestBy(stat: "obp" | "woba") {
    const nine =
      lineupPlayers.length === 9 ? lineupPlayers : [...lineupPlayers, ...availablePlayers].slice(0, 9);
    if (nine.length === 0) return;
    const ordered = suggestOrder(nine, initialBattingStats, stat);
    const padded: LineupSlotState[] = Array.from({ length: 9 }, (_, i) =>
      ordered[i] ? { player: ordered[i].player, position: ordered[i].position } : { player: null, position: "" }
    );
    setLineup(padded);
  }

  function setSlotPosition(slotIndex: number, position: string) {
    setLineup((prev) => {
      const next = [...prev];
      next[slotIndex] = { ...next[slotIndex], position };
      return next;
    });
  }

  function clearLineup() {
    setLineup(Array.from({ length: 9 }, () => ({ player: null, position: "" })));
  }

  const hasAnyPlayerInLineup = lineup.some((s) => s.player != null);

  async function handleSaveTemplate() {
    const name = templateName.trim();
    if (!name || !hasAnyPlayerInLineup) return;
    setSaveStatus("saving");
    setSaveErrorMessage(null);
    const slots = lineup
      .map((s, i) => (s.player ? { slot: i + 1, player_id: s.player.id, position: s.position || null } : null))
      .filter((s): s is { slot: number; player_id: string; position: string | null } => s != null);
    const res = await saveLineupTemplate(name, slots);
    setSaveStatus(res.ok ? "ok" : "err");
    if (res.error) setSaveErrorMessage(res.error);
    if (res.ok) {
      setTemplateName("");
      router.refresh();
    }
  }

  async function handleLoadTemplate(lineupId: string) {
    setLoadStatus("loading");
    const saved = await fetchSavedLineupWithSlots(lineupId);
    setLoadStatus("idle");
    if (!saved?.slots?.length) return;
    const playerMap = new Map(initialPlayers.map((p) => [p.id, p]));
    const ordered = [...saved.slots].sort((a, b) => a.slot - b.slot);
    const newLineup: LineupSlotState[] = Array.from({ length: 9 }, () => ({ player: null, position: "" }));
    for (const s of ordered) {
      if (s.slot >= 1 && s.slot <= 9) {
        const player = playerMap.get(s.player_id) ?? null;
        newLineup[s.slot - 1] = { player, position: s.position ?? "" };
      }
    }
    setLineup(newLineup);
  }

  async function handleDeleteTemplate(id: string) {
    await deleteSavedLineup(id);
    router.refresh();
  }

  const activePlayer = activeId
    ? initialPlayers.find((p) => p.id === activeId) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const overId = String(over.id);
    const playerId = String(active.id);
    const player = initialPlayers.find((p) => p.id === playerId);
    if (!player) return;

    // Return to player pool: drop on the left column
    if (overId === "player-pool") {
      const currentSlot = lineup.findIndex((s) => s.player?.id === playerId);
      if (currentSlot < 0) return;
      setLineup((prev) => {
        const next = prev.map((s) => ({ ...s }));
        next[currentSlot] = { player: null, position: "" };
        return next;
      });
      return;
    }

    if (!overId.startsWith("slot-")) return;

    const slotIndex = parseInt(overId.replace("slot-", ""), 10);
    if (slotIndex < 0 || slotIndex > 8) return;

    const currentSlot = lineup.findIndex((s) => s.player?.id === playerId);
    const displacedSlot = lineup[slotIndex];

    const primaryPosition = player.positions?.[0];
    const defaultPosition =
      primaryPosition && LINEUP_POSITIONS.includes(primaryPosition as (typeof LINEUP_POSITIONS)[number])
        ? primaryPosition
        : "DH";

    setLineup((prev) => {
      const next = prev.map((s) => ({ ...s }));
      next[slotIndex] = {
        player,
        position: defaultPosition,
      };
      if (currentSlot >= 0) {
        next[currentSlot] = {
          player: displacedSlot.player,
          position: displacedSlot.position,
        };
      }
      return next;
    });
  }

  return (
    <div className="space-y-6 pb-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          Lineup construction
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Drag players from the roster into the lineup slots (1–9).
        </p>
      </header>

      {/* Lineup templates: load / delete — at top so users can pick a template first */}
      <section className="card-tech rounded-lg border border-[var(--border)] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Lineup templates
        </h2>
        <p className="mt-1 text-xs text-[var(--text-faint)]">
          Load a saved template into the batting order below, or delete one.
        </p>
        {initialSavedLineups.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              Saved templates
            </h3>
            <ul className="flex flex-wrap gap-3" role="list">
              {initialSavedLineups.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3"
                >
                  <span className="font-medium text-[var(--text)]">{l.name}</span>
                  <button
                    type="button"
                    onClick={() => handleLoadTemplate(l.id)}
                    disabled={loadStatus === "loading"}
                    className="text-sm text-[var(--accent)] hover:underline disabled:opacity-50"
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTemplate(l.id)}
                    className="text-sm text-[var(--text-muted)] hover:text-[var(--danger)]"
                    aria-label={`Delete ${l.name}`}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Lineup optimization: suggest order, lineup quality, split */}
      <section className="card-tech rounded-lg border border-[var(--border)] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Lineup optimization
        </h2>
        <p className="mt-1 text-xs text-[var(--text-faint)]">
          Use stats to suggest a batting order, or sort the pool by a stat when building manually. Choose a split to optimize vs LHP or vs RHP.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>Stats</span>
            <select
              value={lineupSplitView}
              onChange={(e) => setLineupSplitView(e.target.value as LineupSplitView)}
              className="rounded border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
              aria-label="Batting split for lineup stats"
            >
              <option value="overall">Overall</option>
              <option value="vsL">vs LHP</option>
              <option value="vsR">vs RHP</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => handleSuggestBy("obp")}
            disabled={initialPlayers.length === 0}
            className="rounded-lg border border-[var(--accent)]/50 bg-[var(--accent-dim)] px-3 py-1.5 text-sm font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/20 disabled:opacity-50 disabled:pointer-events-none"
          >
            Suggest by OBP
          </button>
          <button
            type="button"
            onClick={() => handleSuggestBy("woba")}
            disabled={initialPlayers.length === 0}
            className="rounded-lg border border-[var(--accent)]/50 bg-[var(--accent-dim)] px-3 py-1.5 text-sm font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/20 disabled:opacity-50 disabled:pointer-events-none"
          >
            Suggest by wOBA
          </button>
          {lineupQuality != null && (
            <span className="text-sm text-[var(--text-muted)]">
              Lineup avg OBP: <strong className="text-[var(--text)]">{formatStat(lineupQuality.obp, "avg")}</strong>
              {" · "}
              Avg wOBA: <strong className="text-[var(--text)]">{formatStat(lineupQuality.woba, "avg")}</strong>
            </span>
          )}
        </div>
      </section>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Available players (droppable to return players from lineup) */}
          <PlayerPoolDroppable>
            <div className="card-tech rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Available players
                </h2>
                <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span>Sort by</span>
                  <select
                    value={poolSortBy}
                    onChange={(e) => setPoolSortBy(e.target.value as PoolSortKey)}
                    className="input-tech rounded border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1 text-[var(--text)]"
                    aria-label="Sort pool by stat"
                  >
                    <option value="name">Name</option>
                    <option value="obp">OBP</option>
                    <option value="woba">wOBA</option>
                    <option value="ops">OPS</option>
                    <option value="avg">AVG</option>
                  </select>
                </label>
              </div>
              <p className="mt-1 text-xs text-[var(--text-faint)]">
                Drag players here to return them to the pool.
              </p>
              <ul className="mt-3 space-y-2" role="list">
                {sortedAvailablePlayers.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-[var(--border)] py-6 text-center text-sm text-[var(--text-muted)]">
                    All players are in the lineup or no players yet.{" "}
                    <Link href="/analyst/players" className="text-[var(--accent)] hover:underline">
                      Add players
                    </Link>
                  </li>
                ) : (
                  sortedAvailablePlayers.map((player) => (
                    <li key={player.id}>
                      <DraggablePlayer player={player} />
                    </li>
                  ))
                )}
              </ul>
            </div>
          </PlayerPoolDroppable>

          {/* Right: Lineup slots */}
          <div className="card-tech rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Batting order
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name"
                  className="input-tech w-36 px-2.5 py-1.5 text-sm"
                  aria-label="Template name for saving lineup"
                />
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={saveStatus === "saving" || !templateName.trim() || !hasAnyPlayerInLineup}
                  className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--bg-base)] transition hover:opacity-90 disabled:opacity-50"
                >
                  {saveStatus === "saving" ? "Saving…" : "Save lineup"}
                </button>
                {saveStatus === "ok" && (
                  <span className="text-sm text-[var(--success)]">Saved.</span>
                )}
                {saveStatus === "err" && (
                  <span className="text-sm text-[var(--danger)]" title={saveErrorMessage ?? undefined}>
                    {saveErrorMessage ?? "Save failed."}
                  </span>
                )}
                <button
                  type="button"
                  onClick={clearLineup}
                  disabled={!hasAnyPlayerInLineup}
                  className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text)] disabled:opacity-50 disabled:pointer-events-none"
                >
                  Clear lineup
                </button>
              </div>
            </div>
            {(() => {
              const positionCounts = new Map<string, number>();
              for (const s of lineup) {
                if (s.player && s.position) {
                  positionCounts.set(s.position, (positionCounts.get(s.position) ?? 0) + 1);
                }
              }
              const duplicatePositions = [...positionCounts.entries()]
                .filter(([, c]) => c > 1)
                .map(([pos]) => pos);
              return duplicatePositions.length > 0 ? (
                <p className="mt-2 rounded-md border border-[var(--warning)] bg-[var(--warning-dim)] px-3 py-2 text-sm text-[var(--warning)]">
                  Duplicate positions: {duplicatePositions.join(", ")}. Each position can only be used once.
                </p>
              ) : null;
            })()}
            <div className="mt-3 overflow-hidden rounded-lg border border-[var(--border)]">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[var(--bg-elevated)]">
                    <th className="border-b border-r border-[var(--border)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      #
                    </th>
                    <th className="border-b border-r border-[var(--border)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      POS
                    </th>
                    <th className="border-b border-r border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Player
                    </th>
                    <th className="border-b border-[var(--border)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Bats
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
                    const positionsTakenByOthers = new Set(
                      lineup
                        .map((s, j) => (j !== i && s.player && s.position ? s.position : null))
                        .filter((p): p is string => p != null)
                    );
                    return (
                      <LineupTableRow
                        key={i}
                        slotIndex={i}
                        player={lineup[i]?.player ?? null}
                        position={lineup[i]?.position ?? ""}
                        positionsTakenByOthers={positionsTakenByOthers}
                        onPositionChange={setSlotPosition}
                        rowStriped={i % 2 === 0}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Single stats container below both columns */}
        <section className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Player stats
          </h2>
          <div className="mt-3 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                Lineup
              </h3>
              <PlayerStatsTable
                players={lineup.map((s) => s.player).filter((p): p is Player => p != null)}
                statsMap={initialBattingStats}
                emptyMessage="No players in lineup."
                showSpot
              />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                Pool
              </h3>
              <PlayerStatsTable
                players={availablePlayers}
                statsMap={initialBattingStats}
                emptyMessage="No players in pool."
              />
            </div>
          </div>
        </section>

        <DragOverlay dropAnimation={null}>
          {activePlayer ? (
            <div className="cursor-grabbing rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-lg">
              <PlayerCard player={activePlayer} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
