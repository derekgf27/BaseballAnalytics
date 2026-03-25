"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import type { TrackedOpponentRow } from "@/lib/db/queries";
import { opponentNameKey } from "@/lib/opponentUtils";
import {
  addTrackedOpponentAction,
  deleteTrackedOpponentAction,
  updateTrackedOpponentAction,
} from "./actions";

function trackedRowForDisplayName(
  displayName: string,
  tracked: TrackedOpponentRow[]
): TrackedOpponentRow | undefined {
  const key = opponentNameKey(displayName);
  return tracked.find((t) => opponentNameKey(t.name) === key);
}

export function OpponentsPageClient({
  names,
  tracked,
}: {
  names: string[];
  tracked: TrackedOpponentRow[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = editId !== null;

  function closeModal() {
    setModalOpen(false);
    setEditId(null);
    setTeamName("");
    setError(null);
    setDeleteConfirmOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = isEdit
      ? await updateTrackedOpponentAction(editId!, teamName)
      : await addTrackedOpponentAction(teamName);
    setSaving(false);
    if (result.ok) {
      closeModal();
      router.refresh();
    } else {
      setError(result.error ?? "Could not save.");
    }
  }

  function openDeleteConfirm() {
    setDeleteConfirmOpen(true);
  }

  async function confirmDeleteOpponent() {
    if (!editId) return;
    setDeleting(true);
    setError(null);
    const result = await deleteTrackedOpponentAction(editId);
    setDeleting(false);
    if (result.ok) {
      setDeleteConfirmOpen(false);
      closeModal();
      router.refresh();
    } else {
      setDeleteConfirmOpen(false);
      setError(result.error ?? "Could not delete.");
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">Opponents</h1>
        <button
          type="button"
          onClick={() => {
            setEditId(null);
            setTeamName("");
            setError(null);
            setModalOpen(true);
          }}
          className="font-display inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] transition hover:opacity-90"
        >
          Add opponent
        </button>
      </div>

      {names.length === 0 ? (
        <div className="card-tech rounded-lg border border-dashed border-[var(--border)] p-8 text-center">
          <p className="font-medium text-[var(--text)]">No opponents yet</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Add a name above, or add games in Analyst → Games so opponents appear from your matchups.
          </p>
          <Link href="/analyst/games" className="mt-4 inline-block text-sm text-[var(--accent)] hover:underline">
            Go to Games →
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {names.map((name) => {
            const slug = encodeURIComponent(name);
            const row = trackedRowForDisplayName(name, tracked);
            return (
              <li key={name}>
                <div className="card-tech flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-4">
                  <span className="min-w-0 font-semibold text-[var(--text)]">{name}</span>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {row && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(row.id);
                          setTeamName(row.name);
                          setError(null);
                          setModalOpen(true);
                        }}
                        className="font-display inline-flex items-center justify-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--text)] transition hover:bg-[var(--bg-elevated)]"
                      >
                        Edit
                      </button>
                    )}
                    <Link
                      href={`/analyst/opponents/${slug}`}
                      className="font-display inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] transition hover:opacity-90"
                      aria-label={`View roster and stats for ${name}`}
                    >
                      View roster & stats →
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !saving && !deleting && !deleteConfirmOpen && closeModal()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={isEdit ? "edit-opponent-title" : "add-opponent-title"}
        >
          <div
            className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id={isEdit ? "edit-opponent-title" : "add-opponent-title"}
              className="font-display text-lg font-semibold text-[var(--text)]"
            >
              {isEdit ? "Edit opponent" : "Add opponent"}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Enter the other team&apos;s name.</p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs text-[var(--text-muted)]">Team name</span>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="input-tech mt-1 block w-full px-3 py-2"
                  placeholder="e.g. Salinas"
                  autoFocus
                  required
                  disabled={saving || deleting}
                />
              </label>
              {error && (
                <p className="text-sm text-[var(--danger)]" role="alert">
                  {error}
                </p>
              )}
              <div
                className={`flex flex-wrap items-center gap-2 pt-2 ${isEdit ? "justify-between" : "justify-end"}`}
              >
                {isEdit && (
                  <button
                    type="button"
                    onClick={openDeleteConfirm}
                    disabled={saving || deleting}
                    className="rounded-lg border border-[var(--danger)] px-4 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger)]/10 disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => closeModal()}
                    disabled={saving || deleting}
                    className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || deleting}
                    className="font-display rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDeleteDialog
        open={modalOpen && deleteConfirmOpen}
        onClose={() => !deleting && setDeleteConfirmOpen(false)}
        title="Delete opponent?"
        description="This removes the saved name from your list. If you have games against this team, they can still show up from your schedule."
        confirmLabel="Delete opponent"
        pendingLabel="Deleting…"
        onConfirm={confirmDeleteOpponent}
        pending={deleting}
      />
    </>
  );
}
