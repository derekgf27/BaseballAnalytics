"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useTouchOptimizedDndSensors } from "@/lib/dndTouchSensors";
import {
  fetchGameLineupForCoach,
  saveGameLineupForCoachAction,
  fetchSavedLineupSlotsForCoach,
  deleteSavedLineupForCoach,
} from "./actions";
import type { Game, LineupSide, Player, SavedLineup } from "@/lib/types";
import type { BattingStats, BattingStatsWithSplits } from "@/lib/types";
import { lineupAggregateFromBattingStats } from "@/lib/compute/battingStats";
import { formatPPa } from "@/lib/format";
import { matchupLabelUsFirst } from "@/lib/opponentUtils";
import { comparePlayersByLastNameThenFull } from "@/lib/playerSort";

const LINEUP_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"] as const;

export interface CoachLineupSlot {
  order: number;
  playerId: string;
  playerName: string;
  position: string;
  bats: string | null;
}

type LineupSlotState = { player: Player | null; position: string };

type LineupSplitView = "overall" | "vsL" | "vsR" | "risp";
type PoolSortKey = "name" | "obp" | "ops" | "avg";

const BATTING_TAIL_LABELS: { key: keyof BattingStats; label: string; format: "avg" | "int" | "pct" }[] = [
  { key: "kPct", label: "K%", format: "pct" },
  { key: "pPa", label: "P/PA", format: "avg" },
];

function formatLineupBattingCell(s: BattingStats | undefined, key: keyof BattingStats, format: "avg" | "int" | "pct"): string {
  if (!s) return "—";
  if (key === "pPa") {
    return s.pPa != null && !Number.isNaN(s.pPa) ? formatPPa(s.pPa) : "—";
  }
  if (format === "pct") {
    const v = s[key];
    if (typeof v !== "number" || Number.isNaN(v)) return "—";
    return `${(v * 100).toFixed(1)}%`;
  }
  return formatStat(Number(s[key]) || 0, format);
}

function formatStat(value: number, format: "avg" | "int"): string {
  if (format === "int") return String(value);
  const s = value.toFixed(3);
  return s.startsWith("0.") ? s.slice(1) : s;
}

function getStatValue(statsMap: Record<string, BattingStats>, playerId: string, key: PoolSortKey): number {
  if (key === "name") return 0;
  const s = statsMap[playerId];
  if (!s) return -1;
  const v = (s as unknown as Record<string, unknown>)[key];
  return typeof v === "number" ? v : -1;
}

function getStatsForLineupSplit(
  splits: Record<string, BattingStatsWithSplits>,
  playerId: string,
  split: LineupSplitView
): BattingStats | undefined {
  const s = splits[playerId];
  if (!s) return undefined;
  if (split === "overall") return s.overall;
  if (split === "vsL") return s.vsL ?? undefined;
  if (split === "vsR") return s.vsR ?? undefined;
  return s.risp ?? undefined;
}

function suggestOrder(
  players: Player[],
  statsMap: Record<string, BattingStats>,
  stat: "obp" | "avg"
): { player: Player; position: string }[] {
  const withStat = players.map((p) => ({
    player: p,
    value: getStatValue(statsMap, p.id, stat),
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

function batsShort(bats: string | null | undefined): string {
  if (bats == null || bats === "") return "—";
  const code = bats.toUpperCase();
  const c = code[0];
  return c === "S" ? "S" : c === "L" ? "L" : c === "R" ? "R" : code;
}

// Normalize handedness codes coming from data (e.g. "BL", "BR", "BS", "TL", "TR")
const batsLabel: Record<string, string> = {
  L: "Left",
  R: "Right",
  S: "Switch",
  BL: "Left",
  BR: "Right",
  BS: "Switch",
};
const throwsLabel: Record<string, string> = {
  L: "Left",
  R: "Right",
  TL: "Left",
  TR: "Right",
};
function formatHandedness(bats: string | null | undefined, throws: string | null | undefined): string {
  const b = bats != null && bats !== "" ? batsLabel[bats] ?? bats : "—";
  const t = throws != null && throws !== "" ? throwsLabel[throws] ?? throws : "—";
  return `Bats: ${b} · Throws: ${t}`;
}

export interface CoachLineupClientProps {
  games: Game[];
  players: Player[];
  initialBattingStatsWithSplits: Record<string, BattingStatsWithSplits>;
  savedLineups: SavedLineup[];
  initialGameId: string | null;
  /** `our_side` for `initialGameId` (used to hydrate the correct side from SSR). */
  initialGameOurSide: LineupSide | null;
  initialLineup: CoachLineupSlot[];
}

function formatGameLabel(game: Game): string {
  const d = game.date
    ? new Date(game.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : game.date;
  return `${d} ${matchupLabelUsFirst(game, true)}`;
}

function PlayerCard({
  player,
  isDragging,
}: {
  player: Player;
  isDragging?: boolean;
}) {
  const position = player.positions?.[0] ?? "—";
  const handedness = formatHandedness(player.bats, player.throws);
  return (
    <div
      className={`neo-card flex cursor-grab touch-none select-none items-center gap-3 rounded-lg border p-3 active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <p className="min-w-0 flex-1 truncate font-medium text-[var(--neo-text)]">{player.name}</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--neo-text-muted)]">
          {player.jersey && <span>#{player.jersey}</span>}
          <span className="font-medium text-[var(--neo-accent)]">{position}</span>
          <span className="font-semibold text-[var(--neo-text)]">{handedness}</span>
        </div>
      </div>
    </div>
  );
}

function DraggablePlayer({
  player,
  compact,
}: {
  player: Player;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
    data: { player },
  });
  if (compact) {
    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className="min-w-0 flex-1 touch-none select-none"
      >
        <div className={`flex cursor-grab items-center gap-2 active:cursor-grabbing ${isDragging ? "opacity-50" : ""}`}>
          <span className="truncate text-base font-medium text-[var(--text)]">{player.name}</span>
          {player.jersey && <span className="shrink-0 text-sm text-[var(--text-muted)]">#{player.jersey}</span>}
        </div>
      </div>
    );
  }
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className="touch-none select-none">
      <PlayerCard player={player} isDragging={isDragging} />
    </div>
  );
}

function CoachLineupRow({
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
      className={`border-b border-[var(--neo-border)] transition ${
        isOver ? "bg-[var(--neo-accent-dim)]" : rowStriped ? "bg-[#10151a]" : "bg-[#12181f]"
      }`}
    >
      <td className="w-12 border-r border-[var(--neo-border)] px-3 py-2 text-center">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-[var(--neo-accent)] text-sm font-bold text-[var(--bg-base)]">
          {slotIndex + 1}
        </span>
      </td>
      <td className="min-w-[5.5rem] w-24 border-r border-[var(--neo-border)] bg-black/20 px-2 py-2 text-center">
        {player ? (
          <select
            value={position || LINEUP_POSITIONS[0]}
            onChange={(e) => onPositionChange(slotIndex, e.target.value)}
            className="min-w-[3rem] w-full rounded border border-[var(--neo-border)] bg-[#111619] px-2 py-1 text-center text-sm font-medium text-[var(--neo-text)] focus:border-[var(--neo-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--neo-accent)]"
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
      className={`transition-opacity ${isOver ? "ring-2 ring-[var(--neo-accent)] ring-offset-2 ring-offset-[var(--neo-bg-base)] rounded-lg" : ""}`}
    >
      {children}
    </div>
  );
}

function CoachPlayerStatsTable({
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
    return <p className="py-4 text-center text-sm text-[var(--text-faint)]">{emptyMessage}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
            {showSpot && (
              <th className="font-display py-1.5 pr-2 text-center text-xs font-semibold uppercase">#</th>
            )}
            <th className="font-display py-1.5 pr-2 text-xs font-semibold uppercase">Player</th>
            {BATTING_TAIL_LABELS.map(({ key, label }) => (
              <th key={key} className="font-display py-1.5 px-2 text-center text-xs font-semibold uppercase">
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
                  <td className="py-1.5 pr-2 text-center text-[var(--text-muted)]">{index + 1}</td>
                )}
                <td className="py-1.5 pr-2 font-medium text-[var(--text)]">
                  {player.name}
                  {player.jersey && <span className="ml-1 text-[var(--text-muted)]">#{player.jersey}</span>}
                </td>
                {BATTING_TAIL_LABELS.map(({ key, format }) => (
                  <td key={key} className="py-1.5 px-2 text-center text-[var(--text)] tabular-nums">
                    {formatLineupBattingCell(s, key, format)}
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

function slotsToLineupState(
  slots: { slot: number; player_id: string; position: string | null }[],
  playerMap: Map<string, Player>
): LineupSlotState[] {
  const next: LineupSlotState[] = Array.from({ length: 9 }, () => ({
    player: null,
    position: LINEUP_POSITIONS[0],
  }));
  slots.forEach((s) => {
    if (s.slot >= 1 && s.slot <= 9) {
      next[s.slot - 1] = {
        player: playerMap.get(s.player_id) ?? null,
        position: s.position || LINEUP_POSITIONS[0],
      };
    }
  });
  return next;
}

function initialLineupToState(initialLineup: CoachLineupSlot[], playerMap: Map<string, Player>): LineupSlotState[] {
  const next: LineupSlotState[] = Array.from({ length: 9 }, () => ({
    player: null,
    position: LINEUP_POSITIONS[0],
  }));
  for (const s of initialLineup) {
    const idx = Math.trunc(s.order) - 1;
    if (idx >= 0 && idx < 9) {
      next[idx] = {
        player: playerMap.get(s.playerId) ?? null,
        position: s.position || LINEUP_POSITIONS[0],
      };
    }
  }
  return next;
}

/**
 * Coach lineup: view or edit gameday/future lineups with drag-and-drop and stats.
 */
function opponentSide(side: LineupSide): LineupSide {
  return side === "home" ? "away" : "home";
}

export function CoachLineupClient({
  games,
  players,
  initialBattingStatsWithSplits,
  savedLineups,
  initialGameId,
  initialGameOurSide,
  initialLineup,
}: CoachLineupClientProps) {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(initialGameId);
  const [lineupSide, setLineupSide] = useState<LineupSide>(() => initialGameOurSide ?? "home");
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const [lineup, setLineup] = useState<LineupSlotState[]>(() =>
    initialLineup.length > 0 ? initialLineupToState(initialLineup, playerMap) : Array.from({ length: 9 }, () => ({ player: null, position: LINEUP_POSITIONS[0] }))
  );
  const [lineupSplitView, setLineupSplitView] = useState<LineupSplitView>("overall");
  const [poolSortBy, setPoolSortBy] = useState<PoolSortKey>("name");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadingLineup, setLoadingLineup] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading">("idle");
  const router = useRouter();

  const initialBattingStats: Record<string, BattingStats> = {};
  for (const p of players) {
    const s = getStatsForLineupSplit(initialBattingStatsWithSplits, p.id, lineupSplitView);
    if (s) initialBattingStats[p.id] = s;
  }

  useEffect(() => {
    if (!selectedGameId) {
      setLineup(Array.from({ length: 9 }, () => ({ player: null, position: LINEUP_POSITIONS[0] })));
      return;
    }
    if (
      selectedGameId === initialGameId &&
      initialLineup.length > 0 &&
      initialGameOurSide != null &&
      lineupSide === initialGameOurSide
    ) {
      setLineup(initialLineupToState(initialLineup, playerMap));
      return;
    }
    setLoadingLineup(true);
    fetchGameLineupForCoach(selectedGameId, lineupSide)
      .then((slots) => setLineup(slotsToLineupState(slots, playerMap)))
      .finally(() => setLoadingLineup(false));
  }, [selectedGameId, lineupSide, initialGameId, initialLineup, initialGameOurSide]);

  const inLineupIds = new Set(lineup.filter((s) => s.player != null).map((s) => s.player!.id));
  const availablePlayers = players.filter((p) => !inLineupIds.has(p.id));
  const sortedAvailablePlayers = [...availablePlayers].sort((a, b) => {
    if (poolSortBy === "name") return comparePlayersByLastNameThenFull(a, b);
    const d =
      getStatValue(initialBattingStats, b.id, poolSortBy) - getStatValue(initialBattingStats, a.id, poolSortBy);
    if (d !== 0) return d;
    return comparePlayersByLastNameThenFull(a, b);
  });

  const lineupPlayers = lineup.map((s) => s.player).filter((p): p is Player => p != null);
  const lineupBattingStatsNine =
    lineupPlayers.length === 9
      ? lineupPlayers.map((p) => initialBattingStats[p.id]).filter((s): s is BattingStats => s != null)
      : [];
  const lineupQuality =
    lineupBattingStatsNine.length === 9 ? lineupAggregateFromBattingStats(lineupBattingStatsNine) : null;

  const sensors = useTouchOptimizedDndSensors();

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    const playerId = String(active.id);
    const player = players.find((p) => p.id === playerId);
    if (!player) return;

    if (overId === "player-pool") {
      const currentSlot = lineup.findIndex((s) => s.player?.id === playerId);
      if (currentSlot < 0) return;
      setLineup((prev) => {
        const next = prev.map((s) => ({ ...s }));
        next[currentSlot] = { player: null, position: LINEUP_POSITIONS[0] };
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
      next[slotIndex] = { player, position: defaultPosition };
      if (currentSlot >= 0) next[currentSlot] = { player: displacedSlot.player, position: displacedSlot.position };
      return next;
    });
  }

  function setSlotPosition(slotIndex: number, position: string) {
    setLineup((prev) => {
      const next = [...prev];
      next[slotIndex] = { ...next[slotIndex], position };
      return next;
    });
  }

  function handleSuggestBy(stat: "obp" | "avg") {
    const nine = lineupPlayers.length === 9 ? lineupPlayers : [...lineupPlayers, ...availablePlayers].slice(0, 9);
    if (nine.length === 0) return;
    const ordered = suggestOrder(nine, initialBattingStats, stat);
    const padded: LineupSlotState[] = Array.from({ length: 9 }, (_, i) =>
      ordered[i] ? { player: ordered[i].player, position: ordered[i].position } : { player: null, position: LINEUP_POSITIONS[0] }
    );
    setLineup(padded);
  }

  async function handleLoadTemplate(lineupId: string) {
    setLoadStatus("loading");
    const slots = await fetchSavedLineupSlotsForCoach(lineupId);
    setLoadStatus("idle");
    if (!slots.length) return;
    setLineup(slotsToLineupState(slots, playerMap));
  }

  async function handleDeleteTemplate(id: string) {
    await deleteSavedLineupForCoach(id);
    router.refresh();
  }

  function handleClearLineup() {
    setLineup(Array.from({ length: 9 }, () => ({ player: null, position: LINEUP_POSITIONS[0] })));
  }

  async function handleSave() {
    if (!selectedGameId) return;
    const ordered = lineup
      .map((s) => (s.player ? { player_id: s.player.id, position: s.position || null } : null))
      .filter((s): s is { player_id: string; position: string | null } => s != null);
    setSaveStatus("saving");
    setSaveError(null);
    const result = await saveGameLineupForCoachAction(selectedGameId, lineupSide, ordered);
    setSaveStatus(result.ok ? "ok" : "err");
    setSaveError(result.error ?? null);
    if (result.ok) setTimeout(() => setSaveStatus("idle"), 2500);
  }

  const hasAnyPlayer = lineup.some((s) => s.player != null);
  const activePlayer = activeId ? players.find((p) => p.id === activeId) ?? null : null;
  const selectedGame = selectedGameId ? games.find((g) => g.id === selectedGameId) ?? null : null;
  const ourSide = selectedGame?.our_side ?? "home";
  const oppSide = opponentSide(ourSide);

  const positionsTakenByOthers = (slotIndex: number) => {
    const set = new Set<string>();
    lineup.forEach((s, i) => {
      if (i !== slotIndex && s.position) set.add(s.position);
    });
    return set;
  };

  return (
    <div className="space-y-6 pb-8">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">
          Lineup
        </h1>
        <p className="mt-1 text-sm text-[var(--neo-text-muted)]">
          View or edit the batting order for a game. Drag players into slots or use Suggest by OBP or AVG.
        </p>
      </header>

      {games.length === 0 ? (
        <div className="neo-card border border-dashed border-[var(--neo-border)] p-8 text-center">
          <p className="font-medium text-[var(--neo-text)]">No games yet</p>
          <p className="mt-2 text-sm text-[var(--neo-text-muted)]">
            Create a game in Analyst → Games, then you can set its lineup here.
          </p>
          <Link href="/analyst/games" className="mt-4 inline-block text-sm text-[var(--neo-accent)] hover:underline">
            Go to Games →
          </Link>
        </div>
      ) : (
        <>
          {/* Single compact card: Game + Templates + Stats (headings on top) */}
          <section className="neo-card p-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <div className="font-display mb-1.5 text-xs font-semibold uppercase tracking-wider text-white">Game</div>
                <select
                  value={selectedGameId ?? ""}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    setSelectedGameId(id);
                    if (id) {
                      const g = games.find((x) => x.id === id);
                      if (g) setLineupSide(g.our_side);
                    }
                  }}
                  className="input-tech w-full max-w-xs rounded-lg px-3 py-1.5 text-sm text-[var(--neo-text)]"
                  aria-label="Select game"
                >
                  <option value="">Select a game</option>
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>
                      {formatGameLabel(g)}
                    </option>
                  ))}
                </select>
                {selectedGame && (
                  <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Which team lineup to edit">
                    <button
                      type="button"
                      onClick={() => setLineupSide(ourSide)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        lineupSide === ourSide
                          ? "border-[var(--neo-accent)] bg-[var(--neo-accent-dim)] text-[var(--neo-accent)]"
                          : "border-[var(--neo-border)] text-[var(--neo-text-muted)] hover:border-[var(--neo-accent)]/40"
                      }`}
                    >
                      {ourSide === "home" ? selectedGame.home_team : selectedGame.away_team}{" "}
                      <span className="text-[var(--neo-text-muted)]">({ourSide === "home" ? "Home" : "Away"})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLineupSide(oppSide)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        lineupSide === oppSide
                          ? "border-[var(--neo-accent)] bg-[var(--neo-accent-dim)] text-[var(--neo-accent)]"
                          : "border-[var(--neo-border)] text-[var(--neo-text-muted)] hover:border-[var(--neo-accent)]/40"
                      }`}
                    >
                      {oppSide === "home" ? selectedGame.home_team : selectedGame.away_team}{" "}
                      <span className="text-[var(--neo-text-muted)]">({oppSide === "home" ? "Home" : "Away"})</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-display mb-1.5 text-xs font-semibold uppercase tracking-wider text-white">Templates</div>
                {savedLineups.length > 0 ? (
                  <>
                    <select
                      aria-label="Load a template"
                      className="mb-2 w-full max-w-[14rem] rounded border border-[var(--neo-border)] bg-[var(--neo-bg-base)] px-2 py-1 text-sm text-[var(--neo-text)] focus:border-[var(--neo-accent)] focus:outline-none"
                      value=""
                      onChange={(e) => {
                        const id = e.target.value;
                        if (id) handleLoadTemplate(id);
                        e.target.value = "";
                      }}
                    >
                      <option value="">Load template…</option>
                      {savedLineups.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                    <div className="max-h-24 overflow-y-auto rounded border border-[var(--neo-border)] bg-[#10151a]">
                      <ul className="space-y-0.5 p-1.5" role="list">
                        {savedLineups.map((l) => (
                          <li key={l.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-black/20">
                            <span className="min-w-0 truncate font-medium text-[var(--neo-text)]">{l.name}</span>
                            <span className="shrink-0">
                              <button type="button" onClick={() => handleLoadTemplate(l.id)} disabled={loadStatus === "loading"} className="text-xs text-[var(--neo-accent)] hover:underline disabled:opacity-50">Load</button>
                              {" · "}
                              <button type="button" onClick={() => handleDeleteTemplate(l.id)} className="text-xs text-[var(--neo-text-muted)] hover:text-[var(--danger)]" aria-label={`Delete ${l.name}`}>Delete</button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-[var(--neo-text-muted)]">None · save in Analyst → Lineup</span>
                )}
              </div>
              <div>
                <div className="font-display mb-1.5 text-xs font-semibold uppercase tracking-wider text-white">Stats</div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={lineupSplitView}
                    onChange={(e) => setLineupSplitView(e.target.value as LineupSplitView)}
                    className="rounded border border-[var(--neo-border)] bg-[var(--neo-bg-base)] px-2 py-1 text-sm text-[var(--neo-text)] focus:border-[var(--neo-accent)] focus:outline-none"
                    aria-label="Batting split"
                  >
                    <option value="overall">Overall</option>
                    <option value="vsL">vs LHP</option>
                    <option value="vsR">vs RHP</option>
                  </select>
                  <button type="button" onClick={() => handleSuggestBy("obp")} disabled={players.length === 0} className="rounded-lg border border-[var(--neo-accent)]/50 bg-[var(--neo-accent-dim)] px-2.5 py-1 text-xs font-medium text-[var(--neo-accent)] transition hover:bg-[var(--neo-accent)]/20 disabled:opacity-50 disabled:pointer-events-none">Suggest by OBP</button>
                  <button type="button" onClick={() => handleSuggestBy("avg")} disabled={players.length === 0} className="rounded-lg border border-[var(--neo-accent)]/50 bg-[var(--neo-accent-dim)] px-2.5 py-1 text-xs font-medium text-[var(--neo-accent)] transition hover:bg-[var(--neo-accent)]/20 disabled:opacity-50 disabled:pointer-events-none">Suggest by AVG</button>
                  {lineupQuality != null && (
                    <span className="text-xs text-[var(--neo-text-muted)]">
                      OBP <strong className="text-[var(--neo-text)]">{formatStat(lineupQuality.obp, "avg")}</strong>
                      {" · "}
                      K%{" "}
                      <strong className="text-[var(--neo-text)]">
                        {lineupQuality.kPct != null && !Number.isNaN(lineupQuality.kPct)
                          ? `${(lineupQuality.kPct * 100).toFixed(1)}%`
                          : "—"}
                      </strong>
                      {lineupQuality.pPa != null && (
                        <>
                          {" · "}
                          P/PA <strong className="text-[var(--neo-text)]">{formatPPa(lineupQuality.pPa)}</strong>
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {selectedGameId && (
            <DndContext
              sensors={sensors}
              autoScroll={false}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                {/* Available players */}
                <PlayerPoolDroppable>
                  <div className="neo-card flex min-h-[20rem] flex-col p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="section-label">Available players</h2>
                      <label className="flex items-center gap-2 text-xs text-[var(--neo-text-muted)]">
                        <span>Sort by</span>
                        <select
                          value={poolSortBy}
                          onChange={(e) => setPoolSortBy(e.target.value as PoolSortKey)}
                          className="input-tech rounded border border-[var(--neo-border)] bg-[var(--neo-bg-base)] px-2 py-1 text-[var(--neo-text)]"
                          aria-label="Sort pool"
                        >
                          <option value="name">Name</option>
                          <option value="obp">OBP</option>
                          <option value="ops">OPS</option>
                          <option value="avg">AVG</option>
                        </select>
                      </label>
                    </div>
                    <p className="mt-1 text-xs text-[var(--neo-text-muted)]">
                      Drag players into the batting order, or drop them here to remove.
                    </p>
                    <ul className="mt-3 space-y-2" role="list">
                      {sortedAvailablePlayers.length === 0 ? (
                        <li className="rounded-lg border border-dashed border-[var(--neo-border)] py-6 text-center text-sm text-[var(--neo-text-muted)]">
                          All players are in the lineup.
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

                {/* Batting order */}
                <div className="neo-card flex min-h-[20rem] flex-col p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <h2 className="section-label">Batting order</h2>
                    <button
                      type="button"
                      onClick={handleClearLineup}
                      disabled={saveStatus === "saving" || !hasAnyPlayer}
                      className="rounded-lg border border-[var(--neo-border)] bg-transparent px-3 py-1.5 text-sm font-medium text-[var(--neo-text)] transition hover:bg-[var(--neo-bg-elevated)] hover:border-[var(--neo-accent)]/50 disabled:opacity-50"
                    >
                      Clear lineup
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saveStatus === "saving" || !hasAnyPlayer}
                      className="rounded-lg bg-[var(--neo-accent)] px-3 py-1.5 text-sm font-medium text-[var(--bg-base)] transition hover:opacity-90 disabled:opacity-50"
                    >
                      {saveStatus === "saving" ? "Saving…" : "Save lineup"}
                    </button>
                    {saveStatus === "ok" && <span className="text-sm text-[var(--neo-success)]">Saved.</span>}
                    {saveStatus === "err" && saveError && (
                      <span className="text-sm text-[var(--danger)]" title={saveError}>
                        Save failed.
                      </span>
                    )}
                  </div>

                  {loadingLineup ? (
                    <p className="py-6 text-center text-sm text-[var(--neo-text-muted)]">Loading lineup…</p>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-[var(--neo-border)] bg-[#0f141a]">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="bg-[#151b21]">
                            <th className="font-display border-b border-r border-[var(--neo-border)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-muted)]">
                              #
                            </th>
                            <th className="font-display border-b border-r border-[var(--neo-border)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-muted)]">
                              POS
                            </th>
                            <th className="font-display border-b border-r border-[var(--neo-border)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-muted)]">
                              Player
                            </th>
                            <th className="font-display border-b border-[var(--neo-border)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-muted)]">
                              Bats
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <CoachLineupRow
                              key={i}
                              slotIndex={i}
                              player={lineup[i]?.player ?? null}
                              position={lineup[i]?.position ?? LINEUP_POSITIONS[0]}
                              positionsTakenByOthers={positionsTakenByOthers(i)}
                              onPositionChange={setSlotPosition}
                              rowStriped={i % 2 === 0}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Player stats */}
              <section className="mt-6 neo-card p-4">
                <div className="section-label">Player stats</div>
                <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="min-w-0">
                    <h3 className="font-display mb-2 text-xs font-semibold uppercase tracking-wider text-white">
                      Pool
                    </h3>
                    <CoachPlayerStatsTable
                      players={availablePlayers}
                      statsMap={initialBattingStats}
                      emptyMessage="No players in pool."
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display mb-2 text-xs font-semibold uppercase tracking-wider text-white">
                      Lineup
                    </h3>
                    <CoachPlayerStatsTable
                      players={lineupPlayers}
                      statsMap={initialBattingStats}
                      emptyMessage="No players in lineup."
                      showSpot
                    />
                  </div>
                </div>
              </section>

              <DragOverlay dropAnimation={null}>
                {activePlayer ? (
                  <div className="will-change-transform cursor-grabbing rounded-lg border border-[var(--neo-border)] bg-[var(--neo-bg-card)] shadow-lg">
                    <PlayerCard player={activePlayer} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}

          {selectedGameId && !loadingLineup && lineup.every((s) => !s.player) && (
            <div className="rounded-lg border border-[var(--neo-border)] bg-[var(--neo-bg-card)] p-4 text-sm text-[var(--neo-text-muted)]">
              No players in this lineup yet. Drag players from the left or use Suggest by OBP or AVG.
            </div>
          )}
        </>
      )}
    </div>
  );
}
