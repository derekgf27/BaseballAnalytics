"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { isClubRosterPlayer, isPitcherPlayer } from "@/lib/opponentUtils";
import type { Player } from "@/lib/types";
import { comparePlayersByLastNameThenFull } from "@/lib/playerSort";

/** Field positions only — pitchers are set on the game, not in this batting-order modal. */
const LINEUP_POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"] as const;

/** Unassigned — frees the slot so another row can take that position. */
const POSITION_UNASSIGNED = "";

function isLineupPosition(pos: string): pos is (typeof LINEUP_POSITIONS)[number] {
  return LINEUP_POSITIONS.includes(pos as (typeof LINEUP_POSITIONS)[number]);
}

type LineupSlotState = { player: Player | null; position: string };

function normName(s: string): string {
  return s.trim().toLowerCase();
}

function filterOpponentPool(players: Player[], opponentName: string): Player[] {
  const want = normName(opponentName);
  if (!want) return [];
  return players.filter((p) => p.opponent_team && normName(p.opponent_team) === want);
}

function filterClubPool(players: Player[]): Player[] {
  return players.filter((p) => isClubRosterPlayer(p));
}

/** Batting pool only — pitchers are set separately (e.g. starting pitcher on the game). */
function filterBattersOnly(players: Player[]): Player[] {
  return players.filter((p) => !isPitcherPlayer(p));
}

function batsShort(bats: string | null | undefined): string {
  if (bats == null || bats === "") return "—";
  const c = bats.toUpperCase()[0];
  return c === "S" ? "S" : c === "L" ? "L" : c === "R" ? "R" : "—";
}

function orderedSlotsToState(
  ordered: { player_id: string; position: string | null }[],
  playerMap: Map<string, Player>
): LineupSlotState[] {
  const next: LineupSlotState[] = Array.from({ length: 9 }, () => ({
    player: null,
    position: LINEUP_POSITIONS[0],
  }));
  ordered.forEach((s, i) => {
    if (i >= 9) return;
    const p = playerMap.get(s.player_id);
    const pos =
      s.position && isLineupPosition(s.position) ? s.position : LINEUP_POSITIONS[0];
    next[i] = { player: p ?? null, position: pos };
  });
  return dedupeFilledPositions(next);
}

/** Ensure no two filled slots share an assigned position (ignores blank). */
function dedupeFilledPositions(lineup: LineupSlotState[]): LineupSlotState[] {
  const used = new Set<string>();
  const out = lineup.map((s) => ({ ...s }));
  for (let i = 0; i < out.length; i++) {
    if (!out[i].player) continue;
    const pos = out[i].position;
    if (!isLineupPosition(pos)) continue;
    if (used.has(pos)) {
      const alt = LINEUP_POSITIONS.find((p) => !used.has(p));
      if (alt) out[i] = { ...out[i], position: alt };
    }
    used.add(out[i].position);
  }
  return out;
}

function hasDuplicatePositionsAmongFilled(lineup: LineupSlotState[]): boolean {
  const seen = new Set<string>();
  for (const s of lineup) {
    if (!s.player) continue;
    if (!isLineupPosition(s.position)) continue;
    if (seen.has(s.position)) return true;
    seen.add(s.position);
  }
  return false;
}

function positionSelectValue(position: string): string {
  if (position === POSITION_UNASSIGNED) return POSITION_UNASSIGNED;
  if (isLineupPosition(position)) return position;
  return LINEUP_POSITIONS[0];
}

function DraggablePlayer({ player }: { player: Player }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
    data: { player },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className="min-w-0 flex-1">
      <div className={`flex cursor-grab items-center gap-2 active:cursor-grabbing ${isDragging ? "opacity-50" : ""}`}>
        <span className="truncate text-sm font-medium text-[var(--text)]">{player.name}</span>
        {player.jersey && <span className="shrink-0 text-xs text-[var(--text-muted)]">#{player.jersey}</span>}
      </div>
    </div>
  );
}

function LineupRow({
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
  onPositionChange: (slotIndex: number, value: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `opp-slot-${slotIndex}` });

  return (
    <tr
      ref={setNodeRef}
      className={`border-b border-[var(--border)] transition ${isOver ? "bg-[var(--accent)]/10" : ""}`}
    >
      <td className="w-12 px-2 py-2 text-center">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-[var(--accent)] text-sm font-bold text-[var(--bg-base)]">
          {slotIndex + 1}
        </span>
      </td>
      <td className="w-24 px-2 py-2 text-center">
        {player ? (
          <select
            value={positionSelectValue(position)}
            onChange={(e) => onPositionChange(slotIndex, e.target.value)}
            className="input-tech w-full rounded border border-[var(--border)] px-2 py-1 text-center text-xs font-medium text-[var(--text)]"
            aria-label={`Position for slot ${slotIndex + 1}`}
          >
            <option value={POSITION_UNASSIGNED}>—</option>
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
      <td className="min-w-0 px-2 py-2">
        {player ? (
          <DraggablePlayer player={player} />
        ) : (
          <span className="text-sm text-[var(--text-faint)]">Drop player here</span>
        )}
      </td>
      <td className="w-10 px-2 py-2 text-center text-sm font-semibold text-[var(--text)]">
        {player ? batsShort(player.bats) : "—"}
      </td>
    </tr>
  );
}

function PlayerPoolDroppable({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "opp-player-pool" });
  return (
    <div
      ref={setNodeRef}
      className={`transition ${isOver ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-base)] rounded-lg" : ""}`}
    >
      {children}
    </div>
  );
}

export type OpponentLineupModalVariant = "opponent" | "our";

export interface OpponentLineupModalProps {
  open: boolean;
  onClose: () => void;
  /** Used when variant is "opponent" — filters the player pool by tagged opponent team. */
  opponentName: string;
  players: Player[];
  /** Ordered slots (batting order); persisted when user confirms. */
  initialOrderedSlots: { player_id: string; position: string | null }[];
  onConfirm: (slots: { player_id: string; position: string | null }[]) => void;
  /** "our" = club roster pool (same UI as opponent modal). Default "opponent". */
  variant?: OpponentLineupModalVariant;
  /** Heading when variant is "our" (e.g. saved lineup name). */
  lineupTitle?: string;
}

export function OpponentLineupModal({
  open,
  onClose,
  opponentName,
  players,
  initialOrderedSlots,
  onConfirm,
  variant = "opponent",
  lineupTitle,
}: OpponentLineupModalProps) {
  const isOur = variant === "our";
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const pool = useMemo(
    () =>
      filterBattersOnly(
        isOur ? filterClubPool(players) : filterOpponentPool(players, opponentName)
      ),
    [players, opponentName, isOur]
  );

  const [lineup, setLineup] = useState<LineupSlotState[]>(() =>
    Array.from({ length: 9 }, () => ({ player: null, position: LINEUP_POSITIONS[0] }))
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [positionError, setPositionError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPositionError(null);
    setLineup(orderedSlotsToState(initialOrderedSlots, playerMap));
  }, [open, initialOrderedSlots, playerMap]);

  const inLineupIds = new Set(lineup.filter((s) => s.player != null).map((s) => s.player!.id));
  const availablePlayers = [...pool.filter((p) => !inLineupIds.has(p.id))].sort(comparePlayersByLastNameThenFull);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    setPositionError(null);
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    const playerId = String(active.id);
    const player = pool.find((p) => p.id === playerId) ?? playerMap.get(playerId);
    if (!player) return;

    if (overId === "opp-player-pool") {
      const currentSlot = lineup.findIndex((s) => s.player?.id === playerId);
      if (currentSlot < 0) return;
      setLineup((prev) => {
        const next = prev.map((s) => ({ ...s }));
        next[currentSlot] = { player: null, position: LINEUP_POSITIONS[0] };
        return next;
      });
      return;
    }

    if (!overId.startsWith("opp-slot-")) return;
    const slotIndex = parseInt(overId.replace("opp-slot-", ""), 10);
    if (slotIndex < 0 || slotIndex > 8) return;

    const currentSlot = lineup.findIndex((s) => s.player?.id === playerId);
    const displacedSlot = lineup[slotIndex];

    setLineup((prev) => {
      const next = prev.map((s) => ({ ...s }));
      const primaryPosition = player.positions?.[0];
      const preferred =
        primaryPosition && LINEUP_POSITIONS.includes(primaryPosition as (typeof LINEUP_POSITIONS)[number])
          ? primaryPosition
          : "DH";
      const taken = new Set<string>();
      next.forEach((s, i) => {
        if (i === slotIndex || i === currentSlot) return;
        if (s.player && isLineupPosition(s.position)) taken.add(s.position);
      });
      const defaultPosition =
        !taken.has(preferred) ? preferred : LINEUP_POSITIONS.find((p) => !taken.has(p)) ?? preferred;

      next[slotIndex] = { player, position: defaultPosition };
      if (currentSlot >= 0) next[currentSlot] = { player: displacedSlot.player, position: displacedSlot.position };

      if (currentSlot >= 0 && next[currentSlot].player) {
        const t = new Set<string>();
        next.forEach((s, i) => {
          if (i === currentSlot) return;
          if (s.player && isLineupPosition(s.position)) t.add(s.position);
        });
        const curPos = next[currentSlot].position;
        if (isLineupPosition(curPos) && t.has(curPos)) {
          const alt = LINEUP_POSITIONS.find((p) => !t.has(p));
          if (alt) next[currentSlot] = { ...next[currentSlot], position: alt };
        }
      }
      return dedupeFilledPositions(next);
    });
  }

  function setSlotPosition(slotIndex: number, position: string) {
    setPositionError(null);
    setLineup((prev) => {
      const n = prev.map((s) => ({ ...s }));
      if (position === POSITION_UNASSIGNED) {
        n[slotIndex] = { ...n[slotIndex], position: POSITION_UNASSIGNED };
        return dedupeFilledPositions(n);
      }
      const conflict = prev.findIndex(
        (s, i) =>
          i !== slotIndex &&
          s.player &&
          isLineupPosition(s.position) &&
          isLineupPosition(position) &&
          s.position === position
      );
      if (conflict >= 0) {
        const oldPos = n[slotIndex].position;
        n[slotIndex] = { ...n[slotIndex], position };
        n[conflict] = { ...n[conflict], position: oldPos };
      } else {
        n[slotIndex] = { ...n[slotIndex], position };
      }
      return dedupeFilledPositions(n);
    });
  }

  /** Assigned positions taken by other filled slots (blank does not reserve a position). */
  const positionsTakenByOthers = (slotIndex: number) => {
    const set = new Set<string>();
    lineup.forEach((s, i) => {
      if (i !== slotIndex && s.player && isLineupPosition(s.position)) set.add(s.position);
    });
    return set;
  };

  function handleConfirm() {
    const missingPos = lineup.some((s) => s.player && !isLineupPosition(s.position));
    if (missingPos) {
      setPositionError("Assign a position for every player (use — only while swapping; everyone needs a spot to save).");
      return;
    }
    if (hasDuplicatePositionsAmongFilled(lineup)) {
      setPositionError("Each position can only be used once. Fix duplicate positions before saving.");
      return;
    }
    const ordered: { player_id: string; position: string | null }[] = [];
    for (const s of lineup) {
      if (!s.player) continue;
      const pos: string | null = isLineupPosition(s.position) ? s.position : null;
      ordered.push({ player_id: s.player.id, position: pos });
    }
    onConfirm(ordered);
    onClose();
  }

  const activePlayer = activeId ? playerMap.get(activeId) ?? null : null;

  if (!open) return null;

  const poolEmpty = pool.length === 0;
  const nameOk = isOur || opponentName.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="opp-lineup-title"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div>
            <h2 id="opp-lineup-title" className="font-display text-sm font-semibold uppercase tracking-wider text-white">
              {isOur ? (lineupTitle?.trim() || "Lineup") : opponentName.trim() ? `Lineup — ${opponentName.trim()}` : "Lineup"}
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {isOur
                ? "Drag players into batting order. Available players are the main roster (pitchers excluded — set them on the game). Use “—” in Pos to clear a spot while swapping positions."
                : `Drag players into batting order. Pool shows hitters tagged for this opponent (pitchers excluded). Use “—” in Pos to clear a spot while swapping positions.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {positionError && (
            <p
              className="mb-3 rounded-lg border px-3 py-2 text-sm text-[var(--danger)]"
              style={{ borderColor: "var(--danger)", background: "var(--danger-dim)" }}
              role="alert"
            >
              {positionError}
            </p>
          )}
          {!nameOk && (
            <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--warning)]">
              Enter the other team name in the form first.
            </p>
          )}
          {nameOk && poolEmpty && isOur && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3 text-sm text-[var(--text-muted)]">
              <p>No club roster players yet (or all are tagged as opponents).</p>
              <Link href="/analyst/roster" className="mt-2 inline-block text-[var(--accent)] hover:underline">
                Add players in Analyst → Players
              </Link>
            </div>
          )}
          {nameOk && poolEmpty && !isOur && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3 text-sm text-[var(--text-muted)]">
              <p>No players tagged for this opponent yet.</p>
              <Link
                href={`/analyst/roster?opponentTeam=${encodeURIComponent(opponentName.trim())}`}
                className="mt-2 inline-block text-[var(--accent)] hover:underline"
              >
                Add opponent players in Analyst → Players
              </Link>
            </div>
          )}

          {nameOk && !poolEmpty && (
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <PlayerPoolDroppable>
                  <div className="card-tech flex min-h-[16rem] flex-col rounded-lg border border-[var(--border)] p-3">
                    <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Available ({availablePlayers.length})
                    </h3>
                    <div className="mt-2 max-h-[min(50vh,22rem)] space-y-2 overflow-y-auto pr-1">
                      {availablePlayers.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-2"
                        >
                          <DraggablePlayer player={p} />
                        </div>
                      ))}
                    </div>
                  </div>
                </PlayerPoolDroppable>

                <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                        <th className="font-display px-2 py-2 text-center text-xs font-semibold uppercase text-[var(--text-muted)]">
                          #
                        </th>
                        <th className="font-display px-2 py-2 text-center text-xs font-semibold uppercase text-[var(--text-muted)]">
                          Pos
                        </th>
                        <th className="font-display px-2 py-2 text-xs font-semibold uppercase text-[var(--text-muted)]">
                          Player
                        </th>
                        <th className="font-display px-2 py-2 text-center text-xs font-semibold uppercase text-[var(--text-muted)]">
                          B
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineup.map((slot, i) => (
                        <LineupRow
                          key={i}
                          slotIndex={i}
                          player={slot.player}
                          position={slot.position}
                          positionsTakenByOthers={positionsTakenByOthers(i)}
                          onPositionChange={setSlotPosition}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <DragOverlay>
                {activePlayer ? (
                  <div className="rounded border border-[var(--accent)] bg-[var(--bg-card)] px-3 py-2 shadow-lg">
                    <span className="font-medium text-[var(--text)]">{activePlayer.name}</span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!nameOk}
            className="font-display rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] disabled:opacity-50"
          >
            Save lineup
          </button>
        </div>
      </div>
    </div>
  );
}
