"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isDemoId } from "@/lib/db/mockData";
import {
  createGameWithLineupAction,
  updateGameOnlyAction,
  deleteGameAction,
  fetchCurrentGameLineupName,
  fetchGameLineupSlots,
  replaceOurGameLineupAction,
} from "./actions";
import { isGameFinalized, ourTeamOutcomeFromFinalScore } from "@/lib/gameRecord";
import { isClubRosterPlayer, pitchersForGameTeamSide } from "@/lib/opponentUtils";
import { formatDateMMDDYYYY } from "@/lib/format";
import { StyledDatePicker } from "@/components/shared/StyledDatePicker";
import type { Game, Player, SavedLineup } from "@/lib/types";
import { fetchSavedLineupWithSlots } from "@/app/analyst/lineup/actions";
import { OpponentLineupModal } from "@/components/analyst/OpponentLineupModal";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import {
  analystGameLogHref,
  analystGameReviewHref,
  analystRecordHref,
} from "@/lib/analystRoutes";

interface GamesPageClientProps {
  initialGames: Game[];
  initialSavedLineups: SavedLineup[];
  initialPlayers: Player[];
  /** Names from Analyst → Opponents (tracked_opponents). */
  initialTrackedOpponentNames: string[];
  canEdit: boolean;
}

export function GamesPageClient({
  initialGames,
  initialSavedLineups,
  initialPlayers,
  initialTrackedOpponentNames,
  canEdit,
}: GamesPageClientProps) {
  const router = useRouter();
  const [games, setGames] = useState(initialGames);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err" | "deleted"; text: string } | null>(null);
  const [messageDismissing, setMessageDismissing] = useState(false);

  const isFormOpen = editingGame !== null || showAddForm;

  const refresh = () => router.refresh();

  useEffect(() => {
    setGames(initialGames);
  }, [initialGames]);

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
    savedLineupId?: string | null,
    opponentSlots?: { player_id: string; position?: string | null }[] | null,
    ourSlotsOverride?: { player_id: string; position?: string | null }[] | null
  ) => {
    if (!canEdit) {
      setMessage({ type: "err", text: "Connect Supabase to add or edit games." });
      return;
    }
    const ourCustom = ourSlotsOverride && ourSlotsOverride.length > 0 ? ourSlotsOverride : null;
    if (editingGame) {
      const updated = await updateGameOnlyAction(editingGame.id, game);
      if (updated) {
        if (ourCustom) {
          await replaceOurGameLineupAction(editingGame.id, ourCustom);
        }
        setGames((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
        setEditingGame(null);
        setShowAddForm(false);
        setMessage({
          type: "ok",
          text: ourCustom ? "Game updated with lineup changes." : "Game updated.",
        });
        refresh();
      } else {
        setMessage({ type: "err", text: "Could not update game." });
      }
    } else {
      try {
        const created = await createGameWithLineupAction(
          game,
          savedLineupId,
          opponentSlots && opponentSlots.length > 0 ? opponentSlots : null,
          ourCustom
        );
        setGames((prev) => [created, ...prev]);
        setEditingGame(null);
        setShowAddForm(false);
        const hasOpp = opponentSlots && opponentSlots.length > 0;
        const hasOur = !!ourCustom;
        setMessage({
          type: "ok",
          text: hasOpp && hasOur
            ? "Game added with both lineups."
            : hasOpp
              ? "Game added with second lineup."
              : hasOur
                ? "Game added with custom lineup."
                : savedLineupId
                  ? "Game added with selected lineup."
                  : "Game added with default lineup.",
        });
        refresh();
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        const rlsHint =
          /row-level security|rls policy/i.test(raw) || /permission denied/i.test(raw)
            ? " Use the app Log in so your session is authenticated — many Supabase setups only allow writes for signed-in users."
            : "";
        setMessage({
          type: "err",
          text: `Could not add game: ${raw}.${rlsHint}`,
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">Games</h1>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => { setShowAddForm(true); setEditingGame(null); }}
            className="font-display rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] transition hover:opacity-90"
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
            message.type === "ok" || message.type === "deleted"
              ? "text-[var(--success)]"
              : "text-[var(--danger)]"
          } ${messageDismissing ? "opacity-0" : "opacity-100"}`}
          style={{
            background:
              message.type === "ok" || message.type === "deleted"
                ? "var(--success-dim)"
                : "var(--danger-dim)",
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
        game={editingGame && isGameFinalized(editingGame) ? null : editingGame}
        savedLineups={initialSavedLineups}
        players={initialPlayers}
        trackedOpponentNames={initialTrackedOpponentNames}
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
          <h2 className="font-display mt-4 font-semibold text-[var(--text)]">No games yet</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {canEdit ? "Use the form above to add a game." : "Connect Supabase to add games."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2" aria-label="Games list">
          {games.map((g) => {
            const finalized = isGameFinalized(g);
            const outcome = finalized ? ourTeamOutcomeFromFinalScore(g) : null;
            return (
            <li
              key={g.id}
              className="card-tech flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-[var(--text)]">
                  {formatDateMMDDYYYY(g.date)} — {g.away_team} @ {g.home_team}
                </span>
                {outcome != null && (
                  <span
                    className={`font-display font-semibold tabular-nums ${
                      outcome === "W"
                        ? "text-[var(--success)]"
                        : outcome === "L"
                          ? "text-[var(--danger)]"
                          : "text-[var(--text-muted)]"
                    }`}
                    title={outcome === "T" ? "Tie game" : outcome === "W" ? "Win" : "Loss"}
                  >
                    {outcome}
                  </span>
                )}
                {finalized && (
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
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Link
                  href={analystGameLogHref(g.id)}
                  className="font-display inline-flex min-h-[40px] items-center rounded-lg border-2 border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm font-semibold tracking-wide text-[var(--text)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]"
                >
                  Log
                </Link>
                {!finalized && (
                  <Link
                    href={analystRecordHref(g.id)}
                    className="font-display inline-flex min-h-[40px] items-center rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold tracking-wide text-[var(--bg-base)] transition hover:opacity-90"
                  >
                    Record
                  </Link>
                )}
                <Link
                  href={analystGameReviewHref(g.id)}
                  className={`inline-flex min-h-[40px] items-center rounded-lg px-3 py-1.5 text-sm font-medium transition hover:opacity-90 ${
                    finalized
                      ? "font-display bg-[var(--accent)] font-semibold tracking-wide text-[var(--bg-base)]"
                      : "border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)]"
                  }`}
                >
                  Review
                </Link>
                {canEdit && !isDemoId(g.id) && !finalized ? (
                  <button
                    type="button"
                    onClick={() => { setEditingGame(g); setShowAddForm(false); }}
                    className="inline-flex min-h-[40px] items-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--accent-dim)]"
                  >
                    Edit
                  </button>
                ) : null}
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function GameForm({
  game,
  savedLineups,
  players,
  trackedOpponentNames,
  onSave,
  onCancel,
  onAddNew,
  onDelete,
  canEdit,
}: {
  game: Game | null;
  savedLineups: SavedLineup[];
  players: Player[];
  trackedOpponentNames: string[];
  onSave: (
    g: Omit<Game, "id" | "created_at">,
    savedLineupId?: string | null,
    opponentSlots?: { player_id: string; position?: string | null }[] | null,
    ourSlotsOverride?: { player_id: string; position?: string | null }[] | null
  ) => Promise<void>;
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
  const [deleteGameConfirmOpen, setDeleteGameConfirmOpen] = useState(false);
  const [ourLineupModalOpen, setOurLineupModalOpen] = useState(false);
  const [ourModalInitialSlots, setOurModalInitialSlots] = useState<{ player_id: string; position: string | null }[]>([]);
  const [ourLineupModalTitle, setOurLineupModalTitle] = useState("Lineup");
  const [ourModalOpening, setOurModalOpening] = useState(false);
  const [ourOrderedSlots, setOurOrderedSlots] = useState<{ player_id: string; position: string | null }[]>([]);
  const [opponentModalOpen, setOpponentModalOpen] = useState(false);
  const [opponentOrderedSlots, setOpponentOrderedSlots] = useState<{ player_id: string; position: string | null }[]>([]);
  const [spHome, setSpHome] = useState<string>(() => game?.starting_pitcher_home_id ?? "");
  const [spAway, setSpAway] = useState<string>(() => game?.starting_pitcher_away_id ?? "");

  const matchupGame = useMemo(
    (): Pick<Game, "home_team" | "away_team" | "our_side"> => ({
      home_team: our_side === "home" ? our_team.trim() : opponent.trim(),
      away_team: our_side === "home" ? opponent.trim() : our_team.trim(),
      our_side,
    }),
    [our_side, our_team, opponent]
  );
  const homePitchers = useMemo(
    () => pitchersForGameTeamSide(matchupGame, "home", players),
    [matchupGame, players]
  );
  const awayPitchers = useMemo(
    () => pitchersForGameTeamSide(matchupGame, "away", players),
    [matchupGame, players]
  );

  useEffect(() => {
    if (game) {
      setSpHome(game.starting_pitcher_home_id ?? "");
      setSpAway(game.starting_pitcher_away_id ?? "");
    } else {
      setSpHome("");
      setSpAway("");
    }
  }, [game?.id, game?.starting_pitcher_home_id, game?.starting_pitcher_away_id]);

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

  useEffect(() => {
    setOurOrderedSlots([]);
  }, [lineupId]);

  const trackedSorted = useMemo(
    () => [...trackedOpponentNames].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    [trackedOpponentNames]
  );
  const trimmedOpp = opponent.trim();
  const isInTrackedList = trackedSorted.includes(trimmedOpp);
  /** Dropdown only when we have tracked names and the opponent is a list pick (or new game). Legacy edits use text input. */
  const useOpponentSelect = trackedSorted.length > 0 && (!isEditing || isInTrackedList);

  async function buildOurLineupPreview(): Promise<{
    ordered: { player_id: string; position: string | null }[];
    title: string;
  }> {
    if (lineupId === "__keep__" && game?.id) {
      const slots = await fetchGameLineupSlots(game.id);
      return {
        ordered: slots.map((s) => ({ player_id: s.player_id, position: s.position ?? null })),
        title: currentLineupName,
      };
    }
    if (lineupId === "") {
      const club = players.filter((p) => isClubRosterPlayer(p));
      return {
        ordered: club.slice(0, 9).map((p) => ({ player_id: p.id, position: p.positions?.[0] ?? null })),
        title: "Club roster (first 9)",
      };
    }
    const data = await fetchSavedLineupWithSlots(lineupId);
    if (!data?.slots?.length) {
      return { ordered: [], title: "Lineup" };
    }
    const ordered = [...data.slots]
      .sort((a, b) => a.slot - b.slot)
      .map((s) => ({ player_id: s.player_id, position: s.position ?? null }));
    return { ordered, title: data.name };
  }

  async function openOurLineupModal() {
    setOurModalOpening(true);
    try {
      if (ourOrderedSlots.length > 0) {
        setOurModalInitialSlots(ourOrderedSlots);
        setOurLineupModalOpen(true);
        return;
      }
      const { ordered, title } = await buildOurLineupPreview();
      setOurModalInitialSlots(ordered);
      setOurLineupModalTitle(title);
      setOurLineupModalOpen(true);
    } finally {
      setOurModalOpening(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const home_team = our_side === "home" ? our_team.trim() : opponent.trim();
    const away_team = our_side === "home" ? opponent.trim() : our_team.trim();
    const ourOverride = ourOrderedSlots.length > 0 ? ourOrderedSlots : null;
    await onSave(
      {
        date,
        home_team,
        away_team,
        our_side,
        game_time: game_time.trim() || null,
        final_score_home: null,
        final_score_away: null,
        starting_pitcher_home_id: spHome || null,
        starting_pitcher_away_id: spAway || null,
      },
      isEditing ? lineupId : (lineupId || null),
      isEditing ? undefined : opponentOrderedSlots.length > 0 ? opponentOrderedSlots : null,
      ourOverride
    );
    setSaving(false);
  };

  if (!canEdit) return null;

  return (
    <form onSubmit={handleSubmit} className="card-tech p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-white">{isEditing ? "Edit game" : "Add game"}</h3>

      {/* When */}
      <div className="mt-4">
        <span className="text-xs font-medium uppercase tracking-wider text-white">When</span>
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
        <span className="text-xs font-medium uppercase tracking-wider text-white">Matchup</span>
        <div className="mt-2 space-y-3">
          <div>
            <span className="text-xs text-white block mb-1">Side</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOurSide("home")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  our_side === "home"
                    ? "border-[var(--accent)] bg-[var(--accent)] text-black"
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
                    ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                    : "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text)]"
                }`}
              >
                Away
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="text-xs text-[var(--text-muted)]">
                {our_side === "home" ? "Home" : "Away"}
              </span>
              <input
                type="text"
                value={our_team}
                onChange={(e) => setOurTeam(e.target.value)}
                className="input-tech mt-1 block w-full px-3 py-2"
                placeholder="Team name"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--text-muted)]">
                {our_side === "home" ? "Away" : "Home"}
              </span>
              {useOpponentSelect ? (
                <select
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  className="input-tech mt-1 block w-full px-3 py-2"
                  required
                  aria-label="Other team name"
                >
                  <option value="">Select team…</option>
                  {trackedSorted.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  className="input-tech mt-1 block w-full px-3 py-2"
                  placeholder="Team name"
                  required
                  aria-label="Other team name"
                />
              )}
            </label>
          </div>
        </div>
      </div>

      {/* Starting pitchers */}
      <div className="mt-6">
        <span className="text-xs font-medium uppercase tracking-wider text-white block">
          Starting pitchers
        </span>
        
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="text-xs text-[var(--text-muted)]">
              Home{matchupGame.home_team ? ` (${matchupGame.home_team})` : ""}
            </span>
            <select
              value={spHome}
              onChange={(e) => setSpHome(e.target.value)}
              className="input-tech mt-1 block w-full px-3 py-2"
              aria-label="Starting pitcher, home team"
            >
              <option value="">—</option>
              {homePitchers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.jersey ? ` #${p.jersey}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs text-[var(--text-muted)]">
              Away{matchupGame.away_team ? ` (${matchupGame.away_team})` : ""}
            </span>
            <select
              value={spAway}
              onChange={(e) => setSpAway(e.target.value)}
              className="input-tech mt-1 block w-full px-3 py-2"
              aria-label="Starting pitcher, away team"
            >
              <option value="">—</option>
              {awayPitchers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.jersey ? ` #${p.jersey}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Two lineup columns when adding a game */}
      <div
        className={`mt-6 grid items-start gap-6 ${!isEditing ? "lg:grid-cols-2" : ""}`}
      >
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-white block">
            Lineup
          </span>
          <div className="mt-2 space-y-2">
            <button
              type="button"
              onClick={() => void openOurLineupModal()}
              disabled={ourModalOpening}
              className="w-full rounded-lg border border-[var(--accent)]/50 bg-[var(--bg-elevated)] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:border-[var(--accent)] hover:bg-[var(--bg-card)] disabled:opacity-60"
            >
              {ourModalOpening ? "Opening…" : `View ${our_team.trim() || (our_side === "home" ? "Home" : "Away")} lineup`}
            </button>
            {ourOrderedSlots.length > 0 ? (
              <span className="block text-sm text-[var(--text-muted)]">{ourOrderedSlots.length} in lineup</span>
            ) : (
              <span className="block text-sm text-[var(--text-muted)]">Not set</span>
            )}
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
          </div>
        </div>

        {!isEditing && (
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-white block">
              {our_side === "home" ? "Away" : "Home"} lineup
            </span>
            <div className="mt-2 space-y-2">
              <button
                type="button"
                onClick={() => setOpponentModalOpen(true)}
                className="w-full rounded-lg border border-[var(--accent)]/50 bg-[var(--bg-elevated)] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:border-[var(--accent)] hover:bg-[var(--bg-card)]"
              >
                View {opponent.trim() || (our_side === "home" ? "Away" : "Home")} lineup
              </button>
              {opponentOrderedSlots.length > 0 ? (
                <span className="block text-sm text-[var(--text-muted)]">
                  {opponentOrderedSlots.length} in lineup
                </span>
              ) : (
                <span className="block text-sm text-[var(--text-muted)]">Not set</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="font-display rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] disabled:opacity-50"
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
              onClick={() => {
                if (!game) return;
                setDeleteGameConfirmOpen(true);
              }}
              disabled={deleting}
              className="ml-auto rounded-lg border border-[var(--danger)] px-4 py-2 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger-dim)] disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete game"}
            </button>
          </>
        )}
      </div>

      <OpponentLineupModal
        variant="our"
        open={ourLineupModalOpen}
        onClose={() => setOurLineupModalOpen(false)}
        opponentName=""
        players={players}
        initialOrderedSlots={ourModalInitialSlots}
        lineupTitle={ourLineupModalTitle}
        onConfirm={(slots) => {
          setOurOrderedSlots(slots);
        }}
      />

      <OpponentLineupModal
        open={opponentModalOpen}
        onClose={() => setOpponentModalOpen(false)}
        opponentName={opponent}
        players={players}
        initialOrderedSlots={opponentOrderedSlots}
        onConfirm={setOpponentOrderedSlots}
      />

      <ConfirmDeleteDialog
        open={deleteGameConfirmOpen}
        onClose={() => !deleting && setDeleteGameConfirmOpen(false)}
        title="Delete this game?"
        description="This cannot be undone. Plate appearances and other data tied to this game may be removed."
        confirmLabel="Delete game"
        pendingLabel="Deleting…"
        pending={deleting}
        onConfirm={async () => {
          if (!game) return;
          setDeleting(true);
          try {
            await onDelete(game.id);
          } finally {
            setDeleting(false);
            setDeleteGameConfirmOpen(false);
          }
        }}
      />
    </form>
  );
}
