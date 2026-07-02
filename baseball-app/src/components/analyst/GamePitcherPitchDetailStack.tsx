"use client";

import { useMemo, useState } from "react";
import { LazyInView } from "@/components/shared/LazyInView";
import {
  PitcherPitchDetailCard,
  PitcherTeamPitchTotalsCard,
  pitcherIdsInOrder,
} from "@/components/analyst/BattingPitchMixCard";
import type { Bats, PitchEvent, PlateAppearance, Player } from "@/lib/types";

function PitcherPitchDetailSlot({
  cardId,
  pitcherLabel,
  pas,
  players,
  pitcherId,
  pitchEvents,
  batterBatsById,
  onPitchesByInningClick,
  showPitchLogEmptyNote,
  collapsed,
}: {
  cardId: string;
  pitcherLabel: string;
  pas: PlateAppearance[];
  players: Player[];
  pitcherId: string;
  pitchEvents: PitchEvent[];
  batterBatsById: Map<string, Bats | null | undefined>;
  onPitchesByInningClick?: (pitcherId: string) => void;
  showPitchLogEmptyNote: boolean;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(!collapsed);

  return (
    <div id={cardId} className="scroll-mt-28 rounded-lg transition">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between rounded-lg border border-[var(--border)]/60 bg-[var(--bg-elevated)]/40 px-3 py-2 text-left text-xs transition hover:border-[var(--accent)]/40"
        >
          <span className="font-medium text-[var(--text)]">{pitcherLabel}</span>
          <span className="shrink-0 text-[var(--text-faint)]">Show pitch detail</span>
        </button>
      ) : (
        <LazyInView minHeight={180}>
          <PitcherPitchDetailCard
            pas={pas}
            players={players}
            pitcherId={pitcherId}
            pitchEvents={pitchEvents}
            batterBatsById={batterBatsById}
            onPitchesByInningClick={onPitchesByInningClick}
            showPitchLogEmptyNote={showPitchLogEmptyNote}
            compact
          />
        </LazyInView>
      )}
    </div>
  );
}

/** Scrollable list of pitcher pitch cards in appearance order (game review). */
export function GamePitcherPitchDetailStack({
  pas,
  players,
  pitchEvents = [],
  batterBatsById,
  expandAll = null,
  onPitchesByInningClick,
  showPitchLogEmptyNote = false,
  cardIdPrefix = "game-review",
}: {
  pas: PlateAppearance[];
  players: Player[];
  pitchEvents?: PitchEvent[];
  batterBatsById: Map<string, Bats | null | undefined>;
  /** true = all expanded, false = all collapsed, null = all collapsed. */
  expandAll?: boolean | null;
  onPitchesByInningClick?: (pitcherId: string) => void;
  showPitchLogEmptyNote?: boolean;
  cardIdPrefix?: string;
}) {
  const pitcherIds = useMemo(() => pitcherIdsInOrder(pas), [pas]);
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  if (pitcherIds.length === 0) {
    return <p className="text-xs text-[var(--text-muted)]">No pitchers logged for this team yet.</p>;
  }

  function isCollapsed(): boolean {
    return expandAll !== true;
  }

  return (
    <div className="game-pitcher-pitch-detail-stack space-y-2">
      {pitcherIds.map((pitcherId) => {
        const player = playerById.get(pitcherId);
        const name = player?.name?.trim() || "Unknown";
        const jersey = player?.jersey?.trim();
        const pitcherLabel = jersey ? `${name} #${jersey}` : name;
        const cardId = `${cardIdPrefix}-pitcher-${pitcherId}`;

        return (
          <PitcherPitchDetailSlot
            key={`${pitcherId}-${expandAll ?? "auto"}`}
            cardId={cardId}
            pitcherLabel={pitcherLabel}
            pas={pas}
            players={players}
            pitcherId={pitcherId}
            pitchEvents={pitchEvents}
            batterBatsById={batterBatsById}
            onPitchesByInningClick={onPitchesByInningClick}
            showPitchLogEmptyNote={showPitchLogEmptyNote}
            collapsed={isCollapsed()}
          />
        );
      })}
      <PitcherTeamPitchTotalsCard
        pas={pas}
        players={players}
        pitchEvents={pitchEvents}
        batterBatsById={batterBatsById}
        showPitchLogEmptyNote={showPitchLogEmptyNote}
        compact
      />
    </div>
  );
}
