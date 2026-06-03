"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useTouchOptimizedDndSensors } from "@/lib/dndTouchSensors";
import Link from "next/link";
import type { BattingStats, BattingStatsWithSplits, Player, SavedLineup } from "@/lib/types";
import { lineupAggregateFromBattingStats } from "@/lib/compute/battingStats";
import { comparePlayersByLastNameThenFull } from "@/lib/playerSort";
import { getPlayerPrimaryPosition } from "@/lib/playerRoster";

import type { LineupSplitView, PoolSortKey, RosterTableRow } from "./lineupWorkbenchUi";

export type { LineupSplitView, PoolSortKey } from "./lineupWorkbenchUi";
import {
  AvailablePlayerGrid,
  LineupCollectiveStatsBar,
  LineupFooterTools,
  LineupOrderPanel,
  LineupSaveActions,
  PlayerPoolDropZone,
  RosterStatsControls,
  UnifiedRosterStatsTable,
} from "./lineupWorkbenchUi";
import {
  deleteSavedLineupForCoach,
  fetchGameLineupForCoach,
  fetchSavedLineupSlotsForCoach,
  saveGameLineupForCoachAction,
} from "@/app/coach/lineup/actions";
import { fetchSavedLineupWithSlots, saveLineupTemplate, deleteSavedLineup } from "./actions";
import { formatDateMMDDYYYY } from "@/lib/format";
import { isGameFinalized } from "@/lib/gameRecord";
import { matchupLabelUsFirst } from "@/lib/opponentUtils";
import type { Game, LineupSide } from "@/lib/types";

const LINEUP_POSITIONS = [
  "P",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
  "DH",
] as const;

type LineupSlotState = { player: Player | null; position: string };

function getStatValue(statsMap: Record<string, BattingStats>, playerId: string, key: PoolSortKey): number {
  if (key === "name") return 0;
  const s = statsMap[playerId];
  if (!s) return -1;
  const v = (s as unknown as Record<string, unknown>)[key];
  return typeof v === "number" ? v : -1;
}

/** Suggest batting order: fill 9 slots with best 9 by stat (or reorder current 9). */
function suggestOrder(
  players: Player[],
  statsMap: Record<string, BattingStats>,
  stat: "obp" | "avg"
): { player: Player; position: string }[] {
  const key = stat;
  const withStat = players.map((p) => ({
    player: p,
    value: getStatValue(statsMap, p.id, key),
  }));
  withStat.sort((a, b) => b.value - a.value);
  const top9 = withStat.slice(0, 9).map(({ player }) => player);
  return top9.map((player) => {
    const primary = getPlayerPrimaryPosition(player);
    const position =
      primary && LINEUP_POSITIONS.includes(primary as (typeof LINEUP_POSITIONS)[number]) ? primary : "DH";
    return { player, position };
  });
}

export type InitialGameLineupSlot = {
  order: number;
  playerId: string;
  playerName: string;
  position: string;
  bats: string | null;
};

export interface LineupConstructionClientProps {
  initialPlayers: Player[];
  initialBattingStatsWithSplits: Record<string, BattingStatsWithSplits>;
  initialSavedLineups: SavedLineup[];
  /** Coach portal: edit lineup per game (same UI as analyst, game save instead of template-only). */
  games?: Game[];
  initialGameId?: string | null;
  initialGameOurSide?: LineupSide | null;
  initialGameLineup?: InitialGameLineupSlot[];
}

function formatGameLabel(game: Game): string {
  const d = game.date ? formatDateMMDDYYYY(game.date) : game.date;
  return `${d} ${matchupLabelUsFirst(game, true)}`;
}

function slotsToLineupState(
  slots: { slot: number; player_id: string; position: string | null }[],
  playerMap: Map<string, Player>
): LineupSlotState[] {
  const next: LineupSlotState[] = Array.from({ length: 9 }, () => ({ player: null, position: "" }));
  for (const s of slots) {
    if (s.slot >= 1 && s.slot <= 9) {
      next[s.slot - 1] = {
        player: playerMap.get(s.player_id) ?? null,
        position: s.position ?? "",
      };
    }
  }
  return next;
}

function initialGameLineupToState(
  initialLineup: InitialGameLineupSlot[],
  playerMap: Map<string, Player>
): LineupSlotState[] {
  const next: LineupSlotState[] = Array.from({ length: 9 }, () => ({ player: null, position: "" }));
  for (const s of initialLineup) {
    const idx = Math.trunc(s.order) - 1;
    if (idx >= 0 && idx < 9) {
      next[idx] = {
        player: playerMap.get(s.playerId) ?? null,
        position: s.position || "",
      };
    }
  }
  return next;
}

function getStatsForLineupSplit(splits: Record<string, BattingStatsWithSplits>, playerId: string, split: LineupSplitView): BattingStats | undefined {
  const s = splits[playerId];
  if (!s) return undefined;
  if (split === "overall") return s.overall;
  if (split === "vsL") return s.vsL ?? undefined;
  if (split === "vsR") return s.vsR ?? undefined;
  return s.risp ?? undefined;
}

export default function LineupConstructionClient({
  initialPlayers,
  initialBattingStatsWithSplits,
  initialSavedLineups = [],
  games,
  initialGameId = null,
  initialGameOurSide = null,
  initialGameLineup = [],
}: LineupConstructionClientProps) {
  const router = useRouter();
  const gameMode = games != null && games.length > 0;
  const editableGames = useMemo(
    () => (games ?? []).filter((g) => !isGameFinalized(g)),
    [games]
  );
  const playerMap = useMemo(() => new Map(initialPlayers.map((p) => [p.id, p])), [initialPlayers]);
  const lineupSplitForStats: LineupSplitView = "overall";
  const [selectedGameId, setSelectedGameId] = useState<string | null>(
    gameMode ? (initialGameId ?? null) : null
  );
  const [loadingLineup, setLoadingLineup] = useState(false);
  const [lineup, setLineup] = useState<LineupSlotState[]>(() => {
    if (gameMode && initialGameLineup.length > 0) {
      return initialGameLineupToState(initialGameLineup, playerMap);
    }
    return Array.from({ length: 9 }, () => ({ player: null, position: "" }));
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading">("idle");
  const [poolSortBy, setPoolSortBy] = useState<PoolSortKey>("name");
  const [poolSplitView, setPoolSplitView] = useState<LineupSplitView>("overall");

  const initialBattingStats: Record<string, BattingStats> = {};
  for (const p of initialPlayers) {
    const s = getStatsForLineupSplit(initialBattingStatsWithSplits, p.id, lineupSplitForStats);
    if (s) initialBattingStats[p.id] = s;
  }

  const poolBattingStats: Record<string, BattingStats> = {};
  for (const p of initialPlayers) {
    const s = getStatsForLineupSplit(initialBattingStatsWithSplits, p.id, poolSplitView);
    if (s) poolBattingStats[p.id] = s;
  }

  const selectedGame =
    selectedGameId != null ? editableGames.find((g) => g.id === selectedGameId) ?? null : null;
  const lineupSide: LineupSide = selectedGame?.our_side ?? initialGameOurSide ?? "home";

  useEffect(() => {
    if (saveStatus !== "ok") return;
    const t = setTimeout(() => setSaveStatus("idle"), 2500);
    return () => clearTimeout(t);
  }, [saveStatus]);

  useEffect(() => {
    if (!gameMode) return;
    if (selectedGameId && editableGames.some((g) => g.id === selectedGameId)) return;
    setSelectedGameId(editableGames[0]?.id ?? null);
  }, [gameMode, editableGames, selectedGameId]);

  useEffect(() => {
    if (!gameMode || !selectedGameId) {
      if (gameMode) {
        setLineup(Array.from({ length: 9 }, () => ({ player: null, position: "" })));
      }
      return;
    }
    if (
      selectedGameId === initialGameId &&
      initialGameLineup.length > 0 &&
      initialGameOurSide != null &&
      lineupSide === initialGameOurSide
    ) {
      setLineup(initialGameLineupToState(initialGameLineup, playerMap));
      return;
    }
    setLoadingLineup(true);
    fetchGameLineupForCoach(selectedGameId, lineupSide)
      .then((slots) => setLineup(slotsToLineupState(slots, playerMap)))
      .finally(() => setLoadingLineup(false));
  }, [
    gameMode,
    selectedGameId,
    lineupSide,
    initialGameId,
    initialGameLineup,
    initialGameOurSide,
    playerMap,
  ]);

  const sensors = useTouchOptimizedDndSensors();

  const inLineupIds = new Set(
    lineup.filter((s) => s.player != null).map((s) => s.player!.id)
  );
  const availablePlayers = initialPlayers.filter((p) => !inLineupIds.has(p.id));
  const sortedAvailablePlayers = [...availablePlayers].sort((a, b) => {
    if (poolSortBy === "name") return comparePlayersByLastNameThenFull(a, b);
    const va = getStatValue(poolBattingStats, a.id, poolSortBy);
    const vb = getStatValue(poolBattingStats, b.id, poolSortBy);
    const d = vb - va;
    if (d !== 0) return d;
    return comparePlayersByLastNameThenFull(a, b);
  });

  const lineupPlayers = lineup.map((s) => s.player).filter((p): p is Player => p != null);
  const lineupBattingStats = lineupPlayers
    .map((p) => poolBattingStats[p.id] ?? initialBattingStats[p.id])
    .filter((s): s is BattingStats => s != null);
  const lineupQuality =
    lineupBattingStats.length > 0 ? lineupAggregateFromBattingStats(lineupBattingStats) : null;

  const rosterTableRows: RosterTableRow[] = useMemo(() => {
    const rows: RosterTableRow[] = [];
    lineup.forEach((slot, i) => {
      if (slot.player) {
        rows.push({
          player: slot.player,
          spot: i + 1,
          position: slot.position,
          inLineup: true,
        });
      }
    });
    for (const player of sortedAvailablePlayers) {
      rows.push({ player, spot: null, position: "", inLineup: false });
    }
    return rows;
  }, [lineup, sortedAvailablePlayers]);

  const duplicatePositions = useMemo(() => {
    const positionCounts = new Map<string, number>();
    for (const s of lineup) {
      if (s.player && s.position) {
        positionCounts.set(s.position, (positionCounts.get(s.position) ?? 0) + 1);
      }
    }
    return [...positionCounts.entries()].filter(([, c]) => c > 1).map(([pos]) => pos);
  }, [lineup]);

  function removePlayerFromLineup(playerId: string) {
    setLineup((prev) =>
      prev.map((s) => (s.player?.id === playerId ? { player: null, position: "" } : s))
    );
  }

  function handleSuggestBy(stat: "obp" | "avg") {
    const nine =
      lineupPlayers.length === 9 ? lineupPlayers : [...lineupPlayers, ...availablePlayers].slice(0, 9);
    if (nine.length === 0) return;
    const ordered = suggestOrder(nine, initialBattingStats, stat);
    const padded: LineupSlotState[] = Array.from({ length: 9 }, (_, i) =>
      ordered[i] ? { player: ordered[i].player, position: ordered[i].position } : { player: null, position: "" }
    );
    setLineup(padded);
  }

  function setSlotPosition(slotIndex: number, position: string) {
    setLineup((prev) => {
      const next = [...prev];
      next[slotIndex] = { ...next[slotIndex], position };
      return next;
    });
  }

  function clearLineup() {
    setLineup(Array.from({ length: 9 }, () => ({ player: null, position: "" })));
  }

  const hasAnyPlayerInLineup = lineup.some((s) => s.player != null);

  async function handleSaveTemplate() {
    const name = templateName.trim();
    if (!name || !hasAnyPlayerInLineup) return;
    setSaveStatus("saving");
    setSaveErrorMessage(null);
    const slots = lineup
      .map((s, i) => (s.player ? { slot: i + 1, player_id: s.player.id, position: s.position || null } : null))
      .filter((s): s is { slot: number; player_id: string; position: string | null } => s != null);
    const res = await saveLineupTemplate(name, slots);
    setSaveStatus(res.ok ? "ok" : "err");
    if (res.error) setSaveErrorMessage(res.error);
    if (res.ok) {
      setTemplateName("");
      router.refresh();
    }
  }

  async function handleLoadTemplate(lineupId: string) {
    setLoadStatus("loading");
    if (gameMode) {
      const slots = await fetchSavedLineupSlotsForCoach(lineupId);
      setLoadStatus("idle");
      if (!slots.length) return;
      setLineup(slotsToLineupState(slots, playerMap));
      return;
    }
    const saved = await fetchSavedLineupWithSlots(lineupId);
    setLoadStatus("idle");
    if (!saved?.slots?.length) return;
    const ordered = [...saved.slots].sort((a, b) => a.slot - b.slot);
    const newLineup: LineupSlotState[] = Array.from({ length: 9 }, () => ({ player: null, position: "" }));
    for (const s of ordered) {
      if (s.slot >= 1 && s.slot <= 9) {
        const player = playerMap.get(s.player_id) ?? null;
        newLineup[s.slot - 1] = { player, position: s.position ?? "" };
      }
    }
    setLineup(newLineup);
  }

  async function handleDeleteTemplate(id: string) {
    if (gameMode) {
      await deleteSavedLineupForCoach(id);
    } else {
      await deleteSavedLineup(id);
    }
    router.refresh();
  }

  async function handleSaveGameLineup() {
    if (!selectedGameId) return;
    const ordered = lineup
      .map((s) => (s.player ? { player_id: s.player.id, position: s.position || null } : null))
      .filter((s): s is { player_id: string; position: string | null } => s != null);
    setSaveStatus("saving");
    setSaveErrorMessage(null);
    const result = await saveGameLineupForCoachAction(selectedGameId, lineupSide, ordered);
    setSaveStatus(result.ok ? "ok" : "err");
    setSaveErrorMessage(result.error ?? null);
    if (result.ok) setTimeout(() => setSaveStatus("idle"), 2500);
  }

  const activePlayer = activeId
    ? initialPlayers.find((p) => p.id === activeId) ?? null
    : null;

  function defaultLineupPosition(player: Player): string {
    const primary = getPlayerPrimaryPosition(player);
    return primary && LINEUP_POSITIONS.includes(primary as (typeof LINEUP_POSITIONS)[number]) ? primary : "DH";
  }

  function assignPlayerToSlot(player: Player, slotIndex: number) {
    if (slotIndex < 0 || slotIndex > 8) return;
    const currentSlot = lineup.findIndex((s) => s.player?.id === player.id);
    const displaced = lineup[slotIndex];

    setLineup((prev) => {
      const next = prev.map((s) => ({ ...s }));
      next[slotIndex] = { player, position: defaultLineupPosition(player) };
      if (currentSlot >= 0 && currentSlot !== slotIndex) {
        next[currentSlot] = {
          player: displaced.player,
          position: displaced.position ?? "",
        };
      }
      return next;
    });
  }

  function placePlayerInFirstOpenSlot(player: Player) {
    const openSlot = lineup.findIndex((s) => s.player == null);
    if (openSlot < 0) return;
    assignPlayerToSlot(player, openSlot);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const overId = String(over.id);
    const playerId = String(active.id);
    const player = initialPlayers.find((p) => p.id === playerId);
    if (!player) return;

    // Return to player pool: drop on the left column
    if (overId === "player-pool") {
      const currentSlot = lineup.findIndex((s) => s.player?.id === playerId);
      if (currentSlot < 0) return;
      setLineup((prev) => {
        const next = prev.map((s) => ({ ...s }));
        next[currentSlot] = { player: null, position: "" };
        return next;
      });
      return;
    }

    if (!overId.startsWith("slot-")) return;

    const slotIndex = parseInt(overId.replace("slot-", ""), 10);
    assignPlayerToSlot(player, slotIndex);
  }

  return (
    <div className="app-shell flex min-h-[calc(100dvh-5rem)] flex-col gap-3 pb-4">
      <header className="shrink-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
          {gameMode ? "Lineup" : "Lineup construction"}
        </h1>
      </header>

      {gameMode && games!.length === 0 ? (
        <div className="neo-card border border-dashed border-[var(--neo-border)] p-8 text-center">
          <p className="font-medium text-[var(--neo-text)]">No games yet</p>
          <p className="mt-2 text-sm text-[var(--neo-text-muted)]">
            Create a game in Analyst → Games, then you can set its lineup here.
          </p>
          <Link href="/analyst/games" className="mt-4 inline-block text-sm text-[var(--neo-accent)] hover:underline">
            Go to Games →
          </Link>
        </div>
      ) : null}

      {gameMode && games!.length > 0 && editableGames.length === 0 ? (
        <div className="neo-card border border-dashed border-[var(--neo-border)] p-8 text-center">
          <p className="font-medium text-[var(--neo-text)]">No open games</p>
          <p className="mt-2 text-sm text-[var(--neo-text-muted)]">
            All games are finalized. Create a new game or clear final scores on an existing game to edit its lineup
            here.
          </p>
          <Link href="/analyst/games" className="mt-4 inline-block text-sm text-[var(--neo-accent)] hover:underline">
            Go to Games →
          </Link>
        </div>
      ) : null}

      {gameMode && editableGames.length > 0 ? (
        <section className="neo-card p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
            <div className="min-w-0 w-full flex-1 lg:max-w-[min(100%,30rem)]">
              <div className="section-label">Game</div>
              <select
                value={selectedGameId ?? ""}
                onChange={(e) => setSelectedGameId(e.target.value || null)}
                className="input-tech mt-2 w-full min-w-0 rounded-lg px-3 py-2 text-sm text-[var(--neo-text)]"
                aria-label="Select game"
              >
                <option value="">Select a game</option>
                {editableGames.map((g) => (
                  <option key={g.id} value={g.id}>
                    {formatGameLabel(g)}
                  </option>
                ))}
              </select>
            </div>
            <LineupCollectiveStatsBar embedded lineupQuality={lineupQuality} />
          </div>
        </section>
      ) : null}

      {(!gameMode || editableGames.length > 0) && (
        <>
          {(!gameMode || selectedGameId) && (
            <DndContext
              sensors={sensors}
              autoScroll={false}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                {!gameMode ? (
                  <LineupCollectiveStatsBar lineupQuality={lineupQuality} />
                ) : null}

                <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,0.85fr)_minmax(0,1.5fr)] lg:gap-3 lg:items-stretch">
                  <div className="neo-card flex min-h-0 flex-col p-3">
                    <h2 className="section-label mb-2 shrink-0">
                      Available ({sortedAvailablePlayers.length})
                    </h2>
                    <PlayerPoolDropZone className="min-h-0 flex-1">
                      <AvailablePlayerGrid
                        players={sortedAvailablePlayers}
                        onAddPlayer={placePlayerInFirstOpenSlot}
                      />
                    </PlayerPoolDropZone>
                  </div>

                  <div className="neo-card flex min-h-0 flex-col gap-2 p-3">
                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                      <h2 className="section-label">Batting order</h2>
                      <LineupSaveActions
                        gameMode={gameMode}
                        templateName={templateName}
                        onTemplateNameChange={(name) => setTemplateName(name ?? "")}
                        onSave={gameMode ? handleSaveGameLineup : handleSaveTemplate}
                        onClear={clearLineup}
                        saveStatus={saveStatus}
                        saveErrorMessage={saveErrorMessage}
                        hasAnyPlayerInLineup={hasAnyPlayerInLineup}
                        saveDisabled={gameMode ? !selectedGameId : !templateName.trim()}
                      />
                    </div>
                    <LineupOrderPanel
                      className="min-h-0 flex-1"
                      lineup={lineup}
                      loading={loadingLineup}
                      positionsTakenByOthers={(i) =>
                        new Set(
                          lineup
                            .map((s, j) => (j !== i && s.player && s.position ? s.position : null))
                            .filter((p): p is string => p != null)
                        )
                      }
                      onPositionChange={setSlotPosition}
                      duplicatePositions={duplicatePositions}
                    />
                  </div>

                  <div className="neo-card flex min-h-0 min-w-0 flex-col p-3">
                    <div className="mb-2 flex shrink-0 flex-col gap-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="section-label">Roster stats</h2>
                        <span className="text-[10px] text-[var(--neo-text-muted)]">
                          In lineup · click name to add/remove
                        </span>
                      </div>
                      <RosterStatsControls
                        poolSortBy={poolSortBy}
                        poolSplitView={poolSplitView}
                        onSortChange={setPoolSortBy}
                        onSplitChange={setPoolSplitView}
                      />
                    </div>
                    <UnifiedRosterStatsTable
                      rows={rosterTableRows}
                      statsMap={poolBattingStats}
                      onAddPlayer={placePlayerInFirstOpenSlot}
                      onRemovePlayer={removePlayerFromLineup}
                    />
                  </div>
                </div>
              </div>

              <DragOverlay dropAnimation={null}>
                {activePlayer ? (
                  <div className="cursor-grabbing rounded border border-[var(--neo-border)] bg-[var(--neo-bg-card)] px-3 py-2 text-sm shadow-lg">
                    {activePlayer.name}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}

          <LineupFooterTools
            onSuggestObp={() => handleSuggestBy("obp")}
            onSuggestAvg={() => handleSuggestBy("avg")}
            suggestDisabled={initialPlayers.length === 0}
            initialSavedLineups={initialSavedLineups}
            loadStatus={loadStatus}
            onLoadTemplate={handleLoadTemplate}
            onDeleteTemplate={handleDeleteTemplate}
          />
        </>
      )}
    </div>
  );
}
