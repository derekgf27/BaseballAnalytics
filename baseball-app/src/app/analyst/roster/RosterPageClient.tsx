"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isDemoId } from "@/lib/db/mockData";
import { dataEditBlockedMessage } from "@/lib/demoMode";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { FlashMessage } from "@/components/shared/FlashMessage";
import { useFlashMessage } from "@/hooks/useFlashMessage";
import {
  deletePlayerAction,
  deletePlayersAction,
  getBulkPlayerDeletionPreviewAction,
  getPlayerDeletionPreviewAction,
  insertPlayerAction,
  updatePlayerAction,
} from "./actions";
import type { PlayerDeletionPreview } from "@/lib/types";
import { isClubRosterPlayer, opponentNameKey } from "@/lib/opponentUtils";
import { analystPlayerProfileHref } from "@/lib/analystRoutes";
import {
  compareRosterPlayers,
  type RosterSortDir,
  type RosterSortKey,
} from "@/lib/playerSort";
import {
  RosterPositionSelector,
  ROSTER_POSITION_CODES,
} from "@/components/analyst/RosterPositionSelector";
import {
  formatPositionsDisplay,
  getPlayerPrimaryPosition,
  PLAYER_ROSTER_STATUSES,
  PLAYER_ROSTER_STATUS_LABELS,
  preparePlayerRosterPayload,
  resolveRosterStatus,
  rosterStatusBadgeClass,
} from "@/lib/playerRoster";
import type { Player, PlayerRosterStatus } from "@/lib/types";
import { isTypingInFormField } from "@/lib/record/recordKeyboard";

const POSITION_OPTIONS = ROSTER_POSITION_CODES;

function rosterBatsThrowsSummary(p: Pick<Player, "bats" | "throws">): string | null {
  const parts: string[] = [];
  if (p.bats) parts.push(`Bats ${p.bats}`);
  if (p.throws) parts.push(`Throws ${p.throws}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function playerMatchesRosterSearch(player: Player, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const status =
    resolveRosterStatus(player) !== "active"
      ? PLAYER_ROSTER_STATUS_LABELS[resolveRosterStatus(player)]
      : "";
  const haystack = [
    player.name,
    player.jersey ?? "",
    player.primary_position ?? "",
    ...(player.positions ?? []),
    formatPositionsDisplay(player),
    player.bats ?? "",
    player.throws ?? "",
    player.hometown ?? "",
    status,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

interface RosterPageClientProps {
  initialPlayers: Player[];
  canEdit: boolean;
  /** When set (opponent roster URL), list is scoped to this team and add/edit locks that opponent. */
  defaultOpponentTeam?: string | null;
}

type SupabaseStatus = "loading" | "connected" | { error: string };

export function RosterPageClient({
  initialPlayers,
  canEdit,
  defaultOpponentTeam,
}: RosterPageClientProps) {
  const router = useRouter();
  const [players, setPlayers] = useState(initialPlayers);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const { message, dismissing: messageDismissing, show: showFlash } = useFlashMessage();
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus>("loading");
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);
  const [deletePreview, setDeletePreview] = useState<PlayerDeletionPreview | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeletePreview, setBulkDeletePreview] = useState<
    { id: string; preview: PlayerDeletionPreview | null }[] | null
  >(null);
  const [bulkDeletePending, setBulkDeletePending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<RosterSortKey>("name");
  const [sortDir, setSortDir] = useState<RosterSortDir>("asc");

  const checkSupabaseStatus = () => {
    setSupabaseStatus("loading");
    fetch("/api/supabase-status")
      .then((res) => res.json())
      .then((body) => {
        if (body.connected) setSupabaseStatus("connected");
        else setSupabaseStatus({ error: body.error ?? "Connection failed" });
      })
      .catch(() => {
        setSupabaseStatus({
          error: "Database may be starting up (e.g. after resuming). Wait a minute and try again.",
        });
      });
  };

  useEffect(() => {
    checkSupabaseStatus();
  }, []);

  useEffect(() => {
    setPlayers(initialPlayers);
  }, [initialPlayers]);

  const playerFormOpen = showAddForm || editingPlayer != null;

  const closePlayerForm = () => {
    setShowAddForm(false);
    setEditingPlayer(null);
  };

  useEffect(() => {
    if (!playerFormOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePlayerForm();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [playerFormOpen]);

  useEffect(() => {
    if (!canEdit || playerFormOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingInFormField(e.target)) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        setEditingPlayer(null);
        setShowAddForm(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canEdit, playerFormOpen]);

  useEffect(() => {
    if (!deleteTarget?.id) {
      setDeletePreview(null);
      return;
    }
    let cancelled = false;
    void getPlayerDeletionPreviewAction(deleteTarget.id).then((p) => {
      if (!cancelled) setDeletePreview(p);
    });
    return () => {
      cancelled = true;
    };
  }, [deleteTarget?.id]);

  /** When viewing an opponent roster (?opponentTeam=), only list players tagged with that opponent — not your full club. */
  const opponentFilterKey = defaultOpponentTeam?.trim() ? opponentNameKey(defaultOpponentTeam.trim()) : null;

  const playersToShow = useMemo(() => {
    if (opponentFilterKey) {
      return players.filter(
        (p) => p.opponent_team && opponentNameKey(p.opponent_team) === opponentFilterKey
      );
    }
    return players.filter(isClubRosterPlayer);
  }, [players, opponentFilterKey]);

  const playersSorted = useMemo(() => {
    const list = [...playersToShow];
    list.sort((a, b) => {
      const c = compareRosterPlayers(a, b, sortKey);
      return sortDir === "asc" ? c : -c;
    });
    return list;
  }, [playersToShow, sortKey, sortDir]);

  const playersFiltered = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return playersSorted;
    return playersSorted.filter((p) => playerMatchesRosterSearch(p, q));
  }, [playersSorted, searchQuery]);

  const selectablePlayers = useMemo(
    () => playersFiltered.filter((p) => !isDemoId(p.id)),
    [playersFiltered]
  );

  const allSelectableSelected =
    selectablePlayers.length > 0 && selectablePlayers.every((p) => selectedIds.has(p.id));

  const exitBulkSelectMode = () => {
    setBulkSelectMode(false);
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    setBulkDeletePreview(null);
  };

  const togglePlayerSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    if (allSelectableSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(selectablePlayers.map((p) => p.id)));
  };

  useEffect(() => {
    if (!bulkDeleteOpen || selectedIds.size === 0) {
      setBulkDeletePreview(null);
      return;
    }
    let cancelled = false;
    void getBulkPlayerDeletionPreviewAction([...selectedIds]).then((rows) => {
      if (!cancelled) setBulkDeletePreview(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [bulkDeleteOpen, selectedIds]);

  const bulkDeleteDescription = useMemo(() => {
    if (!bulkDeleteOpen || selectedIds.size === 0) return "";
    if (bulkDeletePreview == null) return "Loading…";
    const valid = bulkDeletePreview.filter((r) => r.preview != null);
    if (valid.length === 0) return "Could not load deletion details.";
    let archiveCount = 0;
    let hardDeleteCount = 0;
    let lineupSlots = 0;
    let savedSlots = 0;
    for (const { preview } of valid) {
      if (!preview) continue;
      if (preview.batterPlateAppearances > 0) archiveCount += 1;
      else hardDeleteCount += 1;
      lineupSlots += preview.gameLineups;
      savedSlots += preview.savedLineupSlots;
    }
    const n = selectedIds.size;
    const parts = [
      `Remove ${n} player${n === 1 ? "" : "s"} from this roster?`,
      archiveCount > 0
        ? `${archiveCount} with plate appearances will be archived (history kept).`
        : null,
      hardDeleteCount > 0
        ? `${hardDeleteCount} will be permanently deleted.`
        : null,
      lineupSlots > 0 ? `${lineupSlots} game lineup slot(s) will be cleared.` : null,
      savedSlots > 0 ? `${savedSlots} saved lineup template slot(s) will be cleared.` : null,
      hardDeleteCount > 0 ? "Permanent deletes cannot be undone." : null,
    ];
    return parts.filter(Boolean).join(" ");
  }, [bulkDeleteOpen, selectedIds.size, bulkDeletePreview]);

  const refresh = () => router.refresh();

  const deleteDescription =
    deleteTarget &&
    (deletePreview == null
      ? "Loading…"
      : [
          deletePreview.batterPlateAppearances > 0
            ? `${deleteTarget.name} has ${deletePreview.batterPlateAppearances} plate appearance(s) as batter. They will be removed from the active roster but kept in historical game logs.`
            : `Permanently delete ${deleteTarget.name}?`,
          deletePreview.gameLineups > 0
            ? `${deletePreview.gameLineups} game lineup slot(s) will be removed.`
            : null,
          deletePreview.savedLineupSlots > 0
            ? `${deletePreview.savedLineupSlots} saved lineup template slot(s) will be removed.`
            : null,
          deletePreview.batterPlateAppearances > 0
            ? "This keeps past stats/history intact."
            : "Credits as pitcher on old PAs will be cleared. Baserunning events where they were the runner will be removed. This cannot be undone.",
        ]
          .filter(Boolean)
          .join(" "));

  const handleSavePlayer = async (player: Omit<Player, "id" | "created_at">) => {
    if (!canEdit) {
      showFlash({ type: "err", text: "Connect Supabase to add or edit players." });
      return;
    }
    try {
      if (editingPlayer) {
        const updated = await updatePlayerAction(editingPlayer.id, player);
        if (updated) {
          setPlayers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          setEditingPlayer(null);
          setShowAddForm(false);
          showFlash({ type: "ok", text: "Player updated." });
          refresh();
        } else {
          showFlash({ type: "err", text: "Could not update player." });
        }
      } else {
        const created = await insertPlayerAction(player);
        if (created) {
          setPlayers((prev) => {
            if (!opponentFilterKey) {
              return isClubRosterPlayer(created) ? [created, ...prev] : prev;
            }
            const matches =
              !!created.opponent_team &&
              opponentNameKey(created.opponent_team) === opponentFilterKey;
            return matches ? [created, ...prev] : prev;
          });
          setEditingPlayer(null);
          setShowAddForm(false);
          showFlash({ type: "ok", text: "Player added." });
          refresh();
        } else {
          showFlash({ type: "err", text: "Could not add player. Is Supabase connected?" });
        }
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Could not save player.";
      const text =
        raw.toLowerCase().includes("fetch") || raw.toLowerCase().includes("network")
          ? "Can’t reach Supabase. Check your connection and, if you’re on the free tier, that the project isn’t paused (Supabase Dashboard → Project Settings → Restore project)."
          : raw;
      showFlash({ type: "err", text });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Roster</h1>
          {defaultOpponentTeam?.trim() ? (
            <div
              className="mt-1 min-h-[1.25rem] text-sm leading-normal"
              aria-hidden
            />
          ) : (
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Main roster only. Players tagged for opponent scouting are managed from Opponents.
            </p>
          )}
          {defaultOpponentTeam?.trim() && (
            <div className="mt-3 rounded-lg border border-[var(--accent)]/35 bg-[var(--accent-dim)]/50 px-10 py-2">
              <p className="text-xs font-medium uppercase tracking-wider text-white">Opponent roster:</p>
              <p className="font-display mt-2 text-2xl font-bold leading-tight tracking-tight text-[var(--accent)] sm:text-3xl">
                {defaultOpponentTeam.trim()}
              </p>
              
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && playersToShow.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (bulkSelectMode) exitBulkSelectMode();
                else setBulkSelectMode(true);
              }}
              className={`shrink-0 rounded-lg border px-4 py-2 text-sm font-medium transition font-display ${
                bulkSelectMode
                  ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              }`}
            >
              {bulkSelectMode ? "Cancel select" : "Select players"}
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setShowAddForm(true);
                setEditingPlayer(null);
              }}
              className="font-orbitron shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] transition hover:opacity-90"
              title="Add player (A)"
            >
              Add player
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-faint)]">
        <span>
          Supabase:{" "}
          {supabaseStatus === "loading" && "Checking…"}
          {supabaseStatus === "connected" && "Connected"}
          {typeof supabaseStatus === "object" && supabaseStatus.error}
        </span>
        {typeof supabaseStatus === "object" && (
          <button
            type="button"
            onClick={checkSupabaseStatus}
            className="rounded border border-[var(--border)] px-2 py-1 text-[var(--text-muted)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text)]"
          >
            Retry
          </button>
        )}
      </div>

      {!canEdit && (
        <div className="rounded-lg border border-[var(--border)] p-4 text-[var(--text-muted)]" style={{ background: "var(--warning-dim)" }}>
          {dataEditBlockedMessage(
            "Connect Supabase to add or edit players. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
          )}
        </div>
      )}

      <FlashMessage message={message} dismissing={messageDismissing} />

      {canEdit && playerFormOpen && (
        <div
          className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-[2px] sm:p-6"
          onClick={closePlayerForm}
          role="dialog"
          aria-modal="true"
          aria-labelledby={editingPlayer ? "roster-edit-player-title" : "roster-add-player-title"}
        >
          <div
            className="w-[min(100%,72rem)] max-w-6xl rounded-xl shadow-2xl ring-1 ring-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <PlayerForm
              key={editingPlayer?.id ?? `add-${defaultOpponentTeam ?? ""}`}
              player={editingPlayer}
              lockedOpponentTeam={defaultOpponentTeam?.trim() || null}
              onSave={handleSavePlayer}
              onCancel={closePlayerForm}
              onAddNew={() => {
                setEditingPlayer(null);
                setShowAddForm(true);
              }}
              canEdit={canEdit}
              titleId={editingPlayer ? "roster-edit-player-title" : "roster-add-player-title"}
            />
          </div>
        </div>
      )}

      {playersToShow.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          {bulkSelectMode && canEdit ? (
            <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-[var(--accent)]/35 bg-[var(--accent-dim)]/30 px-3 py-2">
              <span className="text-sm font-medium text-[var(--text)]">
                {selectedIds.size} selected
              </span>
              <button
                type="button"
                onClick={toggleSelectAllFiltered}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)] transition hover:border-[var(--accent)]"
              >
                {allSelectableSelected ? "Clear all" : `Select all (${selectablePlayers.length})`}
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                disabled={selectedIds.size === 0}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-muted)] transition hover:text-[var(--text)] disabled:opacity-40"
              >
                Clear selection
              </button>
              <button
                type="button"
                onClick={() => setBulkDeleteOpen(true)}
                disabled={selectedIds.size === 0}
                className="ml-auto rounded-lg border border-[var(--danger)] bg-[var(--danger)]/15 px-3 py-1.5 text-sm font-semibold text-[var(--danger)] transition hover:bg-[var(--danger)]/25 disabled:opacity-40 font-display"
              >
                Delete selected
              </button>
            </div>
          ) : null}
          <label className="min-w-0 flex-1 sm:max-w-md">
            <span className="sr-only">Search roster</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, jersey, position…"
              className="input-tech block w-full px-3 py-2.5 text-sm"
              autoComplete="off"
            />
          </label>
          {searchQuery.trim() ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm text-[var(--text-muted)] transition hover:border-[var(--border-focus)] hover:text-[var(--text)]"
            >
              Clear
            </button>
          ) : null}
          <label className="flex shrink-0 items-center gap-2 text-sm text-[var(--text-muted)]">
            <span className="whitespace-nowrap">Sort by</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as RosterSortKey)}
              className="input-tech rounded-lg px-2.5 py-2.5 text-sm"
              aria-label="Sort roster by"
            >
              <option value="name">Name</option>
              <option value="jersey">Jersey #</option>
              <option value="position">Position</option>
              <option value="status">Status</option>
              <option value="bats">Bats</option>
              <option value="throws">Throws</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm font-medium text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            aria-label={sortDir === "asc" ? "Sort ascending; click for descending" : "Sort descending; click for ascending"}
            title={sortDir === "asc" ? "Ascending" : "Descending"}
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
          <span className="w-full text-xs text-[var(--text-faint)] sm:w-auto sm:ml-auto">
            {playersFiltered.length} of {playersToShow.length} players
          </span>
        </div>
      ) : null}

      {playersToShow.length === 0 ? (
        <div className="card-tech rounded-lg border-dashed p-8 text-center">
          <span className="text-4xl opacity-60">👤</span>
          <h2 className="mt-4 font-semibold text-white">
            {opponentFilterKey ? "No players on this opponent roster yet" : "No players yet"}
          </h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {opponentFilterKey
              ? canEdit
                ? ``
                : "Connect Supabase to add players."
              : canEdit
                ? "Use Add player to add someone."
                : "Connect Supabase to add players."}
          </p>
        </div>
      ) : playersFiltered.length === 0 ? (
        <div className="card-tech rounded-lg border-dashed p-8 text-center">
          <h2 className="font-semibold text-white">No matches</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            No players match &ldquo;{searchQuery.trim()}&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="mt-4 text-sm font-medium text-[var(--accent)] hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {playersFiltered.map((p) => {
            const handsLine = rosterBatsThrowsSummary(p);
            const selectable = canEdit && !isDemoId(p.id);
            const isSelected = selectedIds.has(p.id);
            return (
            <li
              key={p.id}
              className={`card-tech flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${
                bulkSelectMode && isSelected ? "ring-1 ring-[var(--accent)]/50" : ""
              }`}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                {bulkSelectMode && selectable ? (
                  <label className="flex shrink-0 cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePlayerSelected(p.id)}
                      className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                      aria-label={`Select ${p.name}`}
                    />
                  </label>
                ) : null}
                <span className="font-medium text-[var(--text)]">
                  {p.name} {p.jersey ? `#${p.jersey}` : ""}
                </span>
                {p.positions?.length > 0 && (
                  <span className="text-sm text-[var(--text-muted)]">{formatPositionsDisplay(p)}</span>
                )}
                {handsLine ? (
                  <span className="text-sm text-[var(--text-muted)]">{handsLine}</span>
                ) : null}
                {resolveRosterStatus(p) !== "active" && (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${rosterStatusBadgeClass(resolveRosterStatus(p))}`}
                  >
                    {PLAYER_ROSTER_STATUS_LABELS[resolveRosterStatus(p)]}
                  </span>
                )}
                {isDemoId(p.id) && (
                  <span className="rounded px-2 py-0.5 text-xs" style={{ background: "var(--warning-dim)", color: "var(--warning)" }}>
                    Demo
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {canEdit && !isDemoId(p.id) && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingPlayer(p);
                    }}
                    className="rounded-full border border-[var(--accent)] px-3 py-1 text-sm font-medium text-[var(--accent)] transition hover:bg-[var(--accent-dim)] font-display"
                  >
                    Edit
                  </button>
                )}
                <Link
                  href={analystPlayerProfileHref(p.id)}
                  className="rounded-full border border-[var(--accent)] px-3 py-1 text-sm font-medium text-[var(--accent)] transition hover:bg-[var(--accent-dim)] font-display"
                >
                  Profile
                </Link>
                {canEdit && !isDemoId(p.id) && !bulkSelectMode && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(p)}
                    className="rounded-full border border-[var(--danger)] px-3 py-1 text-sm font-medium text-[var(--danger)] transition hover:bg-[var(--danger)]/15 font-display"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
            );
          })}
        </ul>
      )}

      <ConfirmDeleteDialog
        open={deleteTarget != null}
        onClose={() => !deletePending && setDeleteTarget(null)}
        title="Delete player?"
        description={typeof deleteDescription === "string" ? deleteDescription : ""}
        confirmLabel="Delete player"
        pending={deletePending}
        pendingLabel="Deleting…"
        confirmDisabled={deleteTarget == null || deletePreview == null}
        onConfirm={async () => {
          if (!deleteTarget || deletePreview == null) return;
          setDeletePending(true);
          const result = await deletePlayerAction(deleteTarget.id);
          setDeletePending(false);
          if (result.ok) {
            setDeleteTarget(null);
            setPlayers((prev) => prev.filter((x) => x.id !== deleteTarget.id));
            showFlash({
              type: "delete",
              text:
                deletePreview.batterPlateAppearances > 0
                  ? `${deleteTarget.name} was removed from the active roster (history kept).`
                  : `${deleteTarget.name} was deleted.`,
            });
            refresh();
          } else {
            showFlash({ type: "err", text: result.error });
            setDeleteTarget(null);
          }
        }}
      />

      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        onClose={() => !bulkDeletePending && setBulkDeleteOpen(false)}
        title={`Delete ${selectedIds.size} player${selectedIds.size === 1 ? "" : "s"}?`}
        description={bulkDeleteDescription}
        confirmLabel={`Delete ${selectedIds.size} player${selectedIds.size === 1 ? "" : "s"}`}
        pending={bulkDeletePending}
        pendingLabel="Deleting…"
        confirmDisabled={
          selectedIds.size === 0 ||
          bulkDeletePreview == null ||
          bulkDeletePreview.every((r) => r.preview == null)
        }
        onConfirm={async () => {
          if (selectedIds.size === 0 || bulkDeletePreview == null) return;
          setBulkDeletePending(true);
          const ids = [...selectedIds];
          const result = await deletePlayersAction(ids);
          setBulkDeletePending(false);
          const removed = new Set(ids);
          const succeeded = result.deleted + result.archived;
          if (succeeded > 0) {
            setPlayers((prev) => prev.filter((x) => !removed.has(x.id)));
            exitBulkSelectMode();
            const parts: string[] = [];
            if (result.deleted > 0) parts.push(`${result.deleted} deleted`);
            if (result.archived > 0) parts.push(`${result.archived} archived (history kept)`);
            showFlash({
              type: "delete",
              text: parts.length > 0 ? `${parts.join(", ")}.` : "Players removed.",
            });
            refresh();
          }
          if (result.failed.length > 0) {
            showFlash({
              type: "err",
              text: `Could not delete ${result.failed.length} player(s): ${result.failed[0]!.error}`,
            });
            setBulkDeleteOpen(false);
            setSelectedIds((prev) => {
              const next = new Set(prev);
              for (const id of ids) {
                if (!result.failed.some((f) => f.id === id)) next.delete(id);
              }
              return next;
            });
          } else if (succeeded > 0) {
            setBulkDeleteOpen(false);
          }
        }}
      />
    </div>
  );
}

function PlayerForm({
  player,
  lockedOpponentTeam,
  onSave,
  onCancel,
  onAddNew,
  canEdit,
  titleId = "roster-player-form-title",
}: {
  player: Player | null;
  /** When set (opponent roster page), team is implied from page context. */
  lockedOpponentTeam?: string | null;
  onSave: (p: Omit<Player, "id" | "created_at">) => Promise<void>;
  onCancel: () => void;
  onAddNew: () => void;
  canEdit: boolean;
  /** Modal dialog title id (`aria-labelledby`). */
  titleId?: string;
}) {
  const lockedTeam = lockedOpponentTeam?.trim() ?? "";
  const opponentPage = lockedTeam.length > 0;
  const submitRef = useRef<HTMLButtonElement>(null);

  const [name, setName] = useState(player?.name ?? "");
  const [jersey, setJersey] = useState(player?.jersey ?? "");
  const [positions, setPositions] = useState<string[]>(() =>
    player?.positions?.filter((p) => POSITION_OPTIONS.includes(p as (typeof POSITION_OPTIONS)[number])) ?? []
  );
  const [bats, setBats] = useState<"L" | "R" | "S" | "">(player?.bats ?? "");
  const [throws, setThrows] = useState<"L" | "R" | "">(player?.throws ?? "");
  const [primaryPosition, setPrimaryPosition] = useState<string | null>(
    () => player?.primary_position ?? getPlayerPrimaryPosition(player ?? { positions: [] }) ?? null
  );
  const [rosterStatus, setRosterStatus] = useState<PlayerRosterStatus>(() =>
    resolveRosterStatus(player ?? undefined)
  );
  const [saving, setSaving] = useState(false);

  const isEditing = !!player;

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
    setSaving(true);
    /** Opponent tag is set from page context (`?opponentTeam=`), not a form field. Club roster → no tag. */
    const resolvedOpponent = opponentPage ? lockedTeam : null;
    const rosterFields = preparePlayerRosterPayload({
      positions,
      primary_position: primaryPosition,
      roster_status: isEditing ? rosterStatus : "active",
    });
    await onSave({
      name: name.trim() || "Unnamed player",
      jersey: jersey.trim() || null,
      ...rosterFields,
      bats: bats === "" ? null : bats,
      throws: throws === "" ? null : throws,
      height_in: isEditing ? (player?.height_in ?? null) : null,
      weight_lb: isEditing ? (player?.weight_lb ?? null) : null,
      hometown: isEditing ? (player?.hometown ?? null) : null,
      birth_date: isEditing ? (player?.birth_date ?? null) : null,
      opponent_team: resolvedOpponent || null,
    });
    setSaving(false);
  };

  if (!canEdit) return null;

  const fieldLabel =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]";
  const sectionShell = "rounded-lg border border-[var(--border)]/70 bg-[var(--bg-elevated)]/20 p-4 sm:p-5";
  const sectionKicker =
    "mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]";
  const inputPad = "input-tech block w-full px-3 py-2.5 text-base";
  const handChipBase =
    "shrink-0 min-h-10 rounded-lg border px-3.5 py-2 text-sm font-semibold transition";
  const fieldGap = "gap-4";
  const handChipGap = "gap-2";
  const handChipOn =
    "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]/25";
  const handChipOff =
    "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text)]";

  return (
    <form onSubmit={handleSubmit} className="card-tech overflow-hidden p-0">
      <header className="border-b border-[var(--border)]/80 bg-[var(--bg-elevated)]/15 px-6 py-4 sm:px-8">
        <h3
          id={titleId}
          className="font-orbitron text-lg font-semibold uppercase tracking-wide text-white sm:text-xl"
        >
          {isEditing ? "Edit player" : "Add player"}
        </h3>
      </header>

      {/*
        Tab order: identity → uniform & hands → position chips → roster status (edit) → submit.
      */}
      <div className="grid gap-6 px-6 py-5 sm:gap-8 sm:px-8 sm:py-6 lg:grid-cols-2 lg:gap-x-10">
        <div className="space-y-6 sm:space-y-7">
        {/* Identity */}
        <section className={sectionShell} aria-labelledby="player-form-identity">
          <h4 id="player-form-identity" className={sectionKicker}>
            Identity
          </h4>
          <label className="min-w-0">
            <span className={fieldLabel}>Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputPad}
              placeholder="Full name"
              autoComplete="name"
              autoFocus={!isEditing}
            />
            {opponentPage ? (
              <span className="mt-1.5 block text-[10px] leading-snug text-[var(--text-faint)]">
                Tagged for <strong className="font-medium text-[var(--text-muted)]">{lockedTeam}</strong> (this
                opponent roster).
              </span>
            ) : null}
          </label>
        </section>

        {/* Vitals */}
        <section className={sectionShell} aria-labelledby="player-form-vitals">
          <h4 id="player-form-vitals" className={sectionKicker}>
            Uniform &amp; hands
          </h4>
          <div className={`grid grid-cols-1 ${fieldGap} sm:grid-cols-3`}>
            <label className="min-w-0">
              <span className={fieldLabel}>Jersey</span>
              <input
                type="text"
                value={jersey}
                onChange={(e) => setJersey(e.target.value)}
                className={`${inputPad} max-w-[6rem] tabular-nums`}
                placeholder="7"
                maxLength={4}
              />
            </label>
            <div className="min-w-0">
              <span className={fieldLabel}>Bats</span>
              <div className={`mt-2 flex flex-wrap ${handChipGap}`} role="group" aria-label="Bats handedness">
                {(
                  [
                    { v: "L" as const, label: "Left" },
                    { v: "R" as const, label: "Right" },
                    { v: "S" as const, label: "Switch" },
                  ] as const
                ).map(({ v, label }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setBats(bats === v ? "" : v)}
                    className={`${handChipBase} ${bats === v ? handChipOn : handChipOff}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-w-0">
              <span className={fieldLabel}>Throws</span>
              <div className={`mt-2 flex flex-wrap ${handChipGap}`} role="group" aria-label="Throws handedness">
                {(
                  [
                    { v: "L" as const, label: "Left" },
                    { v: "R" as const, label: "Right" },
                  ] as const
                ).map(({ v, label }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setThrows(throws === v ? "" : v)}
                    className={`${handChipBase} ${throws === v ? handChipOn : handChipOff}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        </div>

        <div className="space-y-6 sm:space-y-7">
          <section className={sectionShell} aria-labelledby="player-form-positions">
            <h4 id="player-form-positions" className={sectionKicker}>
              Positions
            </h4>
            <RosterPositionSelector
              selected={positions}
              onToggle={togglePosition}
              primaryPosition={primaryPosition}
              onSetPrimary={setPrimaryPosition}
              size="large"
              focusAfterPitcherRef={submitRef}
            />
          </section>
          {isEditing ? (
            <section className={sectionShell} aria-labelledby="player-form-status">
              <h4 id="player-form-status" className={sectionKicker}>
                Roster status
              </h4>
              <div className={`flex flex-wrap ${handChipGap}`} role="group" aria-label="Roster status">
                {PLAYER_ROSTER_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setRosterStatus(status)}
                    className={`${handChipBase} ${rosterStatus === status ? handChipOn : handChipOff}`}
                  >
                    {PLAYER_ROSTER_STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">
                Only <strong className="font-medium text-[var(--text)]">Active</strong> players appear in lineup and
                coach bench lists.
              </p>
            </section>
          ) : null}
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border)]/80 bg-[var(--bg-elevated)]/10 px-6 py-4 sm:px-8 sm:py-5">
        <button
          ref={submitRef}
          type="submit"
          disabled={saving}
          className="font-orbitron rounded-lg bg-[var(--accent)] px-6 py-2.5 text-base font-semibold tracking-wide text-[var(--accent-fg)] shadow-[var(--shadow-accent-sm)] transition hover:opacity-95 disabled:opacity-50"
        >
          {saving ? "Saving…" : isEditing ? "Update player" : "Add player"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--border-focus)] hover:text-[var(--text)]"
        >
          Cancel
        </button>
        {isEditing ? (
          <button
            type="button"
            onClick={onAddNew}
            className="text-sm text-[var(--accent)]/90 underline-offset-2 hover:underline"
          >
            Add new instead
          </button>
        ) : null}
      </footer>
    </form>
  );
}
