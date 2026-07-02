"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { RosterPositionSelector } from "@/components/analyst/RosterPositionSelector";
import { ROSTER_POSITION_CODES } from "@/lib/rosterPositions";
import { preparePlayerRosterPayload } from "@/lib/playerRoster";
import { isPitcherPlayer } from "@/lib/opponentUtils";
import {
  firstEmptyLineupSlot,
  isLineupSlotSelectable,
  maxSelectableLineupSlot,
} from "@/lib/record/recordLineupSlots";
import type { Player } from "@/lib/types";

const POSITION_OPTIONS = ROSTER_POSITION_CODES;

export type QuickAddPlayerCreatedPayload = {
  player: Player;
  lineupSlot: number;
  lineupPosition: string | null;
};

export interface QuickAddPlayerModalProps {
  open: boolean;
  onClose: () => void;
  /** Opponent organization name — stored on `player.opponent_team`. */
  opponentTeam: string;
  /** Current batting-order ids (slot 1 = index 0). */
  lineupOrder: string[];
  players: Player[];
  onSave: (player: Omit<Player, "id" | "created_at">) => Promise<Player | null>;
  onCreated: (payload: QuickAddPlayerCreatedPayload) => void | Promise<void>;
}

function slotOccupantLabel(
  slot: number,
  lineupOrder: string[],
  players: Player[]
): string | null {
  const idx = slot - 1;
  const id = lineupOrder[idx];
  if (!id) return null;
  const p = players.find((pl) => pl.id === id);
  if (!p) return "Filled";
  const jersey = p.jersey?.trim();
  return jersey ? `#${jersey} ${p.name.trim()}` : p.name.trim();
}

export function QuickAddPlayerModal({
  open,
  onClose,
  opponentTeam,
  lineupOrder,
  players,
  onSave,
  onCreated,
}: QuickAddPlayerModalProps) {
  const dialogRef = useFocusTrap(open);
  const submitRef = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState("");
  const [jersey, setJersey] = useState("");
  const [bats, setBats] = useState<"L" | "R" | "S" | "">("");
  const [throws, setThrows] = useState<"L" | "R" | "">("");
  const [positions, setPositions] = useState<string[]>(["DH"]);
  const [primaryPosition, setPrimaryPosition] = useState<string | null>("DH");
  const [lineupSlot, setLineupSlot] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamLabel = opponentTeam.trim();
  const defaultSlot = useMemo(() => firstEmptyLineupSlot(lineupOrder), [lineupOrder]);
  const maxSlot = useMemo(() => maxSelectableLineupSlot(lineupOrder), [lineupOrder]);

  useEffect(() => {
    if (!open) return;
    setName("");
    setJersey("");
    setBats("");
    setThrows("");
    setPositions(["DH"]);
    setPrimaryPosition("DH");
    setLineupSlot(firstEmptyLineupSlot(lineupOrder));
    setSaving(false);
    setError(null);
  }, [open, teamLabel, lineupOrder]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  const togglePosition = (pos: string) => {
    setPositions((prev) => {
      if (prev.includes(pos)) {
        const next = prev.filter((p) => p !== pos);
        setPrimaryPosition((current) =>
          current === pos ? (next[0] ?? null) : current && next.includes(current) ? current : next[0] ?? null
        );
        return next;
      }
      const next = [...prev, pos];
      setPrimaryPosition((current) => current ?? pos);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Enter a player name.");
      return;
    }
    if (positions.length === 0) {
      setError("Select at least one position.");
      return;
    }
    if (!isLineupSlotSelectable(lineupOrder, lineupSlot)) {
      setError("Pick a valid lineup slot (no gaps in the order).");
      return;
    }
    const draftForRole = {
      name: trimmedName,
      positions,
    } as Player;
    const savePositions =
      positions.includes("P") && positions.some((p) => p !== "P")
        ? positions.filter((p) => p !== "P")
        : positions;
    if (savePositions.length === 0 || isPitcherPlayer({ ...draftForRole, positions: savePositions })) {
      setError("Pick a field position (not pitcher only) to log an at-bat.");
      return;
    }
    setSaving(true);
    setError(null);
    const savePrimary =
      primaryPosition && savePositions.includes(primaryPosition)
        ? primaryPosition
        : savePositions[0] ?? null;
    const rosterFields = preparePlayerRosterPayload({
      positions: savePositions,
      primary_position: savePrimary,
      roster_status: "active",
    });
    const lineupPosition =
      savePrimary && savePrimary !== "P" ? savePrimary : savePositions.find((p) => p !== "P") ?? null;
    try {
      const created = await onSave({
        name: trimmedName,
        jersey: jersey.trim() || null,
        ...rosterFields,
        bats: bats === "" ? null : bats,
        throws: throws === "" ? null : throws,
        height_in: null,
        weight_lb: null,
        hometown: null,
        birth_date: null,
        opponent_team: teamLabel || null,
        staff_notes: null,
      });
      if (!created) {
        setError("Could not add player. Check your connection and try again.");
        setSaving(false);
        return;
      }
      await onCreated({
        player: created,
        lineupSlot,
        lineupPosition,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add player.");
      setSaving(false);
    }
  };

  if (!open) return null;

  const fieldLabel =
    "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]";
  const handChipBase =
    "shrink-0 min-h-9 rounded-lg border px-3 py-1.5 text-sm font-semibold transition";
  const handChipOn =
    "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]/25";
  const handChipOff =
    "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text)]";
  const slotChipBase =
    "flex min-h-[3.25rem] flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-center transition";

  const draftPlayer = {
    name: name.trim() || "X",
    positions:
      positions.includes("P") && positions.some((p) => p !== "P")
        ? positions.filter((p) => p !== "P")
        : positions,
  } as Player;
  const isPitcherOnly =
    positions.length > 0 &&
    positions.every((p) => p === "P") &&
    isPitcherPlayer(draftPlayer);

  return (
    <div
      className="modal-overlay fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4"
      onClick={() => !saving && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-add-player-title"
    >
      <div
        ref={dialogRef}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-[var(--border)] px-4 py-3 sm:px-5">
            <h2
              id="quick-add-player-title"
              className="font-display text-sm font-semibold uppercase tracking-wider text-white"
            >
              Add player
            </h2>
            {teamLabel ? (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Tagged for <span className="font-medium text-[var(--text)]">{teamLabel}</span>
              </p>
            ) : null}
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            {error ? (
              <p
                className="rounded-lg border border-[var(--danger)] bg-[var(--danger-dim)] px-3 py-2 text-sm text-[var(--danger)]"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <label className="block min-w-0">
              <span className={fieldLabel}>Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-tech mt-1 block w-full px-3 py-2.5 text-base"
                placeholder="Full name"
                autoComplete="name"
                autoFocus
                disabled={saving}
              />
            </label>

            <label className="block min-w-0 max-w-[8rem]">
              <span className={fieldLabel}>Jersey</span>
              <input
                type="text"
                inputMode="numeric"
                value={jersey}
                onChange={(e) => setJersey(e.target.value)}
                className="input-tech mt-1 block w-full px-3 py-2.5 text-base tabular-nums"
                placeholder="7"
                maxLength={4}
                disabled={saving}
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <span className={fieldLabel}>Bats</span>
                <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Bats handedness">
                  {(
                    [
                      { v: "L" as const, label: "L" },
                      { v: "R" as const, label: "R" },
                      { v: "S" as const, label: "S" },
                    ] as const
                  ).map(({ v, label }) => (
                    <button
                      key={v}
                      type="button"
                      disabled={saving}
                      onClick={() => setBats(bats === v ? "" : v)}
                      className={`${handChipBase} ${bats === v ? handChipOn : handChipOff}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className={fieldLabel}>Throws</span>
                <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Throws handedness">
                  {(
                    [
                      { v: "L" as const, label: "L" },
                      { v: "R" as const, label: "R" },
                    ] as const
                  ).map(({ v, label }) => (
                    <button
                      key={v}
                      type="button"
                      disabled={saving}
                      onClick={() => setThrows(throws === v ? "" : v)}
                      className={`${handChipBase} ${throws === v ? handChipOn : handChipOff}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <span className={fieldLabel}>Field position</span>
              <div className="mt-1.5 rounded-lg border border-[var(--border)]/70 bg-[var(--bg-elevated)]/20 p-3">
                <RosterPositionSelector
                  selected={positions.filter((p) =>
                    POSITION_OPTIONS.includes(p as (typeof POSITION_OPTIONS)[number])
                  )}
                  onToggle={togglePosition}
                  primaryPosition={primaryPosition}
                  onSetPrimary={setPrimaryPosition}
                  disabled={saving}
                  focusAfterPitcherRef={submitRef}
                />
              </div>
              {isPitcherOnly ? (
                <p className="mt-2 text-[10px] leading-snug text-[var(--warning)]">
                  Pitchers are not selectable as batters in Record — pick a field position to log this at-bat.
                </p>
              ) : null}
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                <span className={fieldLabel}>Lineup slot</span>
                <button
                  type="button"
                  disabled={saving || lineupSlot === defaultSlot}
                  onClick={() => setLineupSlot(defaultSlot)}
                  className="text-[10px] font-medium text-[var(--accent)] underline decoration-dotted underline-offset-2 hover:opacity-90 disabled:cursor-default disabled:no-underline disabled:opacity-40"
                >
                  Auto (#{defaultSlot})
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="group" aria-label="Batting order slot">
                {Array.from({ length: 9 }, (_, i) => i + 1).map((slot) => {
                  const selectable = isLineupSlotSelectable(lineupOrder, slot);
                  const occupant = slotOccupantLabel(slot, lineupOrder, players);
                  const selected = lineupSlot === slot;
                  const isDefault = slot === defaultSlot && selectable;
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={saving || !selectable}
                      aria-pressed={selected}
                      aria-label={
                        occupant
                          ? `Slot ${slot}, ${occupant}${selected ? ", selected" : ""}`
                          : `Slot ${slot}, empty${selected ? ", selected" : ""}`
                      }
                      onClick={() => setLineupSlot(slot)}
                      className={`${slotChipBase} ${
                        selected
                          ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]/25"
                          : selectable
                            ? "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text)]"
                            : "cursor-not-allowed border-[var(--border)]/50 bg-[var(--bg-elevated)]/30 text-[var(--text-faint)] opacity-50"
                      }`}
                    >
                      <span className="font-display text-sm font-bold tabular-nums">{slot}</span>
                      <span className="mt-0.5 line-clamp-2 w-full text-[9px] leading-tight">
                        {occupant ? occupant : isDefault ? "Next" : selectable ? "Open" : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] leading-snug text-[var(--text-faint)]">
                Defaults to slot #{defaultSlot}
                {lineupOrder.length >= 9 ? " (replace someone)" : " (next open spot)"}. Slots beyond #
                {maxSlot} are disabled until the order is filled in sequence.
              </p>
            </div>
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:text-[var(--text)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              ref={submitRef}
              type="submit"
              disabled={saving}
              className="font-orbitron rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg-base)] transition hover:opacity-95 disabled:opacity-50"
            >
              {saving ? "Adding…" : `Add to #${lineupSlot}`}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
