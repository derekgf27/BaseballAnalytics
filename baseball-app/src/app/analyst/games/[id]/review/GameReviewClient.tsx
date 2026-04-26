"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useReactToPrint } from "react-to-print";
import { deleteGameAction } from "@/app/analyst/games/actions";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { BoxScore } from "@/components/analyst/BoxScore";
import { BattingPitchMixCard } from "@/components/analyst/BattingPitchMixCard";
import { plateAppearancesForPitchingSide } from "@/lib/compute/gamePitchingBox";
import { GameBattingTable, GameBatterPitchDetailStack } from "@/components/analyst/GameBattingTable";
import { GamePitchingBoxTable } from "@/components/analyst/GamePitchingBoxTable";
import { isDemoId } from "@/lib/db/mockData";
import { formatDateMMDDYYYY } from "@/lib/format";
import { analystGameLogHref, analystRecordHref } from "@/lib/analystRoutes";
import { isGameFinalized } from "@/lib/gameRecord";
import { matchupLabelUsFirst } from "@/lib/opponentUtils";
import { sanitizeGameReviewPdfFilename } from "@/lib/gameReviewPdfInsights";
import type { Game, PitchEvent, PlateAppearance, Player } from "@/lib/types";

const PDF_PREFS_KEY = "gameReviewPdf.v1";

const coachNotesStorageKey = (gameId: string) => `gameReviewCoachNotes.v1:${gameId}`;

const COACH_NOTES_MAX_LEN = 6000;

const GAME_REVIEW_PRINT_PAGE_STYLE = `
  @page { size: auto; margin: 10mm 10mm 16mm 10mm; }
  body {
    background: #ffffff !important;
    color: #0f172a !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
`;

export type GameReviewPdfExportMode = "full" | "onepager";

function TeamReviewPdfBlock({
  game,
  side,
  pasAll,
  pasAway,
  pasHome,
  players,
  awayLineupOrder,
  homeLineupOrder,
  awayLineupPositionByPlayerId,
  homeLineupPositionByPlayerId,
  baserunningByPlayerId,
  pitchEvents,
  className = "",
  pdfLayout = "full",
  onePagerNotes = "",
}: {
  game: Game;
  side: "away" | "home";
  pasAll: PlateAppearance[];
  pasAway: PlateAppearance[];
  pasHome: PlateAppearance[];
  players: Player[];
  awayLineupOrder?: string[];
  homeLineupOrder?: string[];
  awayLineupPositionByPlayerId?: Record<string, string>;
  homeLineupPositionByPlayerId?: Record<string, string>;
  baserunningByPlayerId?: Record<string, { sb: number; cs: number }>;
  pitchEvents: PitchEvent[];
  className?: string;
  /** `batting-only`: coach one-pager (batting + pitching lines; no pitch-mix card). */
  pdfLayout?: "full" | "batting-only";
  /** Free-form notes from the Review page; printed on the one-pager when non-empty. */
  onePagerNotes?: string;
}) {
  const teamName = side === "away" ? game.away_team : game.home_team;
  const pasBat = side === "away" ? pasAway : pasHome;
  const lineupOrder = side === "away" ? awayLineupOrder : homeLineupOrder;
  const lineupPos = side === "away" ? awayLineupPositionByPlayerId : homeLineupPositionByPlayerId;

  return (
    <div className={`game-review-pdf-team-section space-y-3 ${className}`.trim()}>
      <h2 className="game-review-pdf-team-heading font-display text-sm font-semibold uppercase tracking-wider text-[var(--text)]">
        {teamName}
      </h2>
      {/* PDF: single column — batters, then pitchers, then mound pitch data (no side-by-side) */}
      <div className="game-review-pdf-team-stack">
        <div className="game-review-pdf-subsection min-w-0">
          <GameBattingTable
            game={game}
            teamName={teamName}
            pas={pasBat}
            players={players}
            lineupOrder={lineupOrder}
            lineupPositionByPlayerId={lineupPos}
            baserunningByPlayerId={baserunningByPlayerId}
            showPitchData={false}
            compact
            linkPlayersToProfile={false}
          />
        </div>
        {pdfLayout === "batting-only" ? (
          <>
            <div className="game-review-pdf-subsection game-review-pdf-break-before-pitching min-w-0">
              <GamePitchingBoxTable
                game={game}
                side={side}
                pas={pasAll}
                players={players}
                compact
                linkPlayersToProfile={false}
              />
            </div>
            {onePagerNotes.trim() ? (
              <div className="game-review-pdf-onepager-notes mt-3">
                <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text)]">
                  Coach notes
                </h3>
                <div className="game-review-pdf-onepager-notes-body mt-2 text-sm text-[var(--text)]">
                  {onePagerNotes}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
        {pdfLayout === "full" ? (
          <>
            <div className="game-review-pdf-subsection game-review-pdf-break-before-pitching min-w-0">
              <GamePitchingBoxTable
                game={game}
                side={side}
                pas={pasAll}
                players={players}
                compact
                linkPlayersToProfile={false}
              />
            </div>
            <div className="game-review-pdf-subsection game-review-pdf-break-before-pitch-mix min-w-0">
              <BattingPitchMixCard
                pas={plateAppearancesForPitchingSide(pasAll, side)}
                players={players}
                pitchEvents={pitchEvents}
                compact
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

interface GameReviewClientProps {
  game: Game;
  /** When false, hide destructive actions (same as Games list). */
  canEdit?: boolean;
  /** Full game PAs (for linescore). */
  pasAll: PlateAppearance[];
  pasAway: PlateAppearance[];
  pasHome: PlateAppearance[];
  players: Player[];
  awayLineupOrder?: string[];
  homeLineupOrder?: string[];
  awayLineupPositionByPlayerId?: Record<string, string>;
  homeLineupPositionByPlayerId?: Record<string, string>;
  baserunningByPlayerId?: Record<string, { sb: number; cs: number }>;
  pitchEvents?: PitchEvent[];
}

export function GameReviewClient({
  game,
  canEdit = false,
  pasAll,
  pasAway,
  pasHome,
  players,
  awayLineupOrder,
  homeLineupOrder,
  awayLineupPositionByPlayerId,
  homeLineupPositionByPlayerId,
  baserunningByPlayerId,
  pitchEvents = [],
}: GameReviewClientProps) {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);
  const gameLabel = `${formatDateMMDDYYYY(game.date)} ${matchupLabelUsFirst(game, true)}`;
  const [teamView, setTeamView] = useState<"away" | "home">("away");
  const showingAway = teamView === "away";
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  /** PDF: detailed stats for opponent after your club (linescore always shows both). Ignored for one-pager. */
  const [includeOpponentInPdf, setIncludeOpponentInPdf] = useState(true);
  const [pdfExportMode, setPdfExportMode] = useState<GameReviewPdfExportMode>("full");
  const [pdfPrefsHydrated, setPdfPrefsHydrated] = useState(false);
  const [printFooterStamp, setPrintFooterStamp] = useState("");
  const [coachOnePagerNotes, setCoachOnePagerNotes] = useState("");
  const [notesPanelOpen, setNotesPanelOpen] = useState(false);
  const skipNextCoachNotesPersist = useRef(false);

  const ourSide = game.our_side;
  const opponentSide: "away" | "home" = ourSide === "away" ? "home" : "away";

  useEffect(() => {
    skipNextCoachNotesPersist.current = true;
    setNotesPanelOpen(false);
    try {
      setCoachOnePagerNotes(localStorage.getItem(coachNotesStorageKey(game.id)) ?? "");
    } catch {
      setCoachOnePagerNotes("");
    }
  }, [game.id]);

  useEffect(() => {
    if (skipNextCoachNotesPersist.current) {
      skipNextCoachNotesPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(coachNotesStorageKey(game.id), coachOnePagerNotes);
    } catch {
      /* ignore */
    }
  }, [game.id, coachOnePagerNotes]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PDF_PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as {
          exportMode?: string;
          includeOpponent?: boolean;
        };
        if (p.exportMode === "onepager" || p.exportMode === "full") {
          setPdfExportMode(p.exportMode);
        }
        if (typeof p.includeOpponent === "boolean") {
          setIncludeOpponentInPdf(p.includeOpponent);
        }
      }
    } catch {
      /* ignore */
    }
    setPdfPrefsHydrated(true);
  }, []);

  useEffect(() => {
    if (!pdfPrefsHydrated) return;
    try {
      localStorage.setItem(
        PDF_PREFS_KEY,
        JSON.stringify({
          exportMode: pdfExportMode,
          includeOpponent: includeOpponentInPdf,
        })
      );
    } catch {
      /* ignore */
    }
  }, [pdfExportMode, includeOpponentInPdf, pdfPrefsHydrated]);

  const documentTitle = useCallback((): string => {
    const base = sanitizeGameReviewPdfFilename(game);
    const suffix = pdfExportMode === "onepager" ? "-one-pager" : includeOpponentInPdf ? "-full" : "-club-only";
    return `${base}${suffix}`;
  }, [game, pdfExportMode, includeOpponentInPdf]);

  const triggerPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle,
    pageStyle: GAME_REVIEW_PRINT_PAGE_STYLE,
  });

  const runExportPdf = useCallback(() => {
    setPrintFooterStamp(
      new Date().toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    );
    window.setTimeout(() => {
      void triggerPrint();
    }, 0);
  }, [triggerPrint]);

  const showDelete = canEdit && !isDemoId(game.id);
  const logHref = analystGameLogHref(game.id);
  const recordHref = analystRecordHref(game.id);
  const finalized = isGameFinalized(game);
  const crumbClass =
    "font-medium text-[var(--accent)] transition hover:underline";
  const crumbMuted = "text-[var(--text-faint)] select-none";

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">
            Review
          </h1>
          <p className="text-sm text-[var(--text-muted)]">{gameLabel}</p>
          <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm" aria-label="Game steps">
            <Link href={logHref} className={crumbClass}>
              Log
            </Link>
            {!finalized ? (
              <>
                <span className={crumbMuted} aria-hidden>
                  /
                </span>
                <Link href={recordHref} className={crumbClass}>
                  Record
                </Link>
              </>
            ) : null}
            <span className={crumbMuted} aria-hidden>
              /
            </span>
            <span className="font-medium text-[var(--text)]" aria-current="page">
              Review
            </span>
          </nav>
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {pasAll.length > 0 ? (
            <>
              <label className="game-review-screen-only flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                PDF type
                <select
                  value={pdfExportMode}
                  onChange={(e) =>
                    setPdfExportMode(e.target.value as GameReviewPdfExportMode)
                  }
                  className="min-h-[40px] rounded-lg border-2 border-[var(--border)] bg-[var(--bg-input)] px-2 py-1.5 text-sm font-normal normal-case text-[var(--text)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25"
                >
                  <option value="full">Full box score</option>
                  <option value="onepager">Coach one-pager (club batting, pitching, notes)</option>
                </select>
              </label>
              <label
                className={`game-review-screen-only flex cursor-pointer items-center gap-2 text-sm text-[var(--text-muted)] select-none ${pdfExportMode === "onepager" ? "pointer-events-none opacity-45" : ""}`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[var(--border)] bg-[var(--bg-input)] text-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30"
                  checked={includeOpponentInPdf}
                  disabled={pdfExportMode === "onepager"}
                  onChange={(e) => setIncludeOpponentInPdf(e.target.checked)}
                />
                Include opponent (full PDF only)
              </label>
              <button
                type="button"
                onClick={runExportPdf}
                className="font-display inline-flex items-center rounded-lg border-2 border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm font-semibold tracking-wide text-[var(--text)] transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)]"
              >
                Export PDF
              </button>
            </>
          ) : null}
          {showDelete ? (
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setDeleteConfirmOpen(true);
              }}
              className="inline-flex items-center rounded-lg border border-[var(--danger)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--danger)] transition hover:bg-[var(--danger-dim)]"
            >
              Delete game
            </button>
          ) : null}
        </div>
      </header>

      {deleteError && (
        <div
          className="rounded-lg border p-3 text-sm text-[var(--danger)]"
          style={{ background: "var(--danger-dim)", borderColor: "var(--border)" }}
          role="alert"
        >
          {deleteError}
        </div>
      )}

      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onClose={() => !deleting && setDeleteConfirmOpen(false)}
        title="Delete this game?"
        description={`${formatDateMMDDYYYY(game.date)} — ${matchupLabelUsFirst(game, true)}. This removes the game and related data. This cannot be undone.`}
        confirmLabel="Delete game"
        pendingLabel="Deleting…"
        pending={deleting}
        onConfirm={async () => {
          setDeleting(true);
          setDeleteError(null);
          try {
            const ok = await deleteGameAction(game.id);
            if (ok) {
              setDeleteConfirmOpen(false);
              router.push("/analyst/games");
              router.refresh();
            } else {
              setDeleteError("Could not delete game.");
            }
          } finally {
            setDeleting(false);
          }
        }}
      />

      {pasAll.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-card)] px-4 py-6 text-center">
          <p className="font-medium text-[var(--text)]">No plate appearances yet</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {finalized
              ? "This game is finalized with no PAs logged. Open Log if you need to add corrections elsewhere."
              : "Nothing to show in the box score until PAs are saved on Record."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {!finalized ? (
              <Link
                href={recordHref}
                className="font-display rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] transition hover:opacity-90"
              >
                Record
              </Link>
            ) : (
              <Link
                href={logHref}
                className="font-display rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] transition hover:opacity-90"
              >
                Log
              </Link>
            )}
            <Link
              href="/analyst/games"
              className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:border-[var(--accent)]/50"
            >
              Pick a game
            </Link>
          </div>
        </div>
      ) : null}

      <div ref={printRef} className="game-review-print-area space-y-6">
        <div className="game-review-print-only game-review-pdf-doc-header break-inside-avoid border-b border-[var(--border)] pb-3">
          <h1 className="font-display text-xl font-semibold text-[var(--text)]">Game review</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{gameLabel}</p>
          <p className="mt-2 text-xs text-[var(--text-faint)]">
            {pdfExportMode === "onepager"
              ? "Coach one-pager — batting and pitching lines for the recording side; coach notes (from Review). Linescore shows both teams."
              : includeOpponentInPdf
                ? "Full report — both teams (batting, pitching, pitch data)."
                : "Full report — recording side only; linescore shows both teams."}
          </p>
        </div>

        <section className="game-review-pdf-linescore">
          <h2 className="font-display mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--text)]">
            Linescore
          </h2>
          <div className="box-score-print-wrap">
            <BoxScore game={game} pas={pasAll} />
          </div>
        </section>

        <section className="space-y-3">
          <div className="game-review-screen-only flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTeamView("away")}
              className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${
                showingAway
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)]"
                  : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:border-[var(--accent)]/50"
              }`}
            >
              {game.away_team}
            </button>
            <button
              type="button"
              onClick={() => setTeamView("home")}
              className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${
                !showingAway
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)]"
                  : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:border-[var(--accent)]/50"
              }`}
            >
              {game.home_team}
            </button>
          </div>

          <div className="game-review-screen-only grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-5">
            <div className="min-w-0">
              <GameBattingTable
                game={game}
                teamName={showingAway ? game.away_team : game.home_team}
                pas={showingAway ? pasAway : pasHome}
                players={players}
                lineupOrder={showingAway ? awayLineupOrder : homeLineupOrder}
                lineupPositionByPlayerId={
                  showingAway ? awayLineupPositionByPlayerId : homeLineupPositionByPlayerId
                }
                baserunningByPlayerId={baserunningByPlayerId}
                showPitchData={false}
              />
              <div className="mt-4 min-w-0">
                <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Batter pitch and PA detail
                </h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Same order as the table. Scroll to compare everyone without opening rows.
                </p>
                <div className="mt-2 overflow-x-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-2 sm:p-3">
                  <GameBatterPitchDetailStack
                    key={showingAway ? "away" : "home"}
                    pas={showingAway ? pasAway : pasHome}
                    players={players}
                    lineupOrder={showingAway ? awayLineupOrder : homeLineupOrder}
                    lineupPositionByPlayerId={
                      showingAway ? awayLineupPositionByPlayerId : homeLineupPositionByPlayerId
                    }
                    baserunningByPlayerId={baserunningByPlayerId}
                    pitchEvents={pitchEvents}
                  />
                </div>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <GamePitchingBoxTable
                game={game}
                side={showingAway ? "away" : "home"}
                pas={pasAll}
                players={players}
              />
              <BattingPitchMixCard
                pas={plateAppearancesForPitchingSide(pasAll, showingAway ? "away" : "home")}
                players={players}
                pitchEvents={pitchEvents}
              />
            </div>
          </div>

          <div className="game-review-print-only space-y-8">
            {pdfExportMode === "onepager" ? (
              <TeamReviewPdfBlock
                game={game}
                side={ourSide}
                pasAll={pasAll}
                pasAway={pasAway}
                pasHome={pasHome}
                players={players}
                awayLineupOrder={awayLineupOrder}
                homeLineupOrder={homeLineupOrder}
                awayLineupPositionByPlayerId={awayLineupPositionByPlayerId}
                homeLineupPositionByPlayerId={homeLineupPositionByPlayerId}
                baserunningByPlayerId={baserunningByPlayerId}
                pitchEvents={pitchEvents}
                pdfLayout="batting-only"
                onePagerNotes={coachOnePagerNotes}
              />
            ) : (
              <>
                <TeamReviewPdfBlock
                  game={game}
                  side={ourSide}
                  pasAll={pasAll}
                  pasAway={pasAway}
                  pasHome={pasHome}
                  players={players}
                  awayLineupOrder={awayLineupOrder}
                  homeLineupOrder={homeLineupOrder}
                  awayLineupPositionByPlayerId={awayLineupPositionByPlayerId}
                  homeLineupPositionByPlayerId={homeLineupPositionByPlayerId}
                  baserunningByPlayerId={baserunningByPlayerId}
                  pitchEvents={pitchEvents}
                  pdfLayout="full"
                />
                {includeOpponentInPdf ? (
                  <TeamReviewPdfBlock
                    game={game}
                    side={opponentSide}
                    pasAll={pasAll}
                    pasAway={pasAway}
                    pasHome={pasHome}
                    players={players}
                    awayLineupOrder={awayLineupOrder}
                    homeLineupOrder={homeLineupOrder}
                    awayLineupPositionByPlayerId={awayLineupPositionByPlayerId}
                    homeLineupPositionByPlayerId={homeLineupPositionByPlayerId}
                    baserunningByPlayerId={baserunningByPlayerId}
                    pitchEvents={pitchEvents}
                    pdfLayout="full"
                    className="game-review-print-team-break"
                  />
                ) : null}
              </>
            )}
          </div>
        </section>

        <div
          className="game-review-print-only game-review-pdf-fixed-footer"
          aria-hidden
        >
          {printFooterStamp
            ? `Exported ${printFooterStamp} · ${matchupLabelUsFirst(game, true)}`
            : matchupLabelUsFirst(game, true)}
        </div>
      </div>

      {pasAll.length > 0 ? (
        <section className="game-review-screen-only rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
          {!notesPanelOpen ? (
            <button
              type="button"
              onClick={() => setNotesPanelOpen(true)}
              className="font-display inline-flex items-center rounded-lg border-2 border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm font-semibold tracking-wide text-[var(--text)] transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)]"
            >
              {coachOnePagerNotes.trim() ? "Edit notes" : "Add notes"}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold text-[var(--text)]">Notes</h2>
                <button
                  type="button"
                  onClick={() => setNotesPanelOpen(false)}
                  className="text-xs font-medium text-[var(--text-muted)] underline-offset-2 transition hover:text-[var(--text)] hover:underline"
                >
                  Hide
                </button>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Saved in this browser. Shown on the coach one-pager PDF only.
              </p>
              <textarea
                value={coachOnePagerNotes}
                onChange={(e) =>
                  setCoachOnePagerNotes(e.target.value.slice(0, COACH_NOTES_MAX_LEN))
                }
                rows={5}
                maxLength={COACH_NOTES_MAX_LEN}
                placeholder="Talking points for coaches, lineup notes, pitch plan…"
                className="w-full resize-y rounded-lg border-2 border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25"
                aria-label="Notes for coach one-pager"
              />
              <p className="text-right text-xs text-[var(--text-faint)] tabular-nums">
                {coachOnePagerNotes.length}/{COACH_NOTES_MAX_LEN}
              </p>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
