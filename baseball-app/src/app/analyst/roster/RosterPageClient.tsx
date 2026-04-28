"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isDemoId } from "@/lib/db/mockData";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import {
  deletePlayerAction,
  getPlayerDeletionPreviewAction,
  insertPlayerAction,
  updatePlayerAction,
} from "./actions";
import type { PlayerDeletionPreview } from "@/lib/types";
import { heightInToFeetInches, feetInchesToHeightIn } from "@/lib/height";
import { StyledDatePicker } from "@/components/shared/StyledDatePicker";
import { isClubRosterPlayer, opponentNameKey } from "@/lib/opponentUtils";
import { analystPlayerProfileHref } from "@/lib/analystRoutes";
import { comparePlayersByLastNameThenFull } from "@/lib/playerSort";
import type { Player } from "@/lib/types";

const POSITION_OPTIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"] as const;

interface RosterPageClientProps {
  initialPlayers: Player[];
  canEdit: boolean;
  /** When set (e.g. View roster from Opponents), prefill opponent team when you click Add player. */
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
  const [message, setMessage] = useState<{ type: "ok" | "err" | "delete"; text: string } | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus>("loading");
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);
  const [deletePreview, setDeletePreview] = useState<PlayerDeletionPreview | null>(null);
  const [deletePending, setDeletePending] = useState(false);

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

  const playersSortedByLastName = useMemo(
    () => [...playersToShow].sort(comparePlayersByLastNameThenFull),
    [playersToShow]
  );

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
      setMessage({ type: "err", text: "Connect Supabase to add or edit players." });
      return;
    }
    try {
      if (editingPlayer) {
        const updated = await updatePlayerAction(editingPlayer.id, player);
        if (updated) {
          setPlayers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          setEditingPlayer(null);
          setShowAddForm(false);
          setMessage({ type: "ok", text: "Player updated." });
          refresh();
        } else {
          setMessage({ type: "err", text: "Could not update player." });
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
          setMessage({ type: "ok", text: "Player added." });
          refresh();
        } else {
          setMessage({ type: "err", text: "Could not add player. Is Supabase connected?" });
        }
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Could not save player.";
      const text =
        raw.toLowerCase().includes("fetch") || raw.toLowerCase().includes("network")
          ? "Can’t reach Supabase. Check your connection and, if you’re on the free tier, that the project isn’t paused (Supabase Dashboard → Project Settings → Restore project)."
          : raw;
      setMessage({ type: "err", text });
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
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setShowAddForm(true);
                setEditingPlayer(null);
              }}
              className="shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-base)] transition hover:opacity-90 font-display"
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
          Connect Supabase to add or edit players. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.
        </div>
      )}

      {message && (
        <div
          className={`rounded-lg border border-[var(--border)] p-4 ${
            message.type === "ok" ? "text-[var(--success)]" : "text-[var(--danger)]"
          }`}
          style={{
            background:
              message.type === "ok" ? "var(--success-dim)" : "var(--danger-dim)",
          }}
        >
          {message.text}
        </div>
      )}

      {canEdit && (showAddForm || editingPlayer) && (
        <PlayerForm
          key={editingPlayer?.id ?? `add-${defaultOpponentTeam ?? ""}`}
          player={editingPlayer}
          defaultOpponentTeam={editingPlayer ? null : defaultOpponentTeam ?? null}
          onSave={handleSavePlayer}
          onCancel={() => { setShowAddForm(false); setEditingPlayer(null); }}
          onAddNew={() => setEditingPlayer(null)}
          canEdit={canEdit}
        />
      )}

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
      ) : (
        <ul className="space-y-2">
          {playersSortedByLastName.map((p) => (
            <li
              key={p.id}
              className="card-tech flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="font-medium text-[var(--text)]">
                  {p.name} {p.jersey ? `#${p.jersey}` : ""}
                </span>
                {p.positions?.length > 0 && (
                  <span className="text-sm text-[var(--text-muted)]">
                    {p.positions.join(", ")}
                  </span>
                )}
                {p.is_active === false && (
                  <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                    Injured
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
                {canEdit && !isDemoId(p.id) && (
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
          ))}
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
            setMessage({
              type: "delete",
              text:
                deletePreview.batterPlateAppearances > 0
                  ? `${deleteTarget.name} was removed from the active roster (history kept).`
                  : `${deleteTarget.name} was deleted.`,
            });
            refresh();
          } else {
            setMessage({ type: "err", text: result.error });
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}

function PlayerForm({
  player,
  defaultOpponentTeam,
  onSave,
  onCancel,
  onAddNew,
  canEdit,
}: {
  player: Player | null;
  defaultOpponentTeam?: string | null;
  onSave: (p: Omit<Player, "id" | "created_at">) => Promise<void>;
  onCancel: () => void;
  onAddNew: () => void;
  canEdit: boolean;
}) {
  const [name, setName] = useState(player?.name ?? "");
  const [jersey, setJersey] = useState(player?.jersey ?? "");
  const [positions, setPositions] = useState<string[]>(() =>
    player?.positions?.filter((p) => POSITION_OPTIONS.includes(p as (typeof POSITION_OPTIONS)[number])) ?? []
  );
  const [bats, setBats] = useState<"L" | "R" | "S" | "">(player?.bats ?? "");
  const [throws, setThrows] = useState<"L" | "R" | "">(player?.throws ?? "");
  const [height_ft, setHeightFt] = useState<string>(player?.height_in != null ? String(heightInToFeetInches(player.height_in).feet) : "");
  const [height_in_part, setHeightInPart] = useState<string>(player?.height_in != null ? String(heightInToFeetInches(player.height_in).inches) : "");
  const [weight_lb, setWeightLb] = useState<string>(player?.weight_lb != null ? String(player.weight_lb) : "");
  const [hometown, setHometown] = useState<string>(player?.hometown ?? "");
  const [birth_date, setBirthDate] = useState<string>(player?.birth_date ?? "");
  const [opponent_team, setOpponentTeam] = useState<string>(
    player?.opponent_team ?? defaultOpponentTeam ?? ""
  );
  const [isActive, setIsActive] = useState<boolean>(player?.is_active !== false);
  const [saving, setSaving] = useState(false);

  const isEditing = !!player;

  const togglePosition = (pos: string) => {
    setPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      name: name.trim() || "Unnamed player",
      jersey: jersey.trim() || null,
      positions,
      bats: bats === "" ? null : bats,
      throws: throws === "" ? null : throws,
      height_in:
        height_ft === "" && height_in_part === ""
          ? null
          : (() => {
              const ft = parseInt(height_ft, 10) || 0;
              const inch = parseInt(height_in_part, 10) || 0;
              const total = feetInchesToHeightIn(ft, inch);
              return total > 0 ? total : null;
            })(),
      weight_lb: weight_lb === "" ? null : parseInt(weight_lb, 10) || null,
      hometown: hometown.trim() || null,
      birth_date: birth_date.trim() || null,
      opponent_team: opponent_team.trim() || null,
      is_active: isActive,
    });
    setSaving(false);
  };

  if (!canEdit) return null;

  return (
    <form onSubmit={handleSubmit} className="card-tech p-5">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-white">{isEditing ? "Edit player" : "Add player"}</h3>
      <div className="mt-4 space-y-4">
        {/* Name + opponent */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="min-w-0">
            <span className="text-xs text-white">Name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-tech mt-1 block w-full px-3 py-2" placeholder="Full name" />
          </label>
          <label className="min-w-0">
            <span className="text-xs text-white">Opponent team</span>
            <input
              type="text"
              value={opponent_team}
              onChange={(e) => setOpponentTeam(e.target.value)}
              className="input-tech mt-1 block w-full px-3 py-2"
              placeholder="e.g. Mayaguez — leave empty for main roster"
            />
            <span className="mt-1 block text-[10px] text-white/60">
              Set when this player is on an opposing roster (scouting / opponent stats).
            </span>
          </label>
        </div>
        <div className="rounded-lg border border-[var(--border)]/80 bg-[var(--bg-elevated)]/25 p-3">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <span>
              <span className="text-sm font-medium text-white">Active roster player</span>
              <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                Turn off for injured/inactive players so they do not appear on lineup builders or coach bench.
              </span>
            </span>
          </label>
        </div>

        {/* Jersey, height, bats, throws, weight — one compact band */}
        <div className="rounded-lg border border-[var(--border)]/80 bg-[var(--bg-elevated)]/25 p-3 sm:p-4">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <label className="min-w-0 shrink-0">
              <span className="text-xs text-white">Jersey</span>
              <input
                type="text"
                value={jersey}
                onChange={(e) => setJersey(e.target.value)}
                className="input-tech mt-1 block w-20 px-3 py-2 text-sm tabular-nums"
                placeholder="e.g. 7"
                maxLength={4}
              />
            </label>
            <label className="min-w-0 shrink-0">
              <span className="text-xs text-white">Height</span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input type="number" min={4} max={8} value={height_ft} onChange={(e) => setHeightFt(e.target.value)} className="input-tech w-[3.25rem] px-2 py-2 text-sm" placeholder="5" />
                <span className="text-white/80">ft</span>
                <input type="number" min={0} max={11} value={height_in_part} onChange={(e) => setHeightInPart(e.target.value)} className="input-tech w-[3.25rem] px-2 py-2 text-sm" placeholder="10" />
                <span className="text-white/80">in</span>
              </div>
            </label>
            <label className="shrink-0">
              <span className="text-xs text-white">Bats</span>
              <select
                value={bats}
                onChange={(e) => setBats(e.target.value as "L" | "R" | "S" | "")}
                className="input-tech mt-1 block w-[5.75rem] px-2 py-2 text-sm"
                aria-label="Bats"
              >
                <option value="">—</option>
                <option value="L">L</option>
                <option value="R">R</option>
                <option value="S">S (Switch)</option>
              </select>
            </label>
            <label className="shrink-0">
              <span className="text-xs text-white">Throws</span>
              <select
                value={throws}
                onChange={(e) => setThrows(e.target.value as "L" | "R" | "")}
                className="input-tech mt-1 block w-[5.75rem] px-2 py-2 text-sm"
                aria-label="Throws"
              >
                <option value="">—</option>
                <option value="L">L</option>
                <option value="R">R</option>
              </select>
            </label>
            <label className="shrink-0">
              <span className="text-xs text-white">Weight (lb)</span>
              <input
                type="number"
                min={80}
                max={350}
                value={weight_lb}
                onChange={(e) => setWeightLb(e.target.value)}
                className="input-tech mt-1 block w-[5.5rem] px-2 py-2 text-sm tabular-nums"
                placeholder="185"
              />
            </label>
          </div>
        </div>

        {/* Hometown + birthday */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="min-w-0">
            <span className="text-xs text-white">Hometown</span>
            <input type="text" value={hometown} onChange={(e) => setHometown(e.target.value)} className="input-tech mt-1 block w-full px-3 py-2" placeholder="e.g. San Juan, PR" />
          </label>
          <label className="min-w-0">
            <span className="text-xs text-white">Birthday</span>
            <StyledDatePicker
              value={birth_date}
              onChange={setBirthDate}
              className="input-tech mt-1 block w-full max-w-full px-3 py-2 text-sm sm:max-w-[12rem]"
              placeholder="Select date"
            />
          </label>
        </div>

        {/* Positions */}
        <div>
          <span className="text-xs text-white">Positions</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {POSITION_OPTIONS.map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => togglePosition(pos)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  positions.includes(pos)
                    ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-[var(--border-focus)]"
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={saving} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-base)] disabled:opacity-50">
          {saving ? "Saving…" : isEditing ? "Update player" : "Add player"}
        </button>
        {isEditing && (
          <>
            <button type="button" onClick={onCancel} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)]">Cancel</button>
            <button type="button" onClick={onAddNew} className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">Add new instead</button>
          </>
        )}
      </div>
    </form>
  );
}
