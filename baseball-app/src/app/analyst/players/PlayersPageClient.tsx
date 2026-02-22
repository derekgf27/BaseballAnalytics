"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isDemoId } from "@/lib/db/mockData";
import { insertPlayer, updatePlayer } from "@/lib/db/queries";
import { heightInToFeetInches, feetInchesToHeightIn } from "@/lib/height";
import type { Player } from "@/lib/types";

const POSITION_OPTIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"] as const;

interface PlayersPageClientProps {
  initialPlayers: Player[];
  canEdit: boolean;
}

type SupabaseStatus = "loading" | "connected" | { error: string };

export function PlayersPageClient({ initialPlayers, canEdit }: PlayersPageClientProps) {
  const router = useRouter();
  const [players, setPlayers] = useState(initialPlayers);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus>("loading");

  useEffect(() => {
    fetch("/api/supabase-status")
      .then((res) => res.json())
      .then((body) => {
        if (body.connected) setSupabaseStatus("connected");
        else setSupabaseStatus({ error: body.error ?? "Connection failed" });
      })
      .catch((e) => {
        const msg = e?.message?.toLowerCase?.().includes("fetch") ? "Network error — check connection and if Supabase project is paused (Dashboard → Restore project)." : "Could not reach API";
        setSupabaseStatus({ error: msg });
      });
  }, []);

  const refresh = () => router.refresh();

  const handleSavePlayer = async (player: Omit<Player, "id" | "created_at">) => {
    if (!canEdit) {
      setMessage({ type: "err", text: "Connect Supabase to add or edit players." });
      return;
    }
    try {
      if (editingPlayer) {
        const updated = await updatePlayer(editingPlayer.id, player);
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
        const created = await insertPlayer(player);
        if (created) {
          setPlayers((prev) => [created, ...prev]);
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">Players</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Roster and internal ratings.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => { setShowAddForm(true); setEditingPlayer(null); }}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-base)] transition hover:opacity-90"
          >
            Add player
          </button>
        )}
      </div>

      <p className="text-xs text-[var(--text-faint)]">
        Supabase:{" "}
        {supabaseStatus === "loading" && "Checking…"}
        {supabaseStatus === "connected" && "Connected"}
        {typeof supabaseStatus === "object" && supabaseStatus.error}
      </p>

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
          style={{ background: message.type === "ok" ? "var(--success-dim)" : "var(--danger-dim)" }}
        >
          {message.text}
        </div>
      )}

      {canEdit && (showAddForm || editingPlayer) && (
        <PlayerForm
          key={editingPlayer?.id ?? "new-player"}
          player={editingPlayer}
          onSave={handleSavePlayer}
          onCancel={() => { setShowAddForm(false); setEditingPlayer(null); }}
          onAddNew={() => setEditingPlayer(null)}
          canEdit={canEdit}
        />
      )}

      {players.length === 0 ? (
        <div className="card-tech rounded-lg border-dashed p-8 text-center">
          <span className="text-4xl opacity-60">👤</span>
          <h2 className="mt-4 font-semibold text-[var(--text)]">No players yet</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {canEdit ? "Use the form above to add a player." : "Connect Supabase to add players."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {players.map((p) => (
            <li
              key={p.id}
              className="card-tech flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-[var(--text)]">
                  {p.name} {p.jersey ? `#${p.jersey}` : ""}
                </span>
                {p.positions?.length > 0 && (
                  <span className="text-sm text-[var(--text-muted)]">
                    {p.positions.join(", ")}
                  </span>
                )}
                {(p.bats || p.throws) && (
                  <span className="text-sm font-semibold text-[var(--text)]">
                    B/T: {[p.bats ?? "—", p.throws ?? "—"].join("/")}
                  </span>
                )}
                {isDemoId(p.id) && (
                  <span className="rounded px-2 py-0.5 text-xs" style={{ background: "var(--warning-dim)", color: "var(--warning)" }}>
                    Demo
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                {canEdit && !isDemoId(p.id) && (
                  <button type="button" onClick={() => { setShowAddForm(false); setEditingPlayer(p); }} className="text-sm font-medium text-[var(--accent)] hover:underline">
                    Edit
                  </button>
                )}
                <Link href={`/analyst/players/${p.id}`} className="text-sm font-medium text-[var(--accent)] hover:underline">
                  Profile
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlayerForm({
  player,
  onSave,
  onCancel,
  onAddNew,
  canEdit,
}: {
  player: Player | null;
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
  const [saving, setSaving] = useState(false);
  const birthDateInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!player;

  const openBirthdayPicker = () => {
    birthDateInputRef.current?.showPicker?.();
  };

  const togglePosition = (pos: string) => {
    setPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      name: name.trim(),
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
    });
    setSaving(false);
  };

  if (!canEdit) return null;

  return (
    <form onSubmit={handleSubmit} className="card-tech p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">{isEditing ? "Edit player" : "Add player"}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label>
          <span className="text-xs text-[var(--text-muted)]">Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-tech mt-1 block w-full px-3 py-2" placeholder="Full name" required />
        </label>
        <label>
          <span className="text-xs text-[var(--text-muted)]">Jersey</span>
          <input type="text" value={jersey} onChange={(e) => setJersey(e.target.value)} className="input-tech mt-1 block w-full px-3 py-2" placeholder="e.g. 7" />
        </label>
        <label>
          <span className="text-xs text-[var(--text-muted)]">Bats</span>
          <select value={bats} onChange={(e) => setBats(e.target.value as "L" | "R" | "S" | "")} className="input-tech mt-1 block w-full px-3 py-2">
            <option value="">—</option>
            <option value="L">L</option>
            <option value="R">R</option>
            <option value="S">S (Switch)</option>
          </select>
        </label>
        <label>
          <span className="text-xs text-[var(--text-muted)]">Throws</span>
          <select value={throws} onChange={(e) => setThrows(e.target.value as "L" | "R" | "")} className="input-tech mt-1 block w-full px-3 py-2">
            <option value="">—</option>
            <option value="L">L</option>
            <option value="R">R</option>
          </select>
        </label>
        <label>
          <span className="text-xs text-[var(--text-muted)]">Height (ft)</span>
          <div className="mt-1 flex gap-2">
            <input type="number" min={4} max={8} value={height_ft} onChange={(e) => setHeightFt(e.target.value)} className="input-tech w-20 px-3 py-2" placeholder="5" />
            <span className="flex items-center text-[var(--text-muted)]">ft</span>
            <input type="number" min={0} max={11} value={height_in_part} onChange={(e) => setHeightInPart(e.target.value)} className="input-tech w-20 px-3 py-2" placeholder="10" />
            <span className="flex items-center text-[var(--text-muted)]">in</span>
          </div>
        </label>
        <label>
          <span className="text-xs text-[var(--text-muted)]">Weight (lb)</span>
          <input type="number" min={80} max={350} value={weight_lb} onChange={(e) => setWeightLb(e.target.value)} className="input-tech mt-1 block w-full px-3 py-2" placeholder="185" />
        </label>
        <label>
          <span className="text-xs text-[var(--text-muted)]">Hometown</span>
          <input type="text" value={hometown} onChange={(e) => setHometown(e.target.value)} className="input-tech mt-1 block w-full px-3 py-2" placeholder="e.g. San Juan, PR" />
        </label>
        <label>
          <span className="text-xs text-[var(--text-muted)]">Birthday</span>
          <div className="mt-1 flex gap-2">
            <input
              ref={birthDateInputRef}
              type="date"
              value={birth_date}
              onChange={(e) => setBirthDate(e.target.value)}
              className="input-tech flex-1 px-3 py-2"
            />
            <button
              type="button"
              onClick={openBirthdayPicker}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text)]"
              title="Open calendar"
              aria-label="Open calendar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
            </button>
          </div>
        </label>
        <div className="sm:col-span-2">
          <span className="text-xs text-[var(--text-muted)]">Positions</span>
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
