"use client";

import { useEffect, useMemo, useState } from "react";
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
import { isPitcherPlayer, playersForGameSideWhenNoLineup } from "@/lib/opponentUtils";
import type { Game, LineupSide, Player } from "@/lib/types";
import { comparePlayersByLastNameThenFull } from "@/lib/playerSort";

/** Field positions only — pitchers are set on the game, not in this modal. */
const LINEUP_POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"] as const;

const POSITION_UNASSIGNED = "";

function isLineupPosition(pos: string): pos is (typeof LINEUP_POSITIONS)[number] {
  return LINEUP_POSITIONS.includes(pos as (typeof LINEUP_POSITIONS)[number]);
}

type LineupSlotState = { player: Player | null; position: string };

function defaultPositionForPlayer(_p: Player | undefined): (typeof LINEUP_POSITIONS)[number] {
  return "DH";
}

function lineupToSlotsState(
  order: string[],
  positionByPlayerId: Record<string, string>,
  playerMap: Map<string, Player>
): LineupSlotState[] {
  const next: LineupSlotState[] = Array.from({ length: 9 }, () => ({
    player: null,
    position: LINEUP_POSITIONS[0],
  }));
  for (let i = 0; i < Math.min(9, order.length); i++) {
    const pid = order[i]!;
    const p = playerMap.get(pid);
    const raw = positionByPlayerId[pid];
    const pos =
      raw && isLineupPosition(raw) ? raw : defaultPositionForPlayer(p);
    next[i] = { player: p ?? null, position: pos };
  }
  return dedupeFilledPositions(next);
}

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

function batsShort(bats: string | null | undefined): string {
  if (bats == null || bats === "") return "—";
  const c = bats.toUpperCase()[0];
  return c === "S" ? "S" : c === "L" ? "L" : c === "R" ? "R" : "—";
}

function DraggablePlayer({ player }: { player: Player }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
    data: { player },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className="min-w-0 flex-1">
      <div
        className={`flex cursor-grab items-center gap-2 active:cursor-grabbing ${isDragging ? "opacity-50" : ""}`}
      >
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
  const { setNodeRef, isOver } = useDroppable({ id: `record-sub-slot-${slotIndex}` });

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
  const { setNodeRef, isOver } = useDroppable({ id: "record-sub-pool" });
  return (
    <div
      ref={setNodeRef}
      className={`transition ${isOver ? "rounded-lg ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-base)]" : ""}`}
    >
      {children}
    </div>
  );
}

export interface RecordSubstitutionModalProps {
  open: boolean;
  onClose: () => void;
  gameId: string;
  game: Pick<Game, "home_team" | "away_team" | "our_side">;
  /** Which team’s lineup to open on (usually the team at bat). */
  defaultSide: LineupSide;
  awayLineup: { order: string[]; positionByPlayerId: Record<string, string> };
  homeLineup: { order: string[]; positionByPlayerId: Record<string, string> };
  players: Player[];
  onSave: (
    gameId: string,
    side: LineupSide,
    slots: { player_id: string; position?: string | null }[]
  ) => Promise<{ ok: boolean; error?: string }>;
  onApplied: (
    side: LineupSide,
    order: string[],
    positionByPlayerId: Record<string, string>
  ) => void;
}

export function RecordSubstitutionModal({
  open,
  onClose,
  gameId,
  game,
  defaultSide,
  awayLineup,
  homeLineup,
  players,
  onSave,
  onApplied,
}: RecordSubstitutionModalProps) {
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const [side, setSide] = useState<LineupSide>(defaultSide);
  const [lineup, setLineup] = useState<LineupSlotState[]>(() =>
    Array.from({ length: 9 }, () => ({ player: null, position: LINEUP_POSITIONS[0] }))
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSide(defaultSide);
  }, [open, defaultSide]);

  useEffect(() => {
    if (!open) return;
    const src = side === "away" ? awayLineup : homeLineup;
    setLineup(lineupToSlotsState(src.order, src.positionByPlayerId, playerMap));
    setPositionError(null);
  }, [open, side, awayLineup, homeLineup, playerMap]);

  const pool = useMemo(
    () =>
      playersForGameSideWhenNoLineup(game, side, players).filter((p) => !isPitcherPlayer(p)),
    [game, side, players]
  );

  const inLineupIds = new Set(lineup.filter((s) => s.player != null).map((s) => s.player!.id));
  const availablePlayers = [...pool.filter((p) => !inLineupIds.has(p.id))].sort(
    comparePlayersByLastNameThenFull
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const sideLabel = side === "away" ? game.away_team : game.home_team;

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

    if (overId === "record-sub-pool") {
      const currentSlot = lineup.findIndex((s) => s.player?.id === playerId);
      if (currentSlot < 0) return;
      setLineup((prev) => {
        const next = prev.map((s) => ({ ...s }));
        next[currentSlot] = { player: null, position: LINEUP_POSITIONS[0] };
        return next;
      });
      return;
    }

    // No pitchers in lineup slots (bench pool already excludes them).
    if (isPitcherPlayer(player)) return;

    if (!overId.startsWith("record-sub-slot-")) return;
    const slotIndex = parseInt(overId.replace("record-sub-slot-", ""), 10);
    if (slotIndex < 0 || slotIndex > 8) return;

    const currentSlot = lineup.findIndex((s) => s.player?.id === playerId);
    const displacedSlot = lineup[slotIndex];

    setLineup((prev) => {
      const next = prev.map((s) => ({ ...s }));
      const primaryPosition = player.positions?.[0];
      const preferred =
        primaryPosition && LINEUP_POSITIONS.includes(primaryPosition as (typeof LINEUP_POSITIONS)[number])
          ? primaryPosition
          : defaultPositionForPlayer(player);
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

  const positionsTakenByOthers = (slotIndex: number) => {
    const set = new Set<string>();
    lineup.forEach((s, i) => {
      if (i !== slotIndex && s.player && isLineupPosition(s.position)) set.add(s.position);
    });
    return set;
  };

  async function handleConfirm() {
    const hasPitcherInLineup = lineup.some((s) => s.player && isPitcherPlayer(s.player));
    if (hasPitcherInLineup) {
      setPositionError(
        "Remove or replace all pitchers in the lineup here — starting pitchers are set on the game, not in this modal."
      );
      return;
    }
    const missingPlayer = lineup.some((s) => !s.player);
    if (missingPlayer) {
      setPositionError("Fill all nine spots (drag players from the bench or swap within the order).");
      return;
    }
    const missingPos = lineup.some((s) => s.player && !isLineupPosition(s.position));
    if (missingPos) {
      setPositionError(
        "Assign a position for every player (use — only while swapping; everyone needs a spot to save)."
      );
      return;
    }
    if (hasDuplicatePositionsAmongFilled(lineup)) {
      setPositionError("Each position can only be used once. Fix duplicate positions before saving.");
      return;
    }
    const slots: { player_id: string; position: string | null }[] = lineup.map((s) => ({
      player_id: s.player!.id,
      position: isLineupPosition(s.position) ? s.position : null,
    }));
    setSaving(true);
    setPositionError(null);
    const result = await onSave(gameId, side, slots);
    setSaving(false);
    if (!result.ok) {
      setPositionError(result.error ?? "Failed to save lineup.");
      return;
    }
    const order = slots.map((s) => s.player_id);
    const positionByPlayerId: Record<string, string> = {};
    for (const s of slots) {
      if (s.position) positionByPlayerId[s.player_id] = s.position;
    }
    onApplied(side, order, positionByPlayerId);
    onClose();
  }

  const activePlayer = activeId ? playerMap.get(activeId) ?? null : null;

  if (!open) return null;

  const poolEmpty = pool.length === 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-sub-title"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div>
            <h2
              id="record-sub-title"
              className="font-display text-sm font-semibold uppercase tracking-wider text-white"
            >
              Substitution
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Drag between slots or from the bench. Change Pos for defensive switches. Pitchers are excluded — set
              them on the game. Saves replace this game’s lineup for the selected team.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["away", "home"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${
                    side === s
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)]"
                      : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:border-[var(--accent)]/50"
                  }`}
                >
                  {s === "away" ? game.away_team : game.home_team}
                </button>
              ))}
            </div>
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
          {poolEmpty ? (
            <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3 text-sm text-[var(--text-muted)]">
              No non-pitcher roster players for <span className="font-medium text-[var(--text)]">{sideLabel}</span>.
              Check opponent tags (away/home) or club roster. (Pitchers are set on the game.)
            </p>
          ) : (
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <PlayerPoolDroppable>
                  <div className="card-tech flex min-h-[16rem] flex-col rounded-lg border border-[var(--border)] p-3">
                    <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Bench / available ({availablePlayers.length})
                    </h3>
                    <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">
                      Drag to a lineup row. Drag from a row back here to pull someone from the game.
                    </p>
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
            disabled={saving || poolEmpty}
            className="font-display rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save lineup"}
          </button>
        </div>
      </div>
    </div>
  );
}
