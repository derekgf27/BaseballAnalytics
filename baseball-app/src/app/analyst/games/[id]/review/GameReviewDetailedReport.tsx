"use client";

import { forwardRef, useMemo } from "react";
import { BoxScore } from "@/components/analyst/BoxScore";
import { plateAppearancesForPitchingSide } from "@/lib/compute/gamePitchingBox";
import {
  batterBatsByIdFromPlayers,
  groupPitchEventsByPaId,
  indexPasByPlayerId,
} from "@/lib/compute/gamePasIndexes";
import { GameBattingTable } from "@/components/analyst/GameBattingTable";
import { GamePitchingBoxTable } from "@/components/analyst/GamePitchingBoxTable";
import { formatDateMMDDYYYY } from "@/lib/format";
import { matchupLabelUsFirst, opponentLineupSide } from "@/lib/opponentUtils";
import type { Bats, Game, PitchEvent, PlateAppearance, Player } from "@/lib/types";
import {
  GameReviewPdfBatterDetail,
  GameReviewPdfPitcherDetail,
  GameReviewPdfTeamPitchTotals,
} from "./GameReviewPdfPlayerDetail";

function DetailedTeamBattingSection({
  game,
  side,
  pasAway,
  pasHome,
  players,
  awayLineupOrder,
  homeLineupOrder,
  awayLineupPositionByPlayerId,
  homeLineupPositionByPlayerId,
  baserunningByPlayerId,
}: {
  game: Game;
  side: "away" | "home";
  pasAway: PlateAppearance[];
  pasHome: PlateAppearance[];
  players: Player[];
  awayLineupOrder?: string[];
  homeLineupOrder?: string[];
  awayLineupPositionByPlayerId?: Record<string, string>;
  homeLineupPositionByPlayerId?: Record<string, string>;
  baserunningByPlayerId?: Record<string, { sb: number; cs: number }>;
}) {
  const teamName = side === "away" ? game.away_team : game.home_team;
  const pasBat = side === "away" ? pasAway : pasHome;
  const lineupOrder = side === "away" ? awayLineupOrder : homeLineupOrder;
  const lineupPos = side === "away" ? awayLineupPositionByPlayerId : homeLineupPositionByPlayerId;

  return (
    <section className="game-review-detailed-team space-y-4">
      <h2 className="game-review-pdf-team-heading font-display text-lg font-semibold uppercase tracking-wider text-[var(--text)]">
        {teamName}
      </h2>
      <div className="game-review-pdf-page-one-batting min-w-0">
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
    </section>
  );
}

function DetailedTeamPdfDetailSection({
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
  eventsByPaId,
  batterBatsById,
  includeBattingTable = false,
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
  eventsByPaId: Map<string, PitchEvent[]>;
  batterBatsById: Map<string, Bats | null | undefined>;
  includeBattingTable?: boolean;
}) {
  const teamName = side === "away" ? game.away_team : game.home_team;
  const pasBat = side === "away" ? pasAway : pasHome;
  const lineupOrder = side === "away" ? awayLineupOrder : homeLineupOrder;
  const lineupPos = side === "away" ? awayLineupPositionByPlayerId : homeLineupPositionByPlayerId;
  const pasPitch = plateAppearancesForPitchingSide(pasAll, side);
  const pasByBatterId = useMemo(() => indexPasByPlayerId(pasBat, "batter_id"), [pasBat]);
  const pasByPitcherId = useMemo(() => indexPasByPlayerId(pasPitch, "pitcher_id"), [pasPitch]);

  return (
    <>
      {includeBattingTable ? (
        <div data-pdf-subsection className="game-review-pdf-subsection-unit" data-pdf-avoid-break>
          <h2 className="game-review-pdf-team-heading font-display text-lg font-semibold uppercase tracking-wider text-[var(--text)]">
            {teamName}
          </h2>
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
      ) : null}
      <GameReviewPdfBatterDetail
        pas={pasBat}
        players={players}
        eventsByPaId={eventsByPaId}
        pasByBatterId={pasByBatterId}
        lineupOrder={lineupOrder}
        lineupPositionByPlayerId={lineupPos}
        baserunningByPlayerId={baserunningByPlayerId}
        sectionTitle={`Batter pitch detail — ${teamName}`}
      />
      <div data-pdf-subsection className="game-review-pdf-subsection-unit" data-pdf-avoid-break>
        <GamePitchingBoxTable
          game={game}
          side={side}
          pas={pasAll}
          players={players}
          compact
          linkPlayersToProfile={false}
        />
        <GameReviewPdfTeamPitchTotals
          pas={pasPitch}
          eventsByPaId={eventsByPaId}
          batterBatsById={batterBatsById}
          teamName={teamName}
        />
      </div>
      <GameReviewPdfPitcherDetail
        pas={pasPitch}
        players={players}
        eventsByPaId={eventsByPaId}
        pasByPitcherId={pasByPitcherId}
        batterBatsById={batterBatsById}
        sectionTitle={`Pitcher pitch detail — ${teamName}`}
      />
    </>
  );
}

export type GameReviewDetailedReportProps = {
  game: Game;
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
  pitcherCreditLines: { w: string; l: string; sv: string };
  pitcherCreditParenNotes: { w: string | null; l: string | null; sv: string | null };
};

export const GameReviewDetailedReport = forwardRef<HTMLDivElement, GameReviewDetailedReportProps>(
  function GameReviewDetailedReport(
    {
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
      pitchEvents,
      pitcherCreditLines,
      pitcherCreditParenNotes,
    },
    ref
  ) {
    const gameLabel = `${formatDateMMDDYYYY(game.date)} ${matchupLabelUsFirst(game, true)}`;
    const ourSide = game.our_side;
    const opponentSide = opponentLineupSide(game);

    const eventsByPaId = useMemo(() => groupPitchEventsByPaId(pitchEvents), [pitchEvents]);
    const batterBatsById = useMemo(() => batterBatsByIdFromPlayers(players), [players]);

    const teamProps = {
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
      eventsByPaId,
      batterBatsById,
    };

    return (
      <div
        ref={ref}
        className="game-review-detailed-report-root game-review-print-area bg-white p-4 text-[var(--text)]"
      >
        <section className="game-review-pdf-page-one space-y-4">
          <header className="game-review-pdf-doc-header border-b border-[var(--border)] pb-3">
            <h1 className="game-review-pdf-main-title font-display text-xl font-semibold text-[var(--text)]">
              {gameLabel}
            </h1>
          </header>

          <div className="game-review-pdf-linescore game-review-linescore-row rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <h2 className="font-display mb-4 text-base font-semibold uppercase tracking-wider text-[var(--text)]">
              Game summary
            </h2>
            <div className="game-review-pdf-summary-layout flex flex-col gap-4">
              <div className="box-score-print-wrap w-max max-w-full self-start">
                <BoxScore game={game} pas={pasAll} large bare />
              </div>
              <aside className="game-review-pdf-pitcher-credits w-full max-w-md">
                <div className="flex flex-col justify-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm">
                  {(
                    [
                      ["Win", pitcherCreditLines.w, pitcherCreditParenNotes.w],
                      ["Loss", pitcherCreditLines.l, pitcherCreditParenNotes.l],
                      ["Save", pitcherCreditLines.sv, pitcherCreditParenNotes.sv],
                    ] as const
                  ).map(([label, name, paren]) => (
                    <div
                      key={label}
                      className="game-review-pdf-credit-row flex items-baseline gap-x-2 gap-y-0.5"
                    >
                      <span className="shrink-0 font-display font-bold text-[var(--accent)]">
                        {label}
                      </span>
                      <span className="game-review-pdf-credit-name min-w-0 font-medium text-[var(--text)]">
                        {name}
                        {name !== "—" && paren ? (
                          <span className="ml-1 whitespace-nowrap text-[var(--text-muted)] tabular-nums">
                            {paren}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </div>

          <DetailedTeamBattingSection side={ourSide} {...teamProps} />
        </section>

        <section className="game-review-pdf-page-our-detail">
          <DetailedTeamPdfDetailSection side={ourSide} {...teamProps} />
        </section>

        <section className="game-review-pdf-page-opponent">
          <DetailedTeamPdfDetailSection side={opponentSide} includeBattingTable {...teamProps} />
        </section>
      </div>
    );
  }
);
