"use client";

import { useEffect, useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { preparePlayerRosterPayload } from "@/lib/playerRoster";
import type { Player } from "@/lib/types";

export type QuickAddPitcherCreatedPayload = {
  player: Player;
};

export interface QuickAddPitcherModalProps {
  open: boolean;
  onClose: () => void;
  /** Opponent organization name — stored on `player.opponent_team`. */
  opponentTeam: string;
  onSave: (player: Omit<Player, "id" | "created_at">) => Promise<Player | null>;
  onCreated: (payload: QuickAddPitcherCreatedPayload) => void | Promise<void>;
}

export function QuickAddPitcherModal({
  open,
  onClose,
  opponentTeam,
  onSave,
  onCreated,
}: QuickAddPitcherModalProps) {
  const dialogRef = useFocusTrap(open);
  const [name, setName] = useState("");
  const [jersey, setJersey] = useState("");
  const [throws, setThrows] = useState<"L" | "R" | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamLabel = opponentTeam.trim();

  useEffect(() => {
    if (!open) return;
    setName("");
    setJersey("");
    setThrows("");
    setSaving(false);
    setError(null);
  }, [open, teamLabel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Enter a pitcher name.");
      return;
    }
    if (throws !== "L" && throws !== "R") {
      setError("Select throwing hand (L or R).");
      return;
    }
    setSaving(true);
    setError(null);
    const rosterFields = preparePlayerRosterPayload({
      positions: ["P"],
      primary_position: "P",
      roster_status: "active",
    });
    try {
      const created = await onSave({
        name: trimmedName,
        jersey: jersey.trim() || null,
        ...rosterFields,
        bats: null,
        throws,
        height_in: null,
        weight_lb: null,
        hometown: null,
        birth_date: null,
        opponent_team: teamLabel || null,
        staff_notes: null,
      });
      if (!created) {
        setError("Could not add pitcher. Check your connection and try again.");
        setSaving(false);
        return;
      }
      await onCreated({ player: created });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add pitcher.");
      setSaving(false);
    }
  };

  if (!open) return null;

  const fieldLabel =
    "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]";
  const handChipBase =
    "shrink-0 min-h-10 min-w-[3.5rem] rounded-lg border px-4 py-2 text-sm font-semibold transition";
  const handChipOn =
    "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]/25";
  const handChipOff =
    "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text)]";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={() => !saving && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-add-pitcher-title"
    >
      <div
        ref={dialogRef}
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-[var(--border)] px-4 py-3 sm:px-5">
            <h2
              id="quick-add-pitcher-title"
              className="font-display text-sm font-semibold uppercase tracking-wider text-white"
            >
              Add pitcher
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
                placeholder="12"
                maxLength={4}
                disabled={saving}
              />
            </label>

            <div>
              <span className={fieldLabel}>Throws</span>
              <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Throws handedness">
                {(
                  [
                    { v: "L" as const, label: "Left" },
                    { v: "R" as const, label: "Right" },
                  ] as const
                ).map(({ v, label }) => (
                  <button
                    key={v}
                    type="button"
                    disabled={saving}
                    onClick={() => setThrows(v)}
                    className={`${handChipBase} ${throws === v ? handChipOn : handChipOff}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
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
              type="submit"
              disabled={saving}
              className="font-orbitron rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg-base)] transition hover:opacity-95 disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add & select"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
