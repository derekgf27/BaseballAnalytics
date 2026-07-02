"use client";

import dynamic from "next/dynamic";
import type { BaserunningEvent, Game, LineupSide, PitchEvent, PlateAppearance, Player } from "@/lib/types";

const GameBattingTable = dynamic(
  () => import("@/components/analyst/GameBattingTable").then((m) => ({ default: m.GameBattingTable })),
  { ssr: false, loading: () => <div className="h-40 animate-pulse rounded-lg bg-[var(--bg-elevated)]" /> }
);
const GamePitchingBoxTable = dynamic(
  () =>
    import("@/components/analyst/GamePitchingBoxTable").then((m) => ({ default: m.GamePitchingBoxTable })),
  { ssr: false, loading: () => <div className="h-32 animate-pulse rounded-lg bg-[var(--bg-elevated)]" /> }
);
const RecordBaserunningPanel = dynamic(
  () =>
    import("@/components/analyst/RecordBaserunningPanel").then((m) => ({
      default: m.RecordBaserunningPanel,
    })),
  { ssr: false }
);
const PitchingPitchMixSupplement = dynamic(
  () =>
    import("@/components/analyst/BattingPitchMixCard").then((m) => ({
      default: m.PitchingPitchMixSupplement,
    })),
  { ssr: false }
);

export interface RecordBoxScoreSectionProps {
  isLg: boolean;
  toggleLabel: string;
  onTogglePeekOther: () => void;
  battingTeamName: string;
  pitchingTeamName: string;
  selectedGame: Game;
  pasForBattingTable: PlateAppearance[];
  allPAsForGame: PlateAppearance[];
  players: Player[];
  lineupOrder: string[];
  lineupPositionByPlayerId: Record<string, string>;
  highlightedBatterId: string | null;
  battingTablePeekOther: boolean;
  baserunningByPlayerId: Record<string, { sb: number; cs: number }>;
  baserunningEvents: BaserunningEvent[];
  recordLocked: boolean;
  isDemoGame: boolean;
  onDeleteBaserunningEvent: (id: string) => void;
  pitchingSideForBox: LineupSide;
  pasForPitchMix: PlateAppearance[];
  pitchEventsForMix: PitchEvent[];
  distributionPitchEventsForMix: PitchEvent[];
  currentPitcherId: string | null;
  hidePitchTypeMix: boolean;
}

export function RecordBoxScoreSection({
  isLg,
  toggleLabel,
  onTogglePeekOther,
  battingTeamName,
  pitchingTeamName,
  selectedGame,
  pasForBattingTable,
  allPAsForGame,
  players,
  lineupOrder,
  lineupPositionByPlayerId,
  highlightedBatterId,
  battingTablePeekOther,
  baserunningByPlayerId,
  baserunningEvents,
  recordLocked,
  isDemoGame,
  onDeleteBaserunningEvent,
  pitchingSideForBox,
  pasForPitchMix,
  pitchEventsForMix,
  distributionPitchEventsForMix,
  currentPitcherId,
  hidePitchTypeMix,
}: RecordBoxScoreSectionProps) {
  const battingTable = (
    <GameBattingTable
      game={selectedGame}
      teamName={battingTeamName}
      pas={pasForBattingTable}
      players={players}
      lineupOrder={lineupOrder.length > 0 ? lineupOrder : undefined}
      lineupPositionByPlayerId={lineupPositionByPlayerId}
      highlightedBatterId={battingTablePeekOther ? null : highlightedBatterId}
      baserunningByPlayerId={baserunningByPlayerId}
      hideHeading={isLg}
      showPitchData={false}
    />
  );

  const pitchingColumn = (
    <>
      <GamePitchingBoxTable
        game={selectedGame}
        side={pitchingSideForBox}
        pas={allPAsForGame}
        players={players}
        compact
        hideHeading={isLg}
      />
      <PitchingPitchMixSupplement
        pas={pasForPitchMix}
        players={players}
        pitchEvents={pitchEventsForMix}
        distributionPitchEvents={distributionPitchEventsForMix}
        compact
        currentPitcherId={currentPitcherId}
        hideTypeMix={hidePitchTypeMix}
      />
    </>
  );

  const baserunningPanel = (
    <RecordBaserunningPanel
      players={players}
      baserunningEvents={baserunningEvents}
      disabled={recordLocked || isDemoGame}
      onDeleteEvent={onDeleteBaserunningEvent}
    />
  );

  if (isLg) {
    return (
      <>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-x-4 gap-y-2">
          <h2 className="font-display min-w-0 text-sm font-semibold uppercase tracking-wider text-[var(--text)]">
            Batters – {battingTeamName}
          </h2>
          <button
            type="button"
            onClick={onTogglePeekOther}
            className="mb-px shrink-0 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-medium text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-dim)]/30"
          >
            {toggleLabel}
          </button>
          <h2 className="font-display min-w-0 text-right text-sm font-semibold uppercase tracking-wider text-[var(--text)]">
            Pitchers – {pitchingTeamName}
          </h2>
        </div>
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-5">
          <div className="flex min-w-0 flex-col gap-3">
            {battingTable}
            {baserunningPanel}
          </div>
          <div className="flex min-w-0 flex-col gap-3">{pitchingColumn}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap justify-end">
        <button
          type="button"
          onClick={onTogglePeekOther}
          className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-medium text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-dim)]/30"
        >
          {toggleLabel}
        </button>
      </div>
      <div className="grid grid-cols-1 items-start gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          {battingTable}
          {baserunningPanel}
        </div>
        <div className="flex min-w-0 flex-col gap-3">{pitchingColumn}</div>
      </div>
    </>
  );
}
