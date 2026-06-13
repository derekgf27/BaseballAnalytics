"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { deleteGameAction } from "@/app/analyst/games/actions";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { BoxScore } from "@/components/analyst/BoxScore";
import { computeGameBatting } from "@/components/analyst/GameBattingTable";
import type { PitcherOfficialTotals } from "@/lib/db/queries";
import { isDemoId } from "@/lib/db/mockData";
import { formatDateMMDDYYYY } from "@/lib/format";
import { analystGameLogHref, analystRecordHref } from "@/lib/analystRoutes";
import { isGameFinalized } from "@/lib/gameRecord";
import { matchupLabelUsFirst } from "@/lib/opponentUtils";
import { downloadClassicBoxScorePdf } from "@/lib/reports/boxScorePdf";
import { downloadGameReviewDetailedPdf } from "@/lib/reports/gameReviewDetailedPdf";
import type { PdfExportProgress } from "@/lib/reports/htmlElementPdf";
import { GameReviewDetailedReport } from "./GameReviewDetailedReport";
import { GameReviewTeamPanel } from "./GameReviewTeamPanel";
import type { Game, PitchEvent, PlateAppearance, Player } from "@/lib/types";

type ReviewTeamView = "away" | "home";

function parseTeamViewParam(value: string | null): ReviewTeamView | null {
  if (value === "away" || value === "home") return value;
  return null;
}

function pitcherCreditLabel(player: Player | undefined): string {
  if (!player) return "—";
  return player.name;
}

interface GameReviewClientProps {
  game: Game;
  canEdit?: boolean;
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
  pitcherOfficialTotals: Record<string, PitcherOfficialTotals>;
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
  pitcherOfficialTotals,
}: GameReviewClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const gameLabel = `${formatDateMMDDYYYY(game.date)} ${matchupLabelUsFirst(game, true)}`;
  const defaultTeamView: ReviewTeamView = game.our_side ?? "away";
  const teamViewFromUrl = parseTeamViewParam(searchParams.get("team"));
  const [teamView, setTeamView] = useState<ReviewTeamView>(teamViewFromUrl ?? defaultTeamView);

  const [highlightedBatterId, setHighlightedBatterId] = useState<string | null>(null);
  const [batterExpandAll, setBatterExpandAll] = useState<boolean | null>(null);
  const [pitcherCardsExpanded, setPitcherCardsExpanded] = useState(true);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [pdfReportMounted, setPdfReportMounted] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [boxScoreExporting, setBoxScoreExporting] = useState(false);
  const [boxScoreExportError, setBoxScoreExportError] = useState<string | null>(null);
  const [detailedExporting, setDetailedExporting] = useState(false);
  const [detailedExportProgress, setDetailedExportProgress] = useState<PdfExportProgress | null>(
    null
  );
  const [detailedExportError, setDetailedExportError] = useState<string | null>(null);
  const detailedReportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parsed = parseTeamViewParam(searchParams.get("team"));
    if (parsed && parsed !== teamView) setTeamView(parsed);
  }, [searchParams, teamView]);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!exportMenuRef.current?.contains(e.target as Node)) setExportMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [exportMenuOpen]);

  const setTeamViewAndUrl = useCallback(
    (view: ReviewTeamView) => {
      setTeamView(view);
      setHighlightedBatterId(null);
      const params = new URLSearchParams(searchParams.toString());
      params.set("team", view);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const awayBattingRows = useMemo(
    () =>
      computeGameBatting(
        pasAway,
        players,
        awayLineupOrder,
        awayLineupPositionByPlayerId,
        baserunningByPlayerId
      ),
    [pasAway, players, awayLineupOrder, awayLineupPositionByPlayerId, baserunningByPlayerId]
  );
  const homeBattingRows = useMemo(
    () =>
      computeGameBatting(
        pasHome,
        players,
        homeLineupOrder,
        homeLineupPositionByPlayerId,
        baserunningByPlayerId
      ),
    [pasHome, players, homeLineupOrder, homeLineupPositionByPlayerId, baserunningByPlayerId]
  );

  const pitcherCreditLines = useMemo(() => {
    const byId = new Map(players.map((p) => [p.id, p]));
    const line = (id: string | null | undefined) =>
      pitcherCreditLabel(id?.trim() ? byId.get(id.trim()) : undefined);
    return {
      w: line(game.winning_pitcher_id),
      l: line(game.losing_pitcher_id),
      sv: line(game.save_pitcher_id),
    };
  }, [game.winning_pitcher_id, game.losing_pitcher_id, game.save_pitcher_id, players]);

  const pitcherCreditParenNotes = useMemo(() => {
    const pid = (id: string | null | undefined) => id?.trim() || null;
    const row = (id: string | null | undefined): PitcherOfficialTotals | null => {
      const k = pid(id);
      if (!k) return null;
      return pitcherOfficialTotals[k] ?? { wins: 0, losses: 0, saves: 0 };
    };
    const wl = (id: string | null | undefined): string | null => {
      if (!pid(id)) return null;
      const r = row(id);
      if (!r) return null;
      return `(${r.wins}-${r.losses})`;
    };
    const sv = (id: string | null | undefined): string | null => {
      if (!pid(id)) return null;
      const r = row(id);
      if (!r) return null;
      const n = r.saves;
      return n === 1 ? "(1 save)" : `(${n} saves)`;
    };
    return {
      w: wl(game.winning_pitcher_id),
      l: wl(game.losing_pitcher_id),
      sv: sv(game.save_pitcher_id),
    };
  }, [game.winning_pitcher_id, game.losing_pitcher_id, game.save_pitcher_id, pitcherOfficialTotals]);

  const scrollToId = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleBatterRowClick = useCallback(
    (playerId: string, sectionPrefix: string) => {
      setHighlightedBatterId(playerId);
      scrollToId(`${sectionPrefix}-batter-${playerId}`);
    },
    [scrollToId]
  );

  const toggleBatterExpandAll = useCallback(() => {
    setBatterExpandAll((prev) => (prev === false ? true : false));
  }, []);

  const runDetailedReportExport = useCallback(async () => {
    setExportMenuOpen(false);
    setDetailedExportError(null);
    setDetailedExportProgress(null);
    setPdfReportMounted(true);
    setDetailedExporting(true);
    try {
      for (let i = 0; i < 12; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (detailedReportRef.current) break;
      }
      const el = detailedReportRef.current;
      if (!el) {
        throw new Error("Could not prepare detailed report for export.");
      }
      await downloadGameReviewDetailedPdf(el, game, {
        onProgress: setDetailedExportProgress,
      });
    } catch (e) {
      setDetailedExportError(e instanceof Error ? e.message : "Could not build detailed report PDF.");
    } finally {
      setDetailedExporting(false);
      setDetailedExportProgress(null);
    }
  }, [game]);

  const runClassicBoxScoreExport = useCallback(async () => {
    setExportMenuOpen(false);
    setBoxScoreExportError(null);
    setBoxScoreExporting(true);
    try {
      await downloadClassicBoxScorePdf({
        game,
        pasAll,
        pasAway,
        pasHome,
        players,
        awayLineupOrder,
        homeLineupOrder,
        awayLineupPositionByPlayerId,
        homeLineupPositionByPlayerId,
        baserunningByPlayerId,
      });
    } catch (e) {
      setBoxScoreExportError(e instanceof Error ? e.message : "Could not build box score PDF.");
    } finally {
      setBoxScoreExporting(false);
    }
  }, [
    game,
    pasAll,
    pasAway,
    pasHome,
    players,
    awayLineupOrder,
    homeLineupOrder,
    awayLineupPositionByPlayerId,
    homeLineupPositionByPlayerId,
    baserunningByPlayerId,
  ]);

  const showDelete = canEdit && !isDemoId(game.id);
  const logHref = analystGameLogHref(game.id);
  const recordHref = analystRecordHref(game.id);
  const finalized = isGameFinalized(game);
  const exporting = detailedExporting || boxScoreExporting;
  const crumbClass = "font-medium text-[var(--accent)] transition hover:underline";
  const crumbMuted = "text-[var(--text-faint)] select-none";

  const detailedExportButtonLabel = detailedExporting
    ? detailedExportProgress
      ? `Page ${detailedExportProgress.pageNumber} of ~${detailedExportProgress.estimatedTotalPages}`
      : "Building…"
    : "Detailed PDF";

  const renderTeamPanel = (
    side: "away" | "home",
    sectionPrefix: string,
    battingRows: typeof awayBattingRows
  ) => (
    <GameReviewTeamPanel
      key={side}
      game={game}
      side={side}
      pasAll={pasAll}
      pasTeam={side === "away" ? pasAway : pasHome}
      players={players}
      lineupOrder={side === "away" ? awayLineupOrder : homeLineupOrder}
      lineupPositionByPlayerId={
        side === "away" ? awayLineupPositionByPlayerId : homeLineupPositionByPlayerId
      }
      baserunningByPlayerId={baserunningByPlayerId}
      pitchEvents={pitchEvents}
      battingRows={battingRows}
      highlightedBatterId={highlightedBatterId}
      onBatterRowClick={(playerId) => handleBatterRowClick(playerId, sectionPrefix)}
      batterExpandAll={batterExpandAll}
      onToggleBatterExpandAll={toggleBatterExpandAll}
      pitcherCardsExpanded={pitcherCardsExpanded}
      onTogglePitcherCardsExpanded={() => setPitcherCardsExpanded((v) => !v)}
      sectionIdPrefix={sectionPrefix}
    />
  );

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 space-y-2">
          <p className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Review
          </p>
          <h1 className="font-display text-2xl font-semibold leading-snug tracking-tight text-[var(--text)] sm:text-3xl">
            {gameLabel}
          </h1>
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
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                disabled={exporting}
                onClick={() => setExportMenuOpen((o) => !o)}
                className="font-display inline-flex items-center gap-1 rounded-lg border-2 border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm font-semibold tracking-wide text-[var(--text)] transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)] disabled:opacity-50"
                aria-expanded={exportMenuOpen}
                aria-haspopup="menu"
              >
                {exporting ? (detailedExporting ? detailedExportButtonLabel : "Building…") : "Export ▾"}
              </button>
              {exportMenuOpen && !exporting ? (
                <div
                  className="absolute right-0 z-30 mt-1 min-w-[12rem] rounded-lg border border-[var(--border)] bg-[var(--bg-card)] py-1 shadow-lg"
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-2 text-left text-sm text-[var(--text)] transition hover:bg-[var(--bg-elevated)]"
                    onClick={() => void runDetailedReportExport()}
                  >
                    Export detailed PDF
                  </button>
                  {finalized ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-3 py-2 text-left text-sm text-[var(--text)] transition hover:bg-[var(--bg-elevated)]"
                      onClick={() => void runClassicBoxScoreExport()}
                    >
                      Export box score PDF
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
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

      {deleteError ? (
        <div
          className="rounded-lg border p-3 text-sm text-[var(--danger)]"
          style={{ background: "var(--danger-dim)", borderColor: "var(--border)" }}
          role="alert"
        >
          {deleteError}
        </div>
      ) : null}
      {boxScoreExportError ? (
        <div
          className="rounded-lg border p-3 text-sm text-[var(--danger)]"
          style={{ background: "var(--danger-dim)", borderColor: "var(--border)" }}
          role="alert"
        >
          {boxScoreExportError}
        </div>
      ) : null}
      {detailedExportError ? (
        <div
          className="rounded-lg border p-3 text-sm text-[var(--danger)]"
          style={{ background: "var(--danger-dim)", borderColor: "var(--border)" }}
          role="alert"
        >
          {detailedExportError}
        </div>
      ) : null}

      {pdfReportMounted && pasAll.length > 0 ? (
        <div
          className="pointer-events-none fixed top-0 -left-[10000px] z-0 w-[816px] max-w-none"
          aria-hidden
        >
          <GameReviewDetailedReport
            ref={detailedReportRef}
            game={game}
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
            pitcherCreditLines={pitcherCreditLines}
            pitcherCreditParenNotes={pitcherCreditParenNotes}
          />
        </div>
      ) : null}

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

      {pasAll.length > 0 ? (
        <div className="space-y-6">
          <section id="game-review-summary" className="scroll-mt-24">
            <div className="game-review-linescore-row rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 shadow-sm sm:p-5">
              <h2 className="font-display mb-4 text-base font-semibold uppercase tracking-wider text-[var(--text)] sm:text-lg">
                Game summary
              </h2>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-stretch sm:gap-8 lg:gap-10">
                <div className="min-w-0 w-max max-w-full shrink-0">
                  <div className="box-score-print-wrap">
                    <BoxScore game={game} pas={pasAll} large bare />
                  </div>
                </div>
                <aside className="min-w-0 w-full flex-1 sm:min-w-[16rem]">
                  <div className="flex h-full w-full flex-col justify-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm sm:gap-3 sm:px-5 sm:py-4 sm:text-base">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="shrink-0 font-display font-bold text-[var(--accent)]">Win</span>
                      <span className="min-w-0 font-medium whitespace-normal break-words text-[var(--text)]">
                        {pitcherCreditLines.w}
                        {pitcherCreditLines.w !== "—" && pitcherCreditParenNotes.w ? (
                          <span className="ml-1 whitespace-nowrap text-[var(--text-muted)] tabular-nums">
                            {pitcherCreditParenNotes.w}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="shrink-0 font-display font-bold text-[var(--accent)]">Loss</span>
                      <span className="min-w-0 font-medium whitespace-normal break-words text-[var(--text)]">
                        {pitcherCreditLines.l}
                        {pitcherCreditLines.l !== "—" && pitcherCreditParenNotes.l ? (
                          <span className="ml-1 whitespace-nowrap text-[var(--text-muted)] tabular-nums">
                            {pitcherCreditParenNotes.l}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="shrink-0 font-display font-bold text-[var(--accent)]">Save</span>
                      <span className="min-w-0 font-medium whitespace-normal break-words text-[var(--text)]">
                        {pitcherCreditLines.sv}
                        {pitcherCreditLines.sv !== "—" && pitcherCreditParenNotes.sv ? (
                          <span className="ml-1 whitespace-nowrap text-[var(--text-muted)] tabular-nums">
                            {pitcherCreditParenNotes.sv}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </section>

          <section id="game-review-team-content" className="scroll-mt-24 space-y-3">
            <nav
              className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-base)]/95 px-1 py-2 backdrop-blur-sm"
              aria-label="Team view"
            >
              <button
                type="button"
                onClick={() => setTeamViewAndUrl("away")}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
                  teamView === "away"
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)]"
                    : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:border-[var(--accent)]/50"
                }`}
              >
                {game.away_team}
              </button>
              <button
                type="button"
                onClick={() => setTeamViewAndUrl("home")}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
                  teamView === "home"
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)]"
                    : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:border-[var(--accent)]/50"
                }`}
              >
                {game.home_team}
              </button>
            </nav>

            {teamView === "away" ? (
              renderTeamPanel("away", "game-review-away", awayBattingRows)
            ) : (
              renderTeamPanel("home", "game-review-home", homeBattingRows)
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
