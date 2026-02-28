"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isDemoId } from "@/lib/db/mockData";
import { updateGame } from "@/lib/db/queries";
import { createGameWithLineupAction, updateGameWithLineupAction, deleteGameAction, fetchCurrentGameLineupName, fetchGameLineupSlots, clearPAsForGameAction } from "./actions";
import { formatDateMMDDYYYY } from "@/lib/format";
import { StyledDatePicker } from "@/components/shared/StyledDatePicker";
import type { Game, Player } from "@/lib/types";
import type { SavedLineup } from "@/lib/types";
import { fetchSavedLineupWithSlots } from "@/app/analyst/lineup/actions";

interface GamesPageClientProps {
  initialGames: Game[];
  initialSavedLineups: SavedLineup[];
  initialPlayers: Player[];
  canEdit: boolean;
}

export function GamesPageClient({ initialGames, initialSavedLineups, initialPlayers, canEdit }: GamesPageClientProps) {
  const router = useRouter();
  const [games, setGames] = useState(initialGames);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err" | "deleted"; text: string } | null>(null);
  const [messageDismissing, setMessageDismissing] = useState(false);
  const [clearingGameId, setClearingGameId] = useState<string | null>(null);

  const isFormOpen = editingGame !== null || showAddForm;

  const refresh = () => router.refresh();

  // Auto-dismiss message after 4s, with fade-out
  useEffect(() => {
    if (!message) return;
    const showMs = 4000;
    const fadeMs = 300;
    const t1 = setTimeout(() => setMessageDismissing(true), showMs);
    return () => clearTimeout(t1);
  }, [message]);

  useEffect(() => {
    if (!messageDismissing) return;
    const fadeMs = 300;
    const t2 = setTimeout(() => {
      setMessage(null);
      setMessageDismissing(false);
    }, fadeMs);
    return () => clearTimeout(t2);
  }, [messageDismissing]);

  const handleSaveGame = async (
    game: Omit<Game, "id" | "created_at">,
    savedLineupId?: string | null
  ) => {
    if (!canEdit) {
      setMessage({ type: "err", text: "Connect Supabase to add or edit games." });
      return;
    }
    if (editingGame) {
      const updated = await updateGame(editingGame.id, game);
      if (updated) {
        setGames((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
        setEditingGame(null);
        setShowAddForm(false);
        setMessage({ type: "ok", text: "Game updated." });
        refresh();
      } else {
        setMessage({ type: "err", text: "Could not update game." });
      }
    } else {
      const created = await createGameWithLineupAction(game, savedLineupId);
      if (created) {
        setGames((prev) => [created, ...prev]);
        setEditingGame(null);
        setShowAddForm(false);
        setMessage({
          type: "ok",
          text: savedLineupId ? "Game added with selected lineup." : "Game added with default lineup.",
        });
        refresh();
      } else {
        setMessage({ type: "err", text: "Could not add game. Is Supabase connected?" });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">Games</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Select a game to log plate appearances.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => { setShowAddForm(true); setEditingGame(null); }}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-base)] transition hover:opacity-90"
          >
            Add game
          </button>
        )}
      </div>

      {!canEdit && (
        <div className="rounded-lg border border-[var(--border)] p-4 text-[var(--text-muted)]" style={{ background: "var(--warning-dim)" }}>
          Connect Supabase to add or edit games.
        </div>
      )}

      {message && (
        <div
          className={`rounded-lg border p-4 transition-opacity duration-300 ${
            message.type === "ok"
              ? "text-[var(--success)]"
              : "text-[var(--danger)]"
          } ${messageDismissing ? "opacity-0" : "opacity-100"}`}
          style={{
            background: message.type === "ok" ? "var(--success-dim)" : "var(--danger-dim)",
            borderColor: "var(--border)",
          }}
          role="alert"
          aria-live="polite"
        >
          {message.text}
        </div>
      )}

      {isFormOpen && (
      <GameForm
        key={editingGame?.id ?? "new-game"}
        game={editingGame}
        savedLineups={initialSavedLineups}
        players={initialPlayers}
        onSave={handleSaveGame}
        onCancel={() => { setEditingGame(null); setShowAddForm(false); }}
        onAddNew={() => { setEditingGame(null); setShowAddForm(true); }}
        onDelete={async (gameId) => {
          const ok = await deleteGameAction(gameId);
          if (ok) {
            setGames((prev) => prev.filter((g) => g.id !== gameId));
            setEditingGame(null);
            setShowAddForm(false);
            setMessage({ type: "deleted", text: "Game deleted." });
            refresh();
          } else {
            setMessage({ type: "err", text: "Could not delete game." });
          }
        }}
        canEdit={canEdit}
      />
      )}

      {games.length === 0 ? (
        <div className="card-tech rounded-lg border-dashed p-8 text-center">
          <span className="text-4xl opacity-60">📅</span>
          <h2 className="mt-4 font-semibold text-[var(--text)]">No games yet</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {canEdit ? "Use the form above to add a game." : "Connect Supabase to add games."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {games.map((g) => (
            <li
              key={g.id}
              className="card-tech flex flex-wrap items-center justify-between gap-2 p-4"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-[var(--text)]">
                  {formatDateMMDDYYYY(g.date)} — {g.away_team} @ {g.home_team}
                </span>
                {g.final_score_home != null && g.final_score_away != null && (
                  <span className="text-[var(--text-muted)]">
                    ({g.final_score_away}-{g.final_score_home})
                  </span>
                )}
                {isDemoId(g.id) && (
                  <span className="rounded px-2 py-0.5 text-xs opacity-80" style={{ background: "var(--warning-dim)", color: "var(--warning)" }}>
                    Demo
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/analyst/record?gameId=${g.id}`}
                  className="inline-flex items-center rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--bg-base)] transition hover:opacity-90"
                >
                  Record PAs
                </Link>
                <Link
                  href={`/analyst/games/${g.id}/review`}
                  className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--text)] transition hover:opacity-90"
                >
                  Box score
                </Link>
                {canEdit && !isDemoId(g.id) && (
                  <>
                    <button
                      type="button"
                      onClick={() => { setEditingGame(g); setShowAddForm(false); }}
                      className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--accent-dim)]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={clearingGameId === g.id}
                      onClick={async () => {
                        if (!confirm("Clear all plate appearances for this game? This cannot be undone.")) return;
                        setClearingGameId(g.id);
                        const result = await clearPAsForGameAction(g.id);
                        setClearingGameId(null);
                        if (result.ok) {
                          setMessage({ type: "ok", text: result.count > 0 ? `Cleared ${result.count} PA(s) for this game.` : "No PAs to clear for this game." });
                          refresh();
                        } else {
                          setMessage({ type: "err", text: result.error ?? "Failed to clear PAs." });
                        }
                      }}
                      className="inline-flex items-center rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium transition hover:bg-[var(--danger-dim)]"
                      style={{ color: "var(--danger)" }}
                    >
                      {clearingGameId === g.id ? "Clearing…" : "Clear PAs"}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GameForm({
  game,
  savedLineups,
  players,
  onSave,
  onCancel,
  onAddNew,
  onDelete,
  canEdit,
}: {
  game: Game | null;
  savedLineups: SavedLineup[];
  players: Player[];
  onSave: (g: Omit<Game, "id" | "created_at">, savedLineupId?: string | null) => Promise<void>;
  onCancel: () => void;
  onAddNew: () => void;
  onDelete: (gameId: string) => Promise<void>;
  canEdit: boolean;
}) {
  const isEditing = !!game;
  const [date, setDate] = useState(game?.date ?? new Date().toISOString().slice(0, 10));
  const [our_side, setOurSide] = useState<"home" | "away">(game?.our_side ?? "home");
  const [our_team, setOurTeam] = useState<string>(() =>
    game ? (game.our_side === "home" ? game.home_team : game.away_team) : ""
  );
  const [opponent, setOpponent] = useState<string>(() =>
    game ? (game.our_side === "home" ? game.away_team : game.home_team) : ""
  );
  const [game_time, setGameTime] = useState<string>(() => {
    const t = game?.game_time;
    if (!t) return "";
    const part = t.trim().split(":").slice(0, 2).join(":");
    return part || "";
  });
  const [lineupId, setLineupId] = useState<string>(
    isEditing ? "__keep__" : (savedLineups[0]?.id ?? "")
  );
  const [currentLineupName, setCurrentLineupName] = useState<string>("Current lineup");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  useEffect(() => {
    if (!game?.id) return;
    let cancelled = false;
    fetchCurrentGameLineupName(game.id).then((name) => {
      if (!cancelled) setCurrentLineupName(name);
    });
    return () => { cancelled = true; };
  }, [game?.id]);

  useEffect(() => {
    const t = game?.game_time;
    if (t == null) setGameTime("");
    else setGameTime(t.trim().split(":").slice(0, 2).join(":") || "");
  }, [game?.id, game?.game_time]);

  useEffect(() => {
    if (!game?.id) return;
    setOurSide(game.our_side);
    setOurTeam(game.our_side === "home" ? game.home_team : game.away_team);
    setOpponent(game.our_side === "home" ? game.away_team : game.home_team);
  }, [game?.id, game?.our_side, game?.home_team, game?.away_team]);
  const [reviewLineup, setReviewLineup] = useState<{ name: string; slots: { slot: number; player_id: string; position: string | null }[] } | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const playerMap = new Map(players.map((p) => [p.id, p]));

  async function openReviewModal() {
    setReviewLoading(true);
    setReviewModalOpen(true);
    if (lineupId === "__keep__" && game?.id) {
      const slots = await fetchGameLineupSlots(game.id);
      setReviewLineup({
        name: currentLineupName,
        slots: slots.map((s) => ({
          slot: s.slot,
          player_id: s.player_id,
          position: playerMap.get(s.player_id)?.positions?.[0] ?? null,
        })),
      });
      setReviewLoading(false);
    } else if (lineupId === "") {
      const slots = players.slice(0, 9).map((p, i) => ({
        slot: i + 1,
        player_id: p.id,
        position: p.positions?.[0] ?? null,
      }));
      setReviewLineup({ name: "First 9 players", slots });
      setReviewLoading(false);
    } else {
      const data = await fetchSavedLineupWithSlots(lineupId);
      setReviewLineup(data ? { name: data.name, slots: data.slots } : null);
      setReviewLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const home_team = our_side === "home" ? our_team.trim() : opponent.trim();
    const away_team = our_side === "home" ? opponent.trim() : our_team.trim();
    await onSave(
      {
        date,
        home_team,
        away_team,
        our_side,
        game_time: game_time.trim() || null,
        final_score_home: null,
        final_score_away: null,
      },
      isEditing ? lineupId : (lineupId || null)
    );
    setSaving(false);
  };

  if (!canEdit) return null;

  return (
    <form onSubmit={handleSubmit} className="card-tech p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">{isEditing ? "Edit game" : "Add game"}</h3>

      {/* When */}
      <div className="mt-4">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">When</span>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="text-xs text-[var(--text-muted)]">Date</span>
            <StyledDatePicker
              value={date}
              onChange={setDate}
              className="input-tech mt-1 block w-full px-3 py-2"
              required
            />
          </label>
          <label>
            <span className="text-xs text-[var(--text-muted)]">Time (optional)</span>
            <input
              type="time"
              value={game_time}
              onChange={(e) => setGameTime(e.target.value)}
              className="input-tech mt-1 block w-full px-3 py-2"
            />
          </label>
        </div>
      </div>

      {/* Matchup */}
      <div className="mt-6">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Matchup</span>
        <div className="mt-2 space-y-3">
          <div>
            <span className="text-xs text-[var(--text-muted)] block mb-1">Our side</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOurSide("home")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  our_side === "home"
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text)]"
                }`}
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => setOurSide("away")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  our_side === "away"
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text)]"
                }`}
              >
                Away
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="text-xs text-[var(--text-muted)]">Our team</span>
              <input
                type="text"
                value={our_team}
                onChange={(e) => setOurTeam(e.target.value)}
                className="input-tech mt-1 block w-full px-3 py-2"
                placeholder="Your team name"
                required
              />
            </label>
            <label>
              <span className="text-xs text-[var(--text-muted)]">Opponent</span>
              <input
                type="text"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                className="input-tech mt-1 block w-full px-3 py-2"
                placeholder="Opposing team"
                required
              />
            </label>
          </div>
        </div>
      </div>

      {/* Lineup */}
      <div className="mt-6">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] block">Lineup</span>
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            value={lineupId}
            onChange={(e) => setLineupId(e.target.value)}
            className="input-tech min-w-[14rem] max-w-full px-3 py-2"
            aria-label="Lineup template"
          >
            {isEditing ? (
              <>
                <option value="__keep__">{currentLineupName}</option>
                {savedLineups.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </>
            ) : (
              <>
                {savedLineups.length === 0 ? (
                  <option value="">No saved lineups</option>
                ) : null}
                {savedLineups.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </>
            )}
          </select>
          <button
            type="button"
            onClick={openReviewModal}
            className="shrink-0 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Review lineup
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-base)] disabled:opacity-50"
        >
          {saving ? "Saving…" : isEditing ? "Update game" : "Add game"}
        </button>
        {isEditing && (
          <>
            <button type="button" onClick={onCancel} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)]">
              Cancel
            </button>
            <button type="button" onClick={onAddNew} className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
              Add new instead
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!game || !confirm("Delete this game? This cannot be undone.")) return;
                setDeleting(true);
                await onDelete(game.id);
                setDeleting(false);
              }}
              disabled={deleting}
              className="ml-auto rounded-lg border border-[var(--danger)] px-4 py-2 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger-dim)] disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete game"}
            </button>
          </>
        )}
      </div>

      {/* Review lineup modal */}
      {reviewModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setReviewModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-lineup-title"
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h2 id="review-lineup-title" className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {reviewLineup ? reviewLineup.name : "Lineup"}
              </h2>
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text)]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {reviewLoading ? (
                <p className="text-sm text-[var(--text-muted)]">Loading…</p>
              ) : !reviewLineup?.slots?.length ? (
                <p className="text-sm text-[var(--text-muted)]">No lineup data.</p>
              ) : (
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                      <th className="py-2 pr-3 text-center font-semibold">#</th>
                      <th className="py-2 pr-3 font-semibold">POS</th>
                      <th className="py-2 pr-3 font-semibold">Player</th>
                      <th className="py-2 text-center font-semibold">Bats</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...reviewLineup.slots]
                      .sort((a, b) => a.slot - b.slot)
                      .map((s) => {
                        const player = playerMap.get(s.player_id);
                        return (
                          <tr key={s.slot} className="border-b border-[var(--border)] last:border-0">
                            <td className="py-2 pr-3 text-center font-medium text-[var(--text)]">{s.slot}</td>
                            <td className="py-2 pr-3 text-[var(--text)]">{s.position ?? "—"}</td>
                            <td className="py-2 pr-3 text-[var(--text)]">{player?.name ?? "—"}</td>
                            <td className="py-2 text-center text-[var(--text)]">{player?.bats ?? "—"}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="border-t border-[var(--border)] px-4 py-3">
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="w-full rounded-lg bg-[var(--accent)] py-2 text-sm font-medium text-[var(--bg-base)]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
