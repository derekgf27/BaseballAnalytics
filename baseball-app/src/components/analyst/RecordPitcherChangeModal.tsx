"use client";

import { useMemo, useState } from "react";
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
import type { Player } from "@/lib/types";
import { comparePlayersByLastNameThenFull } from "@/lib/playerSort";

const MOUND_ID = "record-pitch-change-mound";

function throwsLabel(p: Player): string {
  if (p.throws === "L" || p.throws === "R") return `${p.throws}HP`;
  return "—";
}

/** Jersey + handedness for accent line; `null` if neither is set. */
function jerseyAndHandednessLine(p: Player): string | null {
  const j = p.jersey?.trim();
  const tl = throwsLabel(p);
  const parts: string[] = [];
  if (j) parts.push(`#${j}`);
  if (tl !== "—") parts.push(tl);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function DraggableArm({ player }: { player: Player }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
    data: { player },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex cursor-grab items-center justify-between gap-2 rounded-lg border-2 border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3 active:cursor-grabbing touch-manipulation ${
        isDragging ? "opacity-50" : "hover:border-[var(--accent)]/50"
      }`}
    >
      <div className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[var(--text)]">{player.name}</span>
        <span className="mt-0.5 block text-[11px] font-semibold text-[var(--accent)]">
          {jerseyAndHandednessLine(player) ?? "—"}
        </span>
      </div>
      <span className="shrink-0 text-lg text-[var(--text-faint)]" aria-hidden>
        ⋮⋮
      </span>
    </div>
  );
}

function DragOverlayArm({ player }: { player: Player }) {
  const meta = jerseyAndHandednessLine(player);
  return (
    <div className="rounded-lg border-2 border-[var(--accent)] bg-[var(--bg-card)] px-4 py-3 shadow-xl">
      <span className="font-semibold text-[var(--text)]">{player.name}</span>
      {meta ? <span className="ml-2 text-xs font-semibold text-[var(--accent)]">{meta}</span> : null}
    </div>
  );
}

function MoundZone({ current, draggingAvailableArm }: { current: Player | null; draggingAvailableArm: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: MOUND_ID });
  const highlight = isOver || draggingAvailableArm;
  return (
    <div
      ref={setNodeRef}
      className={`flex h-full min-h-[12rem] flex-col justify-center rounded-xl border-2 border-dashed px-4 py-6 transition md:min-h-0 md:py-8 ${
        highlight
          ? "border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]/30"
          : "border-[var(--border)] bg-[var(--bg-elevated)]"
      }`}
    >
      <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        On the mound
      </p>
      {current ? (
        <div className="mt-3 text-center">
          <p className="font-display text-lg font-bold tracking-tight text-[var(--text)]">{current.name}</p>
          <p className="mt-1 text-sm font-semibold text-[var(--accent)]">
            {jerseyAndHandednessLine(current) ?? "—"}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-center text-sm text-[var(--text-muted)]">No pitcher selected — drag an arm here</p>
      )}
      <p className="mt-4 text-center text-[11px] leading-snug text-[var(--text-faint)]">
        Drop a pitcher from the bullpen column to change arms.
      </p>
    </div>
  );
}

export interface RecordPitcherChangeModalProps {
  open: boolean;
  onClose: () => void;
  /** Defensive team name (who is pitching). */
  teamName: string;
  currentPitcherId: string | null;
  /** Same roster list as the former Record pitcher dropdown. */
  pitchers: Player[];
  onApply: (playerId: string) => void;
}

export function RecordPitcherChangeModal({
  open,
  onClose,
  teamName,
  currentPitcherId,
  pitchers,
  onApply,
}: RecordPitcherChangeModalProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const playerMap = useMemo(() => new Map(pitchers.map((p) => [p.id, p])), [pitchers]);
  const current = currentPitcherId ? playerMap.get(currentPitcherId) ?? null : null;

  const availableArms = useMemo(() => {
    const list = currentPitcherId
      ? pitchers.filter((p) => p.id !== currentPitcherId)
      : [...pitchers];
    return [...list].sort(comparePlayersByLastNameThenFull);
  }, [pitchers, currentPitcherId]);

  const activePlayer = activeId ? playerMap.get(activeId) ?? null : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || String(over.id) !== MOUND_ID) return;
    const nextId = String(active.id);
    if (!playerMap.has(nextId)) return;
    if (nextId === currentPitcherId) return;
    onApply(nextId);
  }

  if (!open) return null;

  const emptyRoster = pitchers.length === 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-pitch-change-title"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div>
            <h2
              id="record-pitch-change-title"
              className="font-display text-sm font-semibold uppercase tracking-wider text-white"
            >
              Pitching change
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              <span className="font-medium text-[var(--text)]">{teamName}</span> — drag a pitcher onto the mound to
              put them in the game.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {emptyRoster ? (
            <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-4 text-sm text-[var(--text-muted)]">
              No pitchers on this roster. Add pitchers (position P + throwing hand) for the defensive team.
            </p>
          ) : (
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="grid min-h-0 grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 md:items-stretch">
                <div className="flex min-h-[12rem] flex-col md:min-h-[min(50vh,20rem)]">
                  <MoundZone
                    current={current}
                    draggingAvailableArm={activeId != null && availableArms.some((p) => p.id === activeId)}
                  />
                </div>
                <div className="flex min-h-0 min-w-0 flex-col md:border-l md:border-[var(--border)] md:pl-6">
                  <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Available arms ({availableArms.length})
                  </h3>
                  <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">
                    Drag onto the mound. The previous pitcher shows here again automatically.
                  </p>
                  <div className="mt-2 max-h-[min(50vh,22rem)] min-h-0 space-y-2 overflow-y-auto pr-1">
                    {availableArms.map((p) => (
                      <DraggableArm key={p.id} player={p} />
                    ))}
                  </div>
                </div>
              </div>
              <DragOverlay dropAnimation={null}>
                {activePlayer ? <DragOverlayArm player={activePlayer} /> : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        <div className="flex justify-end border-t border-[var(--border)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="font-display rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
