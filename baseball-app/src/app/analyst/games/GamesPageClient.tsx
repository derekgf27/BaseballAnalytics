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
  fetchOpponentGameLineupSlots,
  replaceOurGameLineupAction,
  replaceOpponentGameLineupAction,
  fetchLineupSlotsForBallparkSideAction,
} from "./actions";
import { isGameFinalized, ourTeamOutcomeFromFinalScore } from "@/lib/gameRecord";
import { isActiveRosterPlayer, isClubRosterPlayer, matchupLabelUsFirst, pitchersForGameTeamSide } from "@/lib/opponentUtils";
import { formatDateMMDDYYYY } from "@/lib/format";
import { StyledDatePicker } from "@/components/shared/StyledDatePicker";
import type { Game, Player, SavedLineup } from "@/lib/types";
import { fetchSavedLineupWithSlots } from "@/app/analyst/lineup/actions";
import { OpponentLineupModal } from "@/components/analyst/OpponentLineupModal";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import {
  analystGameLogHref,
  analystGameReviewHref,
  analystOpponentDetailHref,
  analystRecordHref,
} from "@/lib/analystRoutes";
import { defaultClubTeamNameFromGames } from "@/lib/defaultClubTeamName";

/** Select value that switches opponent field to free text (tracked-opponents dropdown). */
const OPP_CUSTOM_SENTINEL = "__custom_opponent__";

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

  const defaultClubTeamName = useMemo(() => defaultClubTeamNameFromGames(games), [games]);

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
      const sideFlipped = editingGame.our_side !== game.our_side;
      let ourSlotsToWrite: { player_id: string; position?: string | null }[] | null = null;
      if (sideFlipped) {
        ourSlotsToWrite = ourCustom ?? (await fetchLineupSlotsForBallparkSideAction(editingGame.id, editingGame.our_side));
      } else if (ourCustom) {
        ourSlotsToWrite = ourCustom;
      }

      const updated = await updateGameOnlyAction(editingGame.id, game);
      if (updated) {
        if (ourSlotsToWrite !== null) {
          await replaceOurGameLineupAction(editingGame.id, ourSlotsToWrite);
        }
        await replaceOpponentGameLineupAction(editingGame.id, opponentSlots ?? []);
        setGames((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
        setEditingGame(null);
        setShowAddForm(false);
        setMessage({
          type: "ok",
          text: "Game updated.",
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
        defaultClubTeamName={defaultClubTeamName}
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
                  {formatDateMMDDYYYY(g.date)} — {matchupLabelUsFirst(g, true)}
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
  defaultClubTeamName,
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
  /** Pre-filled club name for new games (env or latest game). */
  defaultClubTeamName: string;
  canEdit: boolean;
}) {
  const isEditing = !!game;
  const [date, setDate] = useState(game?.date ?? new Date().toISOString().slice(0, 10));
  const [our_side, setOurSide] = useState<"home" | "away">(game?.our_side ?? "home");
  const [our_team, setOurTeam] = useState<string>(() =>
    game ? (game.our_side === "home" ? game.home_team : game.away_team) : defaultClubTeamName.trim()
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
  /** Our club vs opponent starters (stable columns); mapped to home/away IDs on save. */
  const [spOur, setSpOur] = useState<string>(() =>
    game
      ? (game.our_side === "home" ? game.starting_pitcher_home_id : game.starting_pitcher_away_id) ?? ""
      : ""
  );
  const [spOpp, setSpOpp] = useState<string>(() =>
    game
      ? (game.our_side === "home" ? game.starting_pitcher_away_id : game.starting_pitcher_home_id) ?? ""
      : ""
  );
  /** Our club’s credited save (optional); stored on `games.save_pitcher_id`. */
  const [savePitcherOur, setSavePitcherOur] = useState<string>(() => game?.save_pitcher_id ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  /** When tracked opponents exist, user can still type a name not in the list. */
  const [opponentUseCustom, setOpponentUseCustom] = useState(false);

  const matchupGame = useMemo(
    (): Pick<Game, "home_team" | "away_team" | "our_side"> => ({
      home_team: our_side === "home" ? our_team.trim() : opponent.trim(),
      away_team: our_side === "home" ? opponent.trim() : our_team.trim(),
      our_side,
    }),
    [our_side, our_team, opponent]
  );
  const ourBallparkSide = our_side === "home" ? "home" : "away";
  const oppBallparkSide = our_side === "home" ? "away" : "home";
  const ourPitchers = useMemo(
    () => pitchersForGameTeamSide(matchupGame, ourBallparkSide, players),
    [matchupGame, ourBallparkSide, players]
  );
  const oppPitchers = useMemo(
    () => pitchersForGameTeamSide(matchupGame, oppBallparkSide, players),
    [matchupGame, oppBallparkSide, players]
  );

  useEffect(() => {
    if (game) {
      setSpOur(
        (game.our_side === "home" ? game.starting_pitcher_home_id : game.starting_pitcher_away_id) ?? ""
      );
      setSpOpp(
        (game.our_side === "home" ? game.starting_pitcher_away_id : game.starting_pitcher_home_id) ?? ""
      );
      setSavePitcherOur(game.save_pitcher_id ?? "");
    } else {
      setSpOur("");
      setSpOpp("");
      setSavePitcherOur("");
    }
  }, [
    game?.id,
    game?.our_side,
    game?.starting_pitcher_home_id,
    game?.starting_pitcher_away_id,
    game?.save_pitcher_id,
  ]);

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

  useEffect(() => {
    setOpponentUseCustom(false);
    setFormError(null);
  }, [game?.id]);

  useEffect(() => {
    if (!game?.id) {
      setOpponentOrderedSlots([]);
      return;
    }
    let cancelled = false;
    fetchOpponentGameLineupSlots(game.id).then((rows) => {
      if (cancelled) return;
      setOpponentOrderedSlots(
        rows.map((s) => ({ player_id: s.player_id, position: s.position ?? null }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [game?.id]);

  const trackedSorted = useMemo(
    () => [...trackedOpponentNames].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    [trackedOpponentNames]
  );
  const activePlayers = useMemo(() => players.filter(isActiveRosterPlayer), [players]);
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
      const club = activePlayers.filter((p) => isClubRosterPlayer(p));
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
    const home_team = our_side === "home" ? our_team.trim() : opponent.trim();
    const away_team = our_side === "home" ? opponent.trim() : our_team.trim();
    const problems: string[] = [];
    if (!our_team.trim()) problems.push("Enter your club’s team name.");
    if (!opponent.trim()) {
      problems.push(
        useOpponentSelect && !opponentUseCustom
          ? "Choose an opponent from the list or use “Other / not listed…”."
          : "Enter the other team’s name."
      );
    }
    if (problems.length) {
      setFormError(problems.join(" "));
      return;
    }
    setFormError(null);
    setSaving(true);
    const ourOverride = ourOrderedSlots.length > 0 ? ourOrderedSlots : null;
    await onSave(
      {
        date,
        home_team,
        away_team,
        our_side,
        game_time: game_time.trim() || null,
        final_score_home: isEditing && game ? game.final_score_home : null,
        final_score_away: isEditing && game ? game.final_score_away : null,
        our_sp_plan_notes: isEditing && game ? game.our_sp_plan_notes ?? null : null,
        winning_pitcher_id: isEditing && game ? game.winning_pitcher_id ?? null : null,
        losing_pitcher_id: isEditing && game ? game.losing_pitcher_id ?? null : null,
        starting_pitcher_home_id:
          our_side === "home" ? spOur || null : spOpp || null,
        starting_pitcher_away_id:
          our_side === "home" ? spOpp || null : spOur || null,
        save_pitcher_id: savePitcherOur.trim() ? savePitcherOur : null,
      },
      isEditing ? lineupId : (lineupId || null),
      isEditing
        ? opponentOrderedSlots
        : opponentOrderedSlots.length > 0
          ? opponentOrderedSlots
          : null,
      ourOverride
    );
    setSaving(false);
  };

  if (!canEdit) return null;

  const fieldLabel = "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]";
  const sectionKicker = "text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]";
  const lineupColumnShell =
    "space-y-2 rounded-lg border border-[var(--border)]/70 bg-[var(--bg-elevated)]/20 p-3";
  const bothTeamsNamed =
    matchupGame.home_team.trim().length > 0 && matchupGame.away_team.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="card-tech overflow-hidden p-0">
      <header className="border-b border-[var(--border)]/80 bg-[var(--bg-elevated)]/15 px-4 py-2.5 sm:px-4">
        <h3 className="font-orbitron text-sm font-semibold uppercase tracking-wide text-white sm:text-base">
          {isEditing ? "Edit game" : "Add game"}
        </h3>
      </header>

      <div className="space-y-4 px-4 py-3 sm:py-4">
        {formError ? (
          <p
            className="rounded-md border border-[var(--danger)] bg-[var(--danger-dim)] px-3 py-2 text-sm text-[var(--danger)]"
            role="alert"
          >
            {formError}
          </p>
        ) : null}

        {/* When */}
        <section aria-labelledby="game-form-when">
          <h4 id="game-form-when" className={`${sectionKicker} mb-2`}>
            When
          </h4>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="min-w-0">
              <span className={fieldLabel}>Date</span>
              <StyledDatePicker
                value={date}
                onChange={(v) => {
                  setFormError(null);
                  setDate(v);
                }}
                className="input-tech mt-1 block w-full px-3 py-2"
                required
              />
            </label>
            <label className="min-w-0">
              <span className={fieldLabel}>Time (optional)</span>
              <input
                type="time"
                value={game_time}
                onChange={(e) => setGameTime(e.target.value)}
                className="input-tech mt-1 block w-full px-3 py-2"
              />
            </label>
          </div>
        </section>

        {/* Matchup */}
        <section aria-labelledby="game-form-matchup">
          <h4 id="game-form-matchup" className={`${sectionKicker} mb-2`}>
            Matchup
          </h4>
          <div className="space-y-3">
            <div className="w-full min-w-0">
              <span className={`${fieldLabel} text-[var(--text)]`}>We are the</span>
              <div className="mt-1 flex w-full min-w-0 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setOurSide("home");
                  }}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    our_side === "home"
                      ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                      : "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text)]"
                  }`}
                >
                  Home team
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setOurSide("away");
                  }}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    our_side === "away"
                      ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                      : "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text)]"
                  }`}
                >
                  Away team
                </button>
              </div>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="min-w-0">
                <span className={fieldLabel}>Our club</span>
                <input
                  type="text"
                  value={our_team}
                  onChange={(e) => {
                    setFormError(null);
                    setOurTeam(e.target.value);
                  }}
                  className="input-tech mt-1 block w-full px-3 py-2"
                  placeholder={defaultClubTeamName.trim() ? defaultClubTeamName.trim() : "Your club name"}
                  autoComplete="organization"
                  aria-required="true"
                />
              </label>
              <div className="min-w-0">
                <span className={fieldLabel}>Opponent</span>
                {useOpponentSelect && !opponentUseCustom ? (
                  <>
                    <select
                      value={opponent}
                      onChange={(e) => {
                        setFormError(null);
                        const v = e.target.value;
                        if (v === OPP_CUSTOM_SENTINEL) {
                          setOpponentUseCustom(true);
                          setOpponent("");
                        } else {
                          setOpponent(v);
                        }
                      }}
                      className="input-tech mt-1 block w-full px-3 py-2"
                      aria-label="Other team name"
                      aria-required="true"
                    >
                      <option value="">Select team…</option>
                      {trackedSorted.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                      <option value={OPP_CUSTOM_SENTINEL}>Other / not listed…</option>
                    </select>
                  </>
                ) : useOpponentSelect && opponentUseCustom ? (
                  <>
                    <input
                      id="game-form-opponent-custom"
                      type="text"
                      value={opponent}
                      onChange={(e) => {
                        setFormError(null);
                        setOpponent(e.target.value);
                      }}
                      className="input-tech mt-1 block w-full px-3 py-2"
                      placeholder="Opponent team name"
                      aria-label="Other team name"
                      aria-required="true"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="mt-1.5 text-[11px] font-medium text-[var(--accent)] hover:underline"
                      onClick={() => {
                        setFormError(null);
                        setOpponentUseCustom(false);
                        setOpponent("");
                      }}
                    >
                      Choose from tracked opponents instead
                    </button>
                  </>
                ) : (
                  <input
                    type="text"
                    value={opponent}
                    onChange={(e) => {
                      setFormError(null);
                      setOpponent(e.target.value);
                    }}
                    className="input-tech mt-1 block w-full px-3 py-2"
                    placeholder="Opponent team name"
                    aria-label="Other team name"
                    aria-required="true"
                  />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Starting pitchers */}
        <section aria-labelledby="game-form-sp-heading">
          <h4 id="game-form-sp-heading" className={`${sectionKicker} mb-2`}>
            Starting pitchers
          </h4>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="min-w-0" htmlFor="game-form-sp-our">
              <span className={fieldLabel}>
                Our club{our_team.trim() ? ` (${our_team.trim()})` : ""}
              </span>
              <select
                id="game-form-sp-our"
                value={spOur}
                onChange={(e) => setSpOur(e.target.value)}
                className="input-tech mt-1 block w-full px-3 py-2 disabled:cursor-not-allowed disabled:opacity-45"
                aria-label="Starting pitcher, our club"
                disabled={!bothTeamsNamed}
              >
                <option value="">—</option>
                {ourPitchers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.jersey ? ` #${p.jersey}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0" htmlFor="game-form-sp-opp">
              <span className={fieldLabel}>
                Opponent{opponent.trim() ? ` (${opponent.trim()})` : ""}
              </span>
              <select
                id="game-form-sp-opp"
                value={spOpp}
                onChange={(e) => setSpOpp(e.target.value)}
                className="input-tech mt-1 block w-full px-3 py-2 disabled:cursor-not-allowed disabled:opacity-45"
                aria-label="Starting pitcher, opponent"
                disabled={!bothTeamsNamed}
              >
                <option value="">—</option>
                {oppPitchers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.jersey ? ` #${p.jersey}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-3 block min-w-0" htmlFor="game-form-save-pitcher">
            <span className={fieldLabel}>Save pitcher (our club)</span>
            <select
              id="game-form-save-pitcher"
              value={savePitcherOur}
              onChange={(e) => setSavePitcherOur(e.target.value)}
              className="input-tech mt-1 block w-full px-3 py-2 disabled:cursor-not-allowed disabled:opacity-45"
              aria-label="Save pitcher, our club"
              disabled={!bothTeamsNamed}
            >
              <option value="">—</option>
              {ourPitchers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.jersey ? ` #${p.jersey}` : ""}
                </option>
              ))}
            </select>
          </label>
        </section>

        {/* Lineups */}
        <section aria-labelledby="game-form-lineup-heading">
          <h4 id="game-form-lineup-heading" className={`${sectionKicker} mb-2`}>
            Lineups
          </h4>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div className={lineupColumnShell}>
              <span className={`${fieldLabel} text-[var(--text)]`}>Our club</span>
              <button
                type="button"
                onClick={() => void openOurLineupModal()}
                disabled={ourModalOpening}
                className="w-full rounded-lg border border-[var(--accent)]/50 bg-[var(--bg-elevated)] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:border-[var(--accent)] hover:bg-[var(--bg-card)] disabled:opacity-60"
              >
                {ourModalOpening
                  ? "Opening…"
                  : `Preview / edit ${our_team.trim() || "club"} lineup`}
              </button>
              {ourOrderedSlots.length > 0 ? (
                <span className="block text-sm text-[var(--text-muted)]">{ourOrderedSlots.length} in lineup</span>
              ) : null}
              <label className="block min-w-0" htmlFor="game-form-lineup-template">
                <span className={fieldLabel}>Our lineup template (optional)</span>
                <select
                  id="game-form-lineup-template"
                  value={lineupId}
                  onChange={(e) => setLineupId(e.target.value)}
                  className="input-tech mt-1 min-w-0 max-w-full px-3 py-2"
                  aria-label="Our lineup template"
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
              </label>
            </div>

            <div className={lineupColumnShell}>
              <span className={`${fieldLabel} text-[var(--text)]`}>Opponent</span>
              <button
                type="button"
                onClick={() => setOpponentModalOpen(true)}
                disabled={!bothTeamsNamed}
                className="w-full rounded-lg border border-[var(--accent)]/50 bg-[var(--bg-elevated)] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:border-[var(--accent)] hover:bg-[var(--bg-card)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Preview / edit {opponent.trim() || "opponent"} lineup
              </button>
              {opponentOrderedSlots.length > 0 ? (
                <span className="block text-sm text-[var(--text-muted)]">
                  {opponentOrderedSlots.length} in lineup
                </span>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 z-10 mt-1 flex flex-col gap-3 border-t border-[var(--border)]/70 bg-[var(--bg-base)]/92 px-4 py-3 backdrop-blur-sm sm:flex-row sm:flex-wrap sm:items-center supports-[backdrop-filter]:bg-[var(--bg-base)]/80">
        <button
          type="submit"
          disabled={saving}
          className="font-orbitron order-1 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold tracking-wide text-[var(--bg-base)] shadow-[0_0_16px_rgba(214,186,72,0.12)] transition hover:opacity-95 disabled:opacity-50 sm:order-none sm:w-auto"
        >
          {saving ? "Saving…" : isEditing ? "Update game" : "Add game"}
        </button>
        {isEditing && (
          <>
            <button
              type="button"
              onClick={onCancel}
              className="order-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] sm:order-none"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onAddNew}
              className="order-3 text-sm text-[var(--text-muted)] hover:text-[var(--text)] sm:order-none"
            >
              Add new instead
            </button>
            <button
              type="button"
              onClick={() => {
                if (!game) return;
                setDeleteGameConfirmOpen(true);
              }}
              disabled={deleting}
              className="order-4 rounded-lg border border-[var(--danger)] px-4 py-2 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger-dim)] disabled:opacity-50 sm:order-none sm:ml-auto"
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
        players={activePlayers}
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
        players={activePlayers}
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
