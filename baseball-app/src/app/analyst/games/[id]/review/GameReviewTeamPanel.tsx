"use client";

import { useMemo, useState } from "react";
import {
  pitchesByInningForPitcher,
} from "@/components/analyst/BattingPitchMixCard";
import { GamePitcherPitchDetailStack } from "@/components/analyst/GamePitcherPitchDetailStack";
import { PitchesByInningModal } from "@/components/analyst/PitchesByInningModal";
import { plateAppearancesForPitchingSide } from "@/lib/compute/gamePitchingBox";
import {
  batterBatsByIdFromPlayers,
  buildPitchEventsByBatterId,
  groupPitchEventsByPaId,
  indexPasByPlayerId,
} from "@/lib/compute/gamePasIndexes";
import {
  GameBattingTable,
  GameBatterPitchDetailStack,
  type GameBattingRow,
} from "@/components/analyst/GameBattingTable";
import { GamePitchingBoxTable } from "@/components/analyst/GamePitchingBoxTable";
import type { Game, PitchEvent, PlateAppearance, Player } from "@/lib/types";

export function gameReviewBatterCardId(playerId: string): string {
  return `game-review-batter-${playerId}`;
}

type GameReviewTeamPanelProps = {
  game: Game;
  side: "away" | "home";
  pasAll: PlateAppearance[];
  pasTeam: PlateAppearance[];
  players: Player[];
  lineupOrder?: string[];
  lineupPositionByPlayerId?: Record<string, string>;
  baserunningByPlayerId?: Record<string, { sb: number; cs: number }>;
  pitchEvents: PitchEvent[];
  battingRows: GameBattingRow[];
  highlightedBatterId: string | null;
  onBatterRowClick: (playerId: string) => void;
  batterExpandAll: boolean | null;
  onToggleBatterExpandAll: () => void;
  pitcherExpandAll: boolean | null;
  onTogglePitcherExpandAll: () => void;
  sectionIdPrefix: string;
};

export function GameReviewTeamPanel({
  game,
  side,
  pasAll,
  pasTeam,
  players,
  lineupOrder,
  lineupPositionByPlayerId,
  baserunningByPlayerId,
  pitchEvents,
  battingRows,
  highlightedBatterId,
  onBatterRowClick,
  batterExpandAll,
  onToggleBatterExpandAll,
  pitcherExpandAll,
  onTogglePitcherExpandAll,
  sectionIdPrefix,
}: GameReviewTeamPanelProps) {
  const teamName = side === "away" ? game.away_team : game.home_team;
  const pasPitch = plateAppearancesForPitchingSide(pasAll, side);
  const [pitchesByInningModalPitcherId, setPitchesByInningModalPitcherId] = useState<string | null>(
    null
  );

  const eventsByPaId = useMemo(() => groupPitchEventsByPaId(pitchEvents), [pitchEvents]);
  const pasByBatterId = useMemo(() => indexPasByPlayerId(pasTeam, "batter_id"), [pasTeam]);
  const pitchEventsByBatterId = useMemo(
    () => buildPitchEventsByBatterId(pasByBatterId, eventsByPaId),
    [pasByBatterId, eventsByPaId]
  );
  const batterBatsById = useMemo(() => batterBatsByIdFromPlayers(players), [players]);
  const hasPitchLog = pitchEvents.length > 0;

  const pitchesByInningRows = useMemo(() => {
    if (!pitchesByInningModalPitcherId) return [];
    return pitchesByInningForPitcher(pasPitch, pitchEvents, pitchesByInningModalPitcherId);
  }, [pitchesByInningModalPitcherId, pasPitch, pitchEvents]);

  const pitchesByInningTotal = useMemo(
    () => pitchesByInningRows.reduce((sum, row) => sum + row.pitches, 0),
    [pitchesByInningRows]
  );

  const pitchesByInningModalPitcherName = useMemo(() => {
    if (!pitchesByInningModalPitcherId) return "Pitcher";
    return (
      players.find((p) => p.id === pitchesByInningModalPitcherId)?.name?.trim() || "Pitcher"
    );
  }, [pitchesByInningModalPitcherId, players]);

  const battingSectionId = `${sectionIdPrefix}-batting`;
  const batterDetailSectionId = `${sectionIdPrefix}-batter-detail`;
  const pitchingSectionId = `${sectionIdPrefix}-pitching`;

  return (
    <div className="space-y-4">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--text)]">
        {teamName}
      </h2>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-5">
        <div className="min-w-0 space-y-4">
          <div id={battingSectionId} className="scroll-mt-24">
            <GameBattingTable
              game={game}
              teamName={teamName}
              pas={pasTeam}
              players={players}
              lineupOrder={lineupOrder}
              lineupPositionByPlayerId={lineupPositionByPlayerId}
              baserunningByPlayerId={baserunningByPlayerId}
              battingRows={battingRows}
              highlightedBatterId={highlightedBatterId}
              onBatterRowClick={onBatterRowClick}
              showPitchData={false}
            />
          </div>

          <div id={batterDetailSectionId} className="scroll-mt-24 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Batter pitch and PA detail
                </h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Click a batter in the table to jump here. Same order as the table.
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleBatterExpandAll}
                className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
              >
                {batterExpandAll === false ? "Expand all batters" : "Collapse all batters"}
              </button>
            </div>
            {!hasPitchLog ? (
              <p className="mt-2 text-xs text-[var(--text-faint)]">
                No pitch log for this game — rates and mix need typed pitches on Record.
              </p>
            ) : null}
            <div className="mt-2 overflow-x-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-2 sm:p-3">
              <GameBatterPitchDetailStack
                rows={battingRows}
                pasByBatterId={pasByBatterId}
                pitchEventsByBatterId={pitchEventsByBatterId}
                highlightedBatterId={highlightedBatterId}
                expandAll={batterExpandAll}
                cardIdPrefix={sectionIdPrefix}
              />
            </div>
          </div>
        </div>

        <div id={pitchingSectionId} className="scroll-mt-24 flex min-w-0 flex-col gap-4">
          <GamePitchingBoxTable game={game} side={side} pas={pasAll} players={players} />
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Pitcher pitch detail
                </h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Same order as the pitching box. Click a row to expand pitch detail.
                </p>
              </div>
              <button
                type="button"
                onClick={onTogglePitcherExpandAll}
                className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
              >
                {pitcherExpandAll === false ? "Expand all pitchers" : "Collapse all pitchers"}
              </button>
            </div>
            {!hasPitchLog ? (
              <p className="mb-2 text-xs text-[var(--text-faint)]">
                No pitch log for this game — rates and mix need typed pitches on Record.
              </p>
            ) : null}
            <div className="overflow-x-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-2 sm:p-3">
              <GamePitcherPitchDetailStack
                pas={pasPitch}
                players={players}
                pitchEvents={pitchEvents}
                batterBatsById={batterBatsById}
                expandAll={pitcherExpandAll}
                onPitchesByInningClick={setPitchesByInningModalPitcherId}
                showPitchLogEmptyNote={!hasPitchLog}
                cardIdPrefix={sectionIdPrefix}
              />
            </div>
          </div>
        </div>
      </div>

      {pitchesByInningModalPitcherId ? (
        <PitchesByInningModal
          open
          pitcherName={pitchesByInningModalPitcherName}
          rows={pitchesByInningRows}
          totalPitches={pitchesByInningTotal}
          onClose={() => setPitchesByInningModalPitcherId(null)}
        />
      ) : null}
    </div>
  );
}
