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

function rosterBatsThrowsSummary(p: Pick<Player, "bats" | "throws">): string | null {
  const parts: string[] = [];
  if (p.bats) parts.push(`Bats ${p.bats}`);
  if (p.throws) parts.push(`Throws ${p.throws}`);
  return parts.length > 0 ? parts.join(" · ") : null;
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
              className="font-orbitron shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] transition hover:opacity-90"
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
          lockedOpponentTeam={defaultOpponentTeam?.trim() || null}
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
          {playersSortedByLastName.map((p) => {
            const handsLine = rosterBatsThrowsSummary(p);
            return (
            <li
              key={p.id}
              className="card-tech flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium text-[var(--text)]">
                  {p.name} {p.jersey ? `#${p.jersey}` : ""}
                </span>
                {p.positions?.length > 0 && (
                  <span className="text-sm text-[var(--text-muted)]">
                    {p.positions.join(", ")}
                  </span>
                )}
                {handsLine ? (
                  <span className="text-sm text-[var(--text-muted)]">{handsLine}</span>
                ) : null}
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
  lockedOpponentTeam,
  onSave,
  onCancel,
  onAddNew,
  canEdit,
}: {
  player: Player | null;
  /** When set (opponent roster page), team is implied; form omits opponent + bio fields for scouts. */
  lockedOpponentTeam?: string | null;
  onSave: (p: Omit<Player, "id" | "created_at">) => Promise<void>;
  onCancel: () => void;
  onAddNew: () => void;
  canEdit: boolean;
}) {
  const lockedTeam = lockedOpponentTeam?.trim() ?? "";
  const opponentPage = lockedTeam.length > 0;

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
  const [opponent_team, setOpponentTeam] = useState<string>(player?.opponent_team ?? (opponentPage ? lockedTeam : ""));
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
    const resolvedOpponent = opponentPage ? lockedTeam : opponent_team.trim() || null;
    await onSave({
      name: name.trim() || "Unnamed player",
      jersey: jersey.trim() || null,
      positions,
      bats: bats === "" ? null : bats,
      throws: throws === "" ? null : throws,
      height_in: opponentPage
        ? player?.height_in ?? null
        : height_ft === "" && height_in_part === ""
          ? null
          : (() => {
              const ft = parseInt(height_ft, 10) || 0;
              const inch = parseInt(height_in_part, 10) || 0;
              const total = feetInchesToHeightIn(ft, inch);
              return total > 0 ? total : null;
            })(),
      weight_lb: opponentPage ? player?.weight_lb ?? null : weight_lb === "" ? null : parseInt(weight_lb, 10) || null,
      hometown: opponentPage ? player?.hometown ?? null : hometown.trim() || null,
      birth_date: opponentPage ? player?.birth_date ?? null : birth_date.trim() || null,
      opponent_team: resolvedOpponent || null,
      is_active: isActive,
    });
    setSaving(false);
  };

  if (!canEdit) return null;

  const fieldLabel = "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]";
  const sectionShell = "rounded-lg border border-[var(--border)]/70 bg-[var(--bg-elevated)]/20 p-3";
  const sectionKicker = "mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]";
  const inputPad = "input-tech block w-full px-2.5 py-2 text-sm";
  const handChipBase =
    "min-h-9 shrink-0 rounded-md border px-2.5 py-2 text-xs font-semibold transition sm:min-h-10 sm:px-3 sm:text-sm";
  const handChipOn =
    "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]/25";
  const handChipOff =
    "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text)]";

  return (
    <form onSubmit={handleSubmit} className="card-tech overflow-hidden p-0">
      <header className="border-b border-[var(--border)]/80 bg-[var(--bg-elevated)]/15 px-4 py-2.5 sm:px-4">
        <h3 className="font-orbitron text-sm font-semibold uppercase tracking-wide text-white sm:text-base">
          {isEditing ? "Edit player" : "Add player"}
        </h3>
        {opponentPage ? (
          <p className="mt-1 max-w-xl text-[11px] leading-snug text-[var(--text-muted)]">
            Opponent roster — Tab through fields and positions, then activate. Team comes from this page.
          </p>
        ) : (
          <p className="mt-1 max-w-xl text-[11px] leading-snug text-[var(--text-muted)]">
            Club roster — Tab through fields; use Space or click on position chips to toggle.
          </p>
        )}
      </header>

      {/*
        Tab order: identity → vitals → background (club) → position chips (P…DH) → active checkbox → submit.
      */}
      <div className="space-y-4 px-4 py-3 sm:py-4">
        {/* Identity */}
        <section aria-labelledby="player-form-identity">
          <h4 id="player-form-identity" className={sectionKicker}>
            Identity
          </h4>
          <div className={`grid gap-2.5 ${opponentPage ? "" : "sm:grid-cols-2"}`}>
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
            </label>
            {!opponentPage ? (
              <label className="min-w-0">
                <span className={fieldLabel}>Opponent team</span>
                <input
                  type="text"
                  value={opponent_team}
                  onChange={(e) => setOpponentTeam(e.target.value)}
                  className={inputPad}
                  placeholder="Leave empty for club roster only"
                />
                <span className="mt-1 block text-[10px] leading-snug text-[var(--text-faint)]">
                  Optional — opposing / scouting player tag.
                </span>
              </label>
            ) : null}
          </div>
        </section>

        {/* Vitals */}
        <section className={sectionShell} aria-labelledby="player-form-vitals">
          <h4 id="player-form-vitals" className={sectionKicker}>
            Uniform &amp; hands
          </h4>
          <div
            className={
              opponentPage
                ? "grid grid-cols-1 gap-2.5 sm:grid-cols-3"
                : "grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-6"
            }
          >
            <label className="min-w-0">
              <span className={fieldLabel}>Jersey</span>
              <input
                type="text"
                value={jersey}
                onChange={(e) => setJersey(e.target.value)}
                className={`${inputPad} tabular-nums sm:max-w-[5.5rem]`}
                placeholder="7"
                maxLength={4}
              />
            </label>
            {!opponentPage ? (
              <label className="min-w-0 sm:col-span-2 xl:col-span-2">
                <span className={fieldLabel}>Height</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    type="number"
                    min={4}
                    max={8}
                    value={height_ft}
                    onChange={(e) => setHeightFt(e.target.value)}
                    className="input-tech w-[3.25rem] px-2 py-2 text-center text-sm tabular-nums"
                    placeholder="5"
                  />
                  <span className="text-[10px] text-[var(--text-muted)]">ft</span>
                  <input
                    type="number"
                    min={0}
                    max={11}
                    value={height_in_part}
                    onChange={(e) => setHeightInPart(e.target.value)}
                    className="input-tech w-[3.25rem] px-2 py-2 text-center text-sm tabular-nums"
                    placeholder="10"
                  />
                  <span className="text-[10px] text-[var(--text-muted)]">in</span>
                </div>
              </label>
            ) : null}
            <div className="min-w-0">
              <span className={fieldLabel}>Bats</span>
              <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Bats handedness">
                {(
                  [
                    { v: "" as const, label: "Unknown" },
                    { v: "L" as const, label: "Left" },
                    { v: "R" as const, label: "Right" },
                    { v: "S" as const, label: "Switch" },
                  ] as const
                ).map(({ v, label }) => (
                  <button
                    key={v || "none"}
                    type="button"
                    onClick={() => setBats(v)}
                    className={`${handChipBase} ${bats === v ? handChipOn : handChipOff}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-w-0">
              <span className={fieldLabel}>Throws</span>
              <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Throws handedness">
                {(
                  [
                    { v: "" as const, label: "Unknown" },
                    { v: "L" as const, label: "Left" },
                    { v: "R" as const, label: "Right" },
                  ] as const
                ).map(({ v, label }) => (
                  <button
                    key={v || "none"}
                    type="button"
                    onClick={() => setThrows(v)}
                    className={`${handChipBase} ${throws === v ? handChipOn : handChipOff}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {!opponentPage ? (
              <label className="min-w-0">
                <span className={fieldLabel}>Weight (lb)</span>
                <input
                  type="number"
                  min={80}
                  max={350}
                  value={weight_lb}
                  onChange={(e) => setWeightLb(e.target.value)}
                  className={`${inputPad} tabular-nums sm:max-w-[6.5rem]`}
                  placeholder="185"
                />
              </label>
            ) : null}
          </div>
        </section>

        {!opponentPage ? (
          <section aria-labelledby="player-form-bio">
            <h4 id="player-form-bio" className={sectionKicker}>
              Background
            </h4>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="min-w-0">
                <span className={fieldLabel}>Hometown</span>
                <input
                  type="text"
                  value={hometown}
                  onChange={(e) => setHometown(e.target.value)}
                  className={inputPad}
                  placeholder="e.g. San Juan, PR"
                />
              </label>
              <label className="min-w-0">
                <span className={fieldLabel}>Birthday</span>
                <StyledDatePicker
                  value={birth_date}
                  onChange={setBirthDate}
                  className={`${inputPad} max-w-full`}
                  placeholder="Select date"
                />
              </label>
            </div>
          </section>
        ) : null}

        {/* Positions — tab stops in DOM order (P…DH); Space/Enter toggles like a button */}
        <section className={sectionShell} aria-labelledby="player-form-positions">
          <h4 id="player-form-positions" className={sectionKicker}>
            Positions
          </h4>
          <p className="mb-2 text-[10px] text-[var(--text-faint)]">Tab through chips; Space or click toggles each position.</p>
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
            {POSITION_OPTIONS.map((pos) => {
              const on = positions.includes(pos);
              return (
                <button
                  key={pos}
                  type="button"
                  aria-pressed={on}
                  aria-label={`Position ${pos}`}
                  onClick={() => togglePosition(pos)}
                  className={`min-h-9 rounded-md border px-0.5 text-[11px] font-semibold transition sm:min-h-10 sm:text-xs ${
                    on
                      ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]/25"
                      : "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text)]"
                  }`}
                >
                  {pos}
                </button>
              );
            })}
          </div>
        </section>

        {/* Roster status — below positions; Tab still reaches checkbox then submit */}
        <section className={sectionShell} aria-labelledby="player-form-status">
          <h4 id="player-form-status" className="sr-only">
            Roster status
          </h4>
          <label className="flex cursor-pointer items-start gap-2.5 sm:items-center">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--border)] accent-[var(--accent)] sm:mt-0"
            />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-white">Active roster player</span>
              <span className="mt-0.5 block text-[10px] leading-snug text-[var(--text-muted)]">
                Off for injured/inactive — hidden from lineup &amp; coach bench.
              </span>
            </span>
          </label>
        </section>
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-[var(--border)]/80 bg-[var(--bg-elevated)]/10 px-4 py-2.5">
        <button
          type="submit"
          disabled={saving}
          className="font-orbitron rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] shadow-[0_0_16px_rgba(214,186,72,0.12)] transition hover:opacity-95 disabled:opacity-50"
        >
          {saving ? "Saving…" : isEditing ? "Update player" : "Add player"}
        </button>
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition hover:border-[var(--border-focus)] hover:text-[var(--text)] sm:text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onAddNew}
              className="text-xs text-[var(--accent)]/90 underline-offset-2 hover:underline sm:text-sm"
            >
              Add new instead
            </button>
          </>
        ) : null}
      </footer>
    </form>
  );
}
