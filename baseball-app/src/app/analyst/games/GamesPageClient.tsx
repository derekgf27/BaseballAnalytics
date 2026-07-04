"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isDemoId } from "@/lib/db/mockData";
import { dataEditBlockedMessage } from "@/lib/demoMode";
import {
  createGameWithLineupAction,
  updateGameOnlyAction,
  deleteGameAction,
  fetchGameLineupSlots,
  fetchOpponentGameLineupSlots,
  replaceOurGameLineupAction,
  replaceOpponentGameLineupAction,
  fetchLineupSlotsForBallparkSideAction,
} from "./actions";
import { isGameFinalized, ourTeamOutcomeFromFinalScore } from "@/lib/gameRecord";
import { isActiveRosterPlayer, matchupLabelUsFirst, pitchersForGameTeamSide } from "@/lib/opponentUtils";
import { formatDateMMDDYYYY } from "@/lib/format";
import { StyledDatePicker } from "@/components/shared/StyledDatePicker";
import { FlashMessage } from "@/components/shared/FlashMessage";
import { useFlashMessage } from "@/hooks/useFlashMessage";
import type { Game, Player } from "@/lib/types";
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
  initialPlayers: Player[];
  /** Opponent names from scheduled games + Analyst → Opponents. */
  initialOpponentNames: string[];
  canEdit: boolean;
}

export function GamesPageClient({
  initialGames,
  initialPlayers,
  initialOpponentNames,
  canEdit,
}: GamesPageClientProps) {
  const router = useRouter();
  const [games, setGames] = useState(initialGames);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const { message, dismissing: messageDismissing, show: showFlash } = useFlashMessage();

  const isFormOpen = editingGame !== null || showAddForm;

  const closeGameForm = () => {
    setShowAddForm(false);
    setEditingGame(null);
  };

  const defaultClubTeamName = useMemo(() => defaultClubTeamNameFromGames(games), [games]);

  const refresh = () => router.refresh();

  useEffect(() => {
    setGames(initialGames);
  }, [initialGames]);

  useEffect(() => {
    if (!isFormOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeGameForm();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFormOpen]);

  const handleSaveGame = async (
    game: Omit<Game, "id" | "created_at">,
    opponentSlots?: { player_id: string; position?: string | null }[] | null,
    ourSlotsOverride?: { player_id: string; position?: string | null }[] | null
  ) => {
    if (!canEdit) {
      showFlash({ type: "err", text: "Connect Supabase to add or edit games." });
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
        showFlash({
          type: "ok",
          text: "Game updated.",
        });
        refresh();
      } else {
        showFlash({ type: "err", text: "Could not update game." });
      }
    } else {
      try {
        const created = await createGameWithLineupAction(
          game,
          null,
          opponentSlots && opponentSlots.length > 0 ? opponentSlots : null,
          ourCustom
        );
        setGames((prev) => [created, ...prev]);
        setEditingGame(null);
        setShowAddForm(false);
        const hasOpp = opponentSlots && opponentSlots.length > 0;
        const hasOur = !!ourCustom;
        showFlash({
          type: "ok",
          text: hasOpp && hasOur
            ? "Game added with both lineups."
            : hasOpp
              ? "Game added with opponent lineup."
              : hasOur
                ? "Game added with club lineup."
                : "Game added.",
        });
        refresh();
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        const rlsHint =
          /row-level security|rls policy/i.test(raw) || /permission denied/i.test(raw)
            ? " Use the app Log in so your session is authenticated — many Supabase setups only allow writes for signed-in users."
            : "";
        const prodDigestHint =
          /Server Components render|digest/i.test(raw)
            ? " If you deploy without running the latest Supabase migrations, apply files under baseball-app/supabase/migrations/ (especially games columns for save / win / loss pitcher). "
            : "";
        showFlash({
          type: "err",
          text: `Could not add game: ${raw}.${prodDigestHint}${rlsHint}`,
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
            className="font-orbitron rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] transition hover:opacity-90"
          >
            Add game
          </button>
        )}
      </div>

      {!canEdit && (
        <div className="rounded-lg border border-[var(--border)] p-4 text-[var(--text-muted)]" style={{ background: "var(--warning-dim)" }}>
          {dataEditBlockedMessage("Connect Supabase to add or edit games.")}
        </div>
      )}

      <FlashMessage message={message} dismissing={messageDismissing} />

      {canEdit && isFormOpen && (
        <div
          className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-[2px] sm:p-6"
          onClick={closeGameForm}
          role="dialog"
          aria-modal="true"
          aria-labelledby={editingGame ? "game-edit-title" : "game-add-title"}
        >
          <div
            className="flex max-h-[min(90vh,100%)] w-[min(100%,72rem)] max-w-6xl flex-col overflow-hidden rounded-xl shadow-2xl ring-1 ring-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <GameForm
              key={editingGame?.id ?? "new-game"}
              game={editingGame && isGameFinalized(editingGame) ? null : editingGame}
              players={initialPlayers}
              opponentNames={initialOpponentNames}
              onSave={handleSaveGame}
              onCancel={closeGameForm}
              onAddNew={() => {
                setEditingGame(null);
                setShowAddForm(true);
              }}
              onDelete={async (gameId) => {
                const ok = await deleteGameAction(gameId);
                if (ok) {
                  setGames((prev) => prev.filter((g) => g.id !== gameId));
                  closeGameForm();
                  showFlash({ type: "deleted", text: "Game deleted." });
                  refresh();
                } else {
                  showFlash({ type: "err", text: "Could not delete game." });
                }
              }}
              defaultClubTeamName={defaultClubTeamName}
              canEdit={canEdit}
              titleId={editingGame ? "game-edit-title" : "game-add-title"}
            />
          </div>
        </div>
      )}

      {games.length === 0 ? (
        <div className="card-tech rounded-lg border-dashed p-8 text-center">
          <span className="text-4xl opacity-60">📅</span>
          <h2 className="font-display mt-4 font-semibold text-[var(--text)]">No games yet</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {canEdit ? "Use Add game to schedule your first game." : "Connect Supabase to add games."}
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
  players,
  opponentNames,
  onSave,
  onCancel,
  onAddNew,
  onDelete,
  defaultClubTeamName,
  canEdit,
  titleId = "game-form-title",
}: {
  game: Game | null;
  players: Player[];
  opponentNames: string[];
  onSave: (
    g: Omit<Game, "id" | "created_at">,
    opponentSlots?: { player_id: string; position?: string | null }[] | null,
    ourSlotsOverride?: { player_id: string; position?: string | null }[] | null
  ) => Promise<void>;
  onCancel: () => void;
  onAddNew: () => void;
  onDelete: (gameId: string) => Promise<void>;
  /** Pre-filled club name for new games (env or latest game). */
  defaultClubTeamName: string;
  canEdit: boolean;
  titleId?: string;
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
    } else {
      setSpOur("");
      setSpOpp("");
    }
  }, [
    game?.id,
    game?.our_side,
    game?.starting_pitcher_home_id,
    game?.starting_pitcher_away_id,
  ]);

  useEffect(() => {
    if (!game?.id) return;
    setOurSide(game.our_side);
    setOurTeam(game.our_side === "home" ? game.home_team : game.away_team);
    setOpponent(game.our_side === "home" ? game.away_team : game.home_team);
  }, [game?.id, game?.our_side, game?.home_team, game?.away_team]);

  useEffect(() => {
    if (!game?.id) {
      setOurOrderedSlots([]);
      return;
    }
    let cancelled = false;
    fetchGameLineupSlots(game.id).then((rows) => {
      if (cancelled) return;
      setOurOrderedSlots(
        rows.map((s) => ({ player_id: s.player_id, position: s.position ?? null }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [game?.id]);

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

  const opponentOptions = useMemo(
    () => [...opponentNames].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    [opponentNames]
  );
  const activePlayers = useMemo(() => players.filter(isActiveRosterPlayer), [players]);
  const trimmedOpp = opponent.trim();
  const isInOpponentList = opponentOptions.some(
    (name) => name.localeCompare(trimmedOpp, undefined, { sensitivity: "base" }) === 0
  );
  /** Dropdown when we have known opponents; legacy edits with unlisted names keep a text field. */
  const useOpponentSelect = opponentOptions.length > 0 && (!isEditing || isInOpponentList);

  async function buildOurLineupPreview(): Promise<{
    ordered: { player_id: string; position: string | null }[];
    title: string;
  }> {
    if (game?.id) {
      const slots = await fetchGameLineupSlots(game.id);
      return {
        ordered: slots.map((s) => ({ player_id: s.player_id, position: s.position ?? null })),
        title: "Lineup",
      };
    }
    return { ordered: [], title: "Lineup" };
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
        game_time: null,
        final_score_home: isEditing && game ? game.final_score_home : null,
        final_score_away: isEditing && game ? game.final_score_away : null,
        our_sp_plan_notes: isEditing && game ? game.our_sp_plan_notes ?? null : null,
        winning_pitcher_id: isEditing && game ? game.winning_pitcher_id ?? null : null,
        losing_pitcher_id: isEditing && game ? game.losing_pitcher_id ?? null : null,
        starting_pitcher_home_id:
          our_side === "home" ? spOur || null : spOpp || null,
        starting_pitcher_away_id:
          our_side === "home" ? spOpp || null : spOur || null,
        save_pitcher_id: isEditing && game ? game.save_pitcher_id ?? null : null,
      },
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
  const lineupCard =
    "flex h-full flex-col gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--bg-elevated)]/20 p-3";
  const lineupActionBtn =
    "mt-auto w-full rounded-lg border border-[var(--accent)]/40 bg-transparent px-3 py-2 text-sm font-semibold text-[var(--accent)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-dim)] disabled:cursor-not-allowed disabled:opacity-45";
  const bothTeamsNamed =
    matchupGame.home_team.trim().length > 0 && matchupGame.away_team.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="card-tech flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <header className="shrink-0 border-b border-[var(--border)]/80 bg-[var(--bg-elevated)]/15 px-6 py-4 sm:px-8">
        <h3
          id={titleId}
          className="font-orbitron text-lg font-semibold uppercase tracking-wide text-white sm:text-xl"
        >
          {isEditing ? "Edit game" : "Add game"}
        </h3>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8 sm:py-6">
        {formError ? (
          <p
            className="mb-4 rounded-md border border-[var(--danger)] bg-[var(--danger-dim)] px-3 py-2 text-sm text-[var(--danger)]"
            role="alert"
          >
            {formError}
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2 lg:gap-x-10">
        <div className="space-y-4">
        {/* When */}
        <section aria-labelledby="game-form-when">
          <h4 id="game-form-when" className={`${sectionKicker} mb-2`}>
            When
          </h4>
          <div className="grid gap-2.5">
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
                      {opponentOptions.map((name) => (
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
                      Choose from opponent list instead
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
        </div>

        <div className="space-y-4">
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
        </section>

        {/* Lineups */}
        <section aria-labelledby="game-form-lineup-heading">
          <h4 id="game-form-lineup-heading" className={`${sectionKicker} mb-2`}>
            Lineups
          </h4>
          <div className="grid items-stretch gap-3 lg:grid-cols-2">
            <div className={lineupCard}>
              <div className="min-w-0">
                <p className={fieldLabel}>Our club</p>
                <p className="truncate text-sm font-semibold text-white">
                  {our_team.trim() || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void openOurLineupModal()}
                disabled={ourModalOpening}
                className={lineupActionBtn}
                aria-label={`Edit ${our_team.trim() || "club"} lineup`}
              >
                {ourModalOpening ? "Opening…" : "Edit lineup"}
              </button>
            </div>

            <div className={lineupCard}>
              <div className="min-w-0">
                <p className={fieldLabel}>Opponent</p>
                <p className="truncate text-sm font-semibold text-white">
                  {opponent.trim() || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpponentModalOpen(true)}
                disabled={!bothTeamsNamed}
                className={lineupActionBtn}
                aria-label={`Edit ${opponent.trim() || "opponent"} lineup`}
              >
                Edit lineup
              </button>
            </div>
          </div>
        </section>
        </div>
        </div>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--border)]/80 bg-[var(--bg-elevated)]/10 px-6 py-4 sm:px-8 sm:py-5">
        {isEditing ? (
          <button
            type="button"
            onClick={() => {
              if (!game) return;
              setDeleteGameConfirmOpen(true);
            }}
            disabled={deleting}
            className="rounded-lg border border-[var(--danger)] px-4 py-2.5 text-sm font-medium text-[var(--danger)] transition hover:bg-[var(--danger-dim)] disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete game"}
          </button>
        ) : (
          <span />
        )}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="font-orbitron rounded-lg bg-[var(--accent)] px-6 py-2.5 text-base font-semibold tracking-wide text-[var(--accent-fg)] shadow-[var(--shadow-accent-sm)] transition hover:opacity-95 disabled:opacity-50"
          >
            {saving ? "Saving…" : isEditing ? "Update game" : "Add game"}
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
        </div>
      </footer>

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
