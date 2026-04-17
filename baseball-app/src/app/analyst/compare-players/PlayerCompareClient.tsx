"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { formatHeight } from "@/lib/height";
import type { AnalystPlayerSpraySplits } from "@/lib/analystPlayerSpraySplits";
import {
  PlayerSprayChartsGrid,
  type SprayPlatoonScope,
} from "@/components/analyst/PlayerSprayChartsSection";
import { comparePlayersByLastNameThenFull } from "@/lib/playerSort";
import { isPitcherPlayer } from "@/lib/opponentUtils";
import type { BattingStats, BattingStatsWithSplits, PitchingStats, PitchingStatsWithSplits, Player } from "@/lib/types";
import {
  type SprayResultFilterKey,
  parseSprayResultFilterKey,
} from "@/lib/sprayChartFilters";
import { analystPlayerProfileHref } from "@/lib/analystRoutes";
import {
  battingSheetCompareHighlight,
  battingSheetDataColumns,
  battingSheetStandardStatBorderLeft,
  formatBattingSheetDataCell,
} from "@/components/analyst/battingStatsSheetModel";
import type { CompareStatScope } from "@/components/analyst/pitchingStatsSheetModel";
import {
  comparePitchingLineFromSplits,
  formatPitchingCompareCell,
  PITCHING_COMPARE_STANDARD_COLUMNS,
  pitchingCompareStatBorderLeft,
  pitchingSheetCompareHighlight,
} from "@/components/analyst/pitchingStatsSheetModel";

export interface PlayerCompareClientProps {
  roster: Player[];
  playerA: Player | null;
  playerB: Player | null;
  battingA: BattingStatsWithSplits | null;
  battingB: BattingStatsWithSplits | null;
  pitchingA: PitchingStatsWithSplits | null;
  pitchingB: PitchingStatsWithSplits | null;
  sprayA: AnalystPlayerSpraySplits | null;
  sprayB: AnalystPlayerSpraySplits | null;
}

type CompareRosterRole = "batters" | "pitchers";

/** URL `scope` — stats table + aligned spray platoon (RISP is table-only for rates). */
export type CompareBattingScope = CompareStatScope;

function parseCompareBattingScope(raw: string | null): CompareBattingScope {
  if (raw === "vsL" || raw === "vsR" || raw === "risp") return raw;
  return "overall";
}

function compareBattingLineFromSplits(
  splits: BattingStatsWithSplits | null,
  scope: CompareBattingScope
): BattingStats | undefined {
  if (!splits) return undefined;
  if (scope === "overall") return splits.overall;
  if (scope === "vsL") return splits.vsL ?? undefined;
  if (scope === "vsR") return splits.vsR ?? undefined;
  return splits.risp ?? undefined;
}

function compareBattingScopeLabel(scope: CompareBattingScope): string {
  switch (scope) {
    case "overall":
      return "Overall";
    case "vsL":
      return "vs LHP";
    case "vsR":
      return "vs RHP";
    case "risp":
      return "RISP";
    default:
      return "Overall";
  }
}

function comparePitchingScopeLabel(scope: CompareBattingScope): string {
  switch (scope) {
    case "overall":
      return "Overall";
    case "vsL":
      return "vs LHB";
    case "vsR":
      return "vs RHB";
    case "risp":
      return "RISP";
    default:
      return "Overall";
  }
}

function sprayPlatoonForCompareScope(scope: CompareBattingScope): SprayPlatoonScope {
  if (scope === "vsL") return "vsL";
  if (scope === "vsR") return "vsR";
  return "all";
}

/** Drop targets in the batting comparison table headers (Player 1 / Player 2). */
const PANEL_DROP_A_ID = "compare-panel-slot-a";
const PANEL_DROP_B_ID = "compare-panel-slot-b";

function isDropSlotA(overId: string | number): boolean {
  return overId === PANEL_DROP_A_ID;
}

function isDropSlotB(overId: string | number): boolean {
  return overId === PANEL_DROP_B_ID;
}

/** RHP/LHP from `throws`; falls back to "P" if not set. */
function pitcherHandRoleLabel(player: Player): string {
  const t = player.throws?.trim().toUpperCase() ?? "";
  if (t.startsWith("L")) return "LHP";
  if (t.startsWith("R")) return "RHP";
  return "P";
}

/** Compact position for roster row + sidebar: pitchers show LHP/RHP (not "P"). */
function positionAbbrev(player: Player): string {
  if (isPitcherPlayer(player)) {
    const hand = pitcherHandRoleLabel(player);
    const others = (player.positions ?? []).filter((p) => p.trim().toUpperCase() !== "P");
    if (others.length === 0) return hand;
    return `${hand}/${others.slice(0, 2).join("/")}`;
  }
  if (player.positions && player.positions.length > 0) {
    return player.positions.slice(0, 2).join("/");
  }
  return "—";
}

/** Full positions line in compare table headers — replaces P with LHP/RHP. */
function compareHeaderPositionsDisplay(player: Player): string {
  if (!player.positions?.length) return "";
  if (!isPitcherPlayer(player)) return player.positions.join(", ");
  const hand = pitcherHandRoleLabel(player);
  const others = player.positions.filter((p) => p.trim().toUpperCase() !== "P");
  if (others.length === 0) return hand;
  return `${hand}, ${others.join(", ")}`;
}

function listDragId(side: "L" | "R", playerId: string): string {
  return `compare-list-${side}-${playerId}`;
}

function normalizeHand(hand: string | null | undefined): string | null {
  if (hand == null || hand === "") return null;
  const code = hand.toUpperCase();
  if (code.startsWith("L")) return "L";
  if (code.startsWith("R")) return "R";
  if (code.startsWith("S")) return "S";
  return hand;
}

function CompareSlotHeaderPlaceholder({
  variant,
  label,
}: {
  variant: "leftCol" | "rightCol";
  label: string;
}) {
  const textAlign = variant === "leftCol" ? "text-right" : "text-left";
  return (
    <div className={`min-w-0 ${textAlign}`}>
      <p className="text-sm font-medium text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-xs text-[var(--text-faint)]">Drop from a list, or into the player header in the stats table.</p>
    </div>
  );
}

function ComparePlayerBattingHeaderCell({
  player,
  variant,
}: {
  player: Player;
  variant: "leftCol" | "rightCol";
}) {
  const bats = normalizeHand(player.bats);
  const throws = normalizeHand(player.throws);
  const batsThrows =
    bats != null || throws != null ? `${bats ?? "—"} / ${throws ?? "—"}` : null;

  const textAlign = variant === "leftCol" ? "text-right" : "text-left";
  const metaJustify = variant === "leftCol" ? "justify-end" : "justify-start";
  const nameRowJustify = variant === "leftCol" ? "justify-end" : "justify-start";

  return (
    <div className={`min-w-0 ${textAlign}`}>
      <div className={`flex flex-wrap items-baseline gap-x-1.5 ${nameRowJustify}`}>
        <Link
          href={analystPlayerProfileHref(player.id)}
          className="font-display text-sm font-semibold leading-snug text-[var(--accent)] hover:underline sm:text-base"
        >
          {player.name}
        </Link>
        {player.jersey != null && player.jersey !== "" && (
          <span className="font-display text-sm font-semibold tabular-nums text-[var(--text)] sm:text-base">
            #{player.jersey}
          </span>
        )}
      </div>
      <div
        className={`mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs font-medium leading-snug text-[var(--text)] sm:text-sm ${metaJustify}`}
      >
        {player.positions && player.positions.length > 0 && (
          <span>{compareHeaderPositionsDisplay(player)}</span>
        )}
        {batsThrows && <span>{batsThrows}</span>}
        {player.height_in != null && <span>{formatHeight(player.height_in)}</span>}
        {isPitcherPlayer(player) && <span>Pitcher profile</span>}
      </div>
    </div>
  );
}

function CompareBattingHeaderDropZone({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[3.25rem] rounded-md px-0.5 py-0.5 transition-colors ${
        isOver ? "bg-[var(--accent-dim)] ring-2 ring-[var(--accent)]/50" : ""
      }`}
    >
      {children}
    </div>
  );
}

function CompareBattingThreeColumnTable({
  playerA,
  playerB,
  dataCols,
  lineA,
  lineB,
  overallA,
  overallB,
}: {
  playerA: Player | null;
  playerB: Player | null;
  dataCols: ReturnType<typeof battingSheetDataColumns>;
  lineA: BattingStats | undefined;
  lineB: BattingStats | undefined;
  overallA: BattingStats | undefined;
  overallB: BattingStats | undefined;
}) {
  const statRowBorder = (key: (typeof dataCols)[number]["key"]) =>
    battingSheetStandardStatBorderLeft(key);

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-[36%]" />
          <col className="w-[28%]" />
          <col className="w-[36%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="pb-2 pl-0 pr-1 pt-1 align-top font-normal">
              <CompareBattingHeaderDropZone id={PANEL_DROP_A_ID}>
                {playerA ? (
                  <ComparePlayerBattingHeaderCell player={playerA} variant="leftCol" />
                ) : (
                  <CompareSlotHeaderPlaceholder variant="leftCol" label="Player 1" />
                )}
              </CompareBattingHeaderDropZone>
            </th>
            <th
              className="pb-2 px-0.5 pt-2 align-top text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]"
              title="Statistic (hover row labels for definitions)"
            >
              Stat
            </th>
            <th className="pb-2 pl-1 pr-0 pt-1 align-top font-normal">
              <CompareBattingHeaderDropZone id={PANEL_DROP_B_ID}>
                {playerB ? (
                  <ComparePlayerBattingHeaderCell player={playerB} variant="rightCol" />
                ) : (
                  <CompareSlotHeaderPlaceholder variant="rightCol" label="Player 2" />
                )}
              </CompareBattingHeaderDropZone>
            </th>
          </tr>
        </thead>
        <tbody>
          {dataCols.map((col) => {
            const hiA = battingSheetCompareHighlight(col, lineA, lineB, overallA, overallB, "a");
            const hiB = battingSheetCompareHighlight(col, lineA, lineB, overallA, overallB, "b");
            const tdBase =
              "py-1 text-base tabular-nums leading-snug sm:text-[1.0625rem] sm:leading-snug";
            const tdMuted = `${tdBase} font-normal text-[var(--text)]`;
            const tdWin = `${tdBase} font-semibold italic text-[var(--compare-stat-win-fg)]`;
            return (
              <tr
                key={col.key}
                className={`border-b border-[var(--border)]/55 ${statRowBorder(col.key) ? "border-t border-[var(--border)]" : ""}`}
              >
                <td className={`pl-0 pr-1 text-right ${hiA ? tdWin : tdMuted}`}>
                  {formatBattingSheetDataCell(col, lineA, overallA)}
                </td>
                <td
                  className="py-1 px-0.5 text-center text-lg font-semibold uppercase leading-none tracking-wide text-[var(--accent)] sm:text-xl"
                  title={col.tooltip}
                >
                  {col.label}
                </td>
                <td className={`pl-1 pr-0 text-left ${hiB ? tdWin : tdMuted}`}>
                  {formatBattingSheetDataCell(col, lineB, overallB)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ComparePitchingThreeColumnTable({
  playerA,
  playerB,
  lineA,
  lineB,
}: {
  playerA: Player | null;
  playerB: Player | null;
  lineA: PitchingStats | undefined;
  lineB: PitchingStats | undefined;
}) {
  const dataCols = PITCHING_COMPARE_STANDARD_COLUMNS;
  const statRowBorder = (key: (typeof dataCols)[number]["key"]) => pitchingCompareStatBorderLeft(key);

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-[36%]" />
          <col className="w-[28%]" />
          <col className="w-[36%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="pb-2 pl-0 pr-1 pt-1 align-top font-normal">
              <CompareBattingHeaderDropZone id={PANEL_DROP_A_ID}>
                {playerA ? (
                  <ComparePlayerBattingHeaderCell player={playerA} variant="leftCol" />
                ) : (
                  <CompareSlotHeaderPlaceholder variant="leftCol" label="Player 1" />
                )}
              </CompareBattingHeaderDropZone>
            </th>
            <th
              className="pb-2 px-0.5 pt-2 align-top text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]"
              title="Statistic (hover row labels for definitions)"
            >
              Stat
            </th>
            <th className="pb-2 pl-1 pr-0 pt-1 align-top font-normal">
              <CompareBattingHeaderDropZone id={PANEL_DROP_B_ID}>
                {playerB ? (
                  <ComparePlayerBattingHeaderCell player={playerB} variant="rightCol" />
                ) : (
                  <CompareSlotHeaderPlaceholder variant="rightCol" label="Player 2" />
                )}
              </CompareBattingHeaderDropZone>
            </th>
          </tr>
        </thead>
        <tbody>
          {dataCols.map((col) => {
            const hiA = pitchingSheetCompareHighlight(col, lineA, lineB, "a");
            const hiB = pitchingSheetCompareHighlight(col, lineA, lineB, "b");
            const tdBase =
              "py-1 text-base tabular-nums leading-snug sm:text-[1.0625rem] sm:leading-snug";
            const tdMuted = `${tdBase} font-normal text-[var(--text)]`;
            const tdWin = `${tdBase} font-semibold italic text-[var(--compare-stat-win-fg)]`;
            return (
              <tr
                key={col.key}
                className={`border-b border-[var(--border)]/55 ${statRowBorder(col.key) ? "border-t border-[var(--border)]" : ""}`}
              >
                <td className={`pl-0 pr-1 text-right ${hiA ? tdWin : tdMuted}`}>
                  {formatPitchingCompareCell(col, lineA)}
                </td>
                <td
                  className="py-1 px-0.5 text-center text-lg font-semibold uppercase leading-none tracking-wide text-[var(--accent)] sm:text-xl"
                  title={col.tooltip}
                >
                  {col.label}
                </td>
                <td className={`pl-1 pr-0 text-left ${hiB ? tdWin : tdMuted}`}>
                  {formatPitchingCompareCell(col, lineB)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CompareBattingPanel({
  playerA,
  playerB,
  battingA,
  battingB,
  compareScope,
}: {
  playerA: Player | null;
  playerB: Player | null;
  battingA: BattingStatsWithSplits | null;
  battingB: BattingStatsWithSplits | null;
  compareScope: CompareBattingScope;
}) {
  const dataCols = battingSheetDataColumns("standard");
  const lineA = compareBattingLineFromSplits(battingA, compareScope);
  const lineB = compareBattingLineFromSplits(battingB, compareScope);

  const note =
    playerA && playerB && (!battingA || !battingB) ? (
      <div className="mt-2 text-sm text-[var(--text-muted)]">
        {!battingA && playerA && <p>No batting stats for {playerA.name}.</p>}
        {!battingB && playerB && <p>No batting stats for {playerB.name}.</p>}
      </div>
    ) : null;

  const missingSplit =
    (playerA && battingA && lineA == null) || (playerB && battingB && lineB == null) ? (
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        No plate appearances in this sample for one or both players (— in the table).
      </p>
    ) : null;

  return (
    <section className="card-tech mx-auto w-full max-w-xl rounded-lg border border-[var(--border)] p-3 sm:max-w-2xl sm:p-3.5">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Batting stats</h2>
      <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
        <span className="font-medium text-[var(--text)]">{compareBattingScopeLabel(compareScope)}</span>
        {compareScope === "risp" && (
          <span> (runners on 2nd / 3rd)</span>
        )}
        {" · "}
        Drag a player onto either header cell above the stats.
      </p>
      <div className="mt-2">
        <CompareBattingThreeColumnTable
          playerA={playerA}
          playerB={playerB}
          dataCols={dataCols}
          lineA={lineA}
          lineB={lineB}
          overallA={lineA}
          overallB={lineB}
        />
      </div>
      {missingSplit}
      {note}
    </section>
  );
}

function ComparePitchingPanel({
  playerA,
  playerB,
  pitchingA,
  pitchingB,
  compareScope,
}: {
  playerA: Player | null;
  playerB: Player | null;
  pitchingA: PitchingStatsWithSplits | null;
  pitchingB: PitchingStatsWithSplits | null;
  compareScope: CompareBattingScope;
}) {
  const lineA = comparePitchingLineFromSplits(pitchingA, compareScope);
  const lineB = comparePitchingLineFromSplits(pitchingB, compareScope);

  const note =
    playerA && playerB && (!pitchingA || !pitchingB) ? (
      <div className="mt-2 text-sm text-[var(--text-muted)]">
        {!pitchingA && playerA && <p>No pitching stats for {playerA.name}.</p>}
        {!pitchingB && playerB && <p>No pitching stats for {playerB.name}.</p>}
      </div>
    ) : null;

  const missingSplit =
    (playerA && pitchingA && lineA == null) || (playerB && pitchingB && lineB == null) ? (
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        No plate appearances in this sample for one or both players (— in the table).
      </p>
    ) : null;

  const noIp =
    playerA &&
    playerB &&
    pitchingA &&
    pitchingB &&
    lineA &&
    lineB &&
    lineA.ip <= 0 &&
    lineB.ip <= 0 ? (
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        No innings recorded as pitcher for this sample for either player.
      </p>
    ) : null;

  return (
    <section className="card-tech mx-auto w-full max-w-xl rounded-lg border border-[var(--border)] p-3 sm:max-w-2xl sm:p-3.5">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Pitching stats</h2>
      <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
        <span className="font-medium text-[var(--text)]">{comparePitchingScopeLabel(compareScope)}</span>
        {compareScope === "risp" && <span> (runners on 2nd / 3rd)</span>}
        {" · "}
        Drag a player onto either header cell above the stats.
      </p>
      <div className="mt-2">
        <ComparePitchingThreeColumnTable
          playerA={playerA}
          playerB={playerB}
          lineA={lineA}
          lineB={lineB}
        />
      </div>
      {missingSplit}
      {noIp}
      {note}
    </section>
  );
}

function RosterListRow({
  player,
  side,
  onPick,
}: {
  player: Player;
  side: "L" | "R";
  onPick: (player: Player) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: listDragId(side, player.id),
    data: { player },
  });

  const pos = positionAbbrev(player);

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onPick(player)}
      className={`grid w-full cursor-grab touch-manipulation grid-cols-[1fr_auto_auto] items-center gap-x-2 rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1.5 text-left text-sm text-[var(--text)] transition hover:border-[var(--accent)]/50 hover:bg-[var(--bg-elevated)] active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
      aria-label={`${side === "L" ? "Player 1" : "Player 2"} list: ${player.name}`}
    >
      <span className="min-w-0 truncate font-medium">{player.name}</span>
      <span
        className="shrink-0 min-w-[2.75rem] text-center text-xs font-semibold uppercase tracking-wide text-[var(--accent)]"
        title={player.positions?.length ? compareHeaderPositionsDisplay(player) : ""}
      >
        {pos}
      </span>
      <span className="shrink-0 w-9 text-right tabular-nums text-[var(--text-muted)]">
        {player.jersey != null && player.jersey !== "" ? `#${player.jersey}` : "—"}
      </span>
    </button>
  );
}

function CompareSidebarSelection({
  player,
  onClear,
  emptyHint,
}: {
  player: Player | null;
  onClear: () => void;
  emptyHint: string;
}) {
  if (!player) {
    return (
      <div className="mb-2 rounded-md border border-[var(--border)]/70 bg-[var(--bg-base)] px-2.5 py-2">
        <p className="text-xs leading-snug text-[var(--text-faint)]">{emptyHint}</p>
      </div>
    );
  }
  const pos = positionAbbrev(player);
  return (
    <div className="mb-2 flex items-start justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-2">
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-semibold text-[var(--accent)]">{player.name}</p>
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--accent)]">{pos}</span>
          {player.jersey != null && player.jersey !== "" && (
            <span className="text-[var(--text-muted)]"> · #{player.jersey}</span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 rounded px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text)]"
        aria-label={`Clear ${player.name}`}
      >
        Clear
      </button>
    </div>
  );
}

function playerFromActiveData(active: DragStartEvent["active"]): Player | null {
  const p = active.data.current as { player?: Player } | undefined;
  return p?.player ?? null;
}

export function PlayerCompareClient({
  roster,
  playerA,
  playerB,
  battingA,
  battingB,
  pitchingA,
  pitchingB,
  sprayA,
  sprayB,
}: PlayerCompareClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scopeParam = searchParams.get("scope");
  const compareScope = useMemo(() => parseCompareBattingScope(scopeParam), [scopeParam]);
  const sprayPlatoonScope = sprayPlatoonForCompareScope(compareScope);
  const sprayFilter = useMemo(
    () => parseSprayResultFilterKey(searchParams.get("sc")),
    [searchParams]
  );
  const [rosterRole, setRosterRole] = useState<CompareRosterRole>("batters");
  const rosterRoleRef = useRef(rosterRole);
  rosterRoleRef.current = rosterRole;
  const [activeDragPlayer, setActiveDragPlayer] = useState<Player | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const sortedRoster = useMemo(() => [...roster].sort(comparePlayersByLastNameThenFull), [roster]);

  const filteredRoster = useMemo(() => {
    if (rosterRole === "pitchers") return sortedRoster.filter(isPitcherPlayer);
    return sortedRoster.filter((p) => !isPitcherPlayer(p));
  }, [rosterRole, sortedRoster]);

  /** Show pitching stats when the roster toggle is Pitchers or both compared players are pitchers (e.g. `p1`/`p2` URL with default Batters list). */
  const compareAsPitchers = useMemo(() => {
    if (rosterRole === "pitchers") return true;
    return (
      !!playerA &&
      !!playerB &&
      isPitcherPlayer(playerA) &&
      isPitcherPlayer(playerB)
    );
  }, [rosterRole, playerA, playerB]);

  const rosterFilterMismatchHint = useMemo(() => {
    const parts: string[] = [];
    if (playerA) {
      const p = isPitcherPlayer(playerA);
      if (rosterRole === "batters" && p) {
        parts.push(`${playerA.name} (Player 1) is a pitcher — switch to Pitchers to see them in the list.`);
      }
      if (rosterRole === "pitchers" && !p) {
        parts.push(`${playerA.name} (Player 1) is not listed as a pitcher — switch to Batters to see them in the list.`);
      }
    }
    if (playerB) {
      const p = isPitcherPlayer(playerB);
      if (rosterRole === "batters" && p) {
        parts.push(`${playerB.name} (Player 2) is a pitcher — switch to Pitchers to see them in the list.`);
      }
      if (rosterRole === "pitchers" && !p) {
        parts.push(`${playerB.name} (Player 2) is not listed as a pitcher — switch to Batters to see them in the list.`);
      }
    }
    return parts.length > 0 ? parts.join(" ") : null;
  }, [playerA, playerB, rosterRole]);

  const replacePair = useCallback(
    (nextA: string, nextB: string) => {
      const p = new URLSearchParams(searchParams.toString());
      if (nextA) p.set("p1", nextA);
      else p.delete("p1");
      if (nextB) p.set("p2", nextB);
      else p.delete("p2");
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const replaceCompareScope = useCallback(
    (next: CompareBattingScope) => {
      const p = new URLSearchParams(searchParams.toString());
      if (next === "overall") p.delete("scope");
      else p.set("scope", next);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const replaceSprayFilter = useCallback(
    (next: SprayResultFilterKey) => {
      const p = new URLSearchParams(searchParams.toString());
      if (next === "hits") p.delete("sc");
      else p.set("sc", next);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const selectRosterRole = useCallback(
    (next: CompareRosterRole) => {
      if (rosterRoleRef.current !== next) {
        replacePair("", "");
      }
      setRosterRole(next);
    },
    [replacePair]
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveDragPlayer(playerFromActiveData(e.active));
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveDragPlayer(null);
      const { active, over } = e;
      const dragged = playerFromActiveData(active);
      if (!dragged || !over) return;

      if (isDropSlotA(over.id)) {
        if (playerA?.id === dragged.id) return;
        if (playerB?.id === dragged.id) replacePair(dragged.id, playerA?.id ?? "");
        else replacePair(dragged.id, playerB?.id ?? "");
        return;
      }
      if (isDropSlotB(over.id)) {
        if (playerB?.id === dragged.id) return;
        if (playerA?.id === dragged.id) replacePair(playerB?.id ?? "", dragged.id);
        else replacePair(playerA?.id ?? "", dragged.id);
      }
    },
    [playerA, playerB, replacePair]
  );

  const pickForA = useCallback(
    (p: Player) => {
      if (playerB?.id === p.id) replacePair(p.id, playerA?.id ?? "");
      else replacePair(p.id, playerB?.id ?? "");
    },
    [playerA, playerB, replacePair]
  );

  const pickForB = useCallback(
    (p: Player) => {
      if (playerA?.id === p.id) replacePair(playerB?.id ?? "", p.id);
      else replacePair(playerA?.id ?? "", p.id);
    },
    [playerA, playerB, replacePair]
  );

  const isSwitchA = playerA?.bats?.toUpperCase().startsWith("S") ?? false;
  const isSwitchB = playerB?.bats?.toUpperCase().startsWith("S") ?? false;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-8">
        <div className="flex flex-row flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">
              Compare players
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Drag onto the stats table headers or tap a roster name. Selection sticks in the URL:{" "}
              <code className="text-xs">p1</code>, <code className="text-xs">p2</code>, optional{" "}
              <code className="text-xs">scope</code>, spray <code className="text-xs">sc=hits|outs|both</code>.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <label className="flex min-w-0 items-center gap-2 text-xs">
              <span className="whitespace-nowrap font-display font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Sample
              </span>
              <select
                value={compareScope}
                onChange={(e) => replaceCompareScope(e.target.value as CompareBattingScope)}
                className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1.5 text-xs font-medium text-[var(--text)] focus:border-[var(--accent)] focus:outline-none sm:min-w-[11rem]"
                aria-label="Compare sample: overall, platoon, or RISP"
              >
                <option value="overall">Overall</option>
                <option value="vsL">{compareAsPitchers ? "vs LHB" : "vs LHP"}</option>
                <option value="vsR">{compareAsPitchers ? "vs RHB" : "vs RHP"}</option>
                <option value="risp">RISP</option>
              </select>
            </label>
            <div
              className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-0.5"
              role="group"
              aria-label="Roster list: batters or pitchers"
            >
              <button
                type="button"
                onClick={() => selectRosterRole("batters")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  rosterRole === "batters"
                    ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                Batters
              </button>
              <button
                type="button"
                onClick={() => selectRosterRole("pitchers")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  rosterRole === "pitchers"
                    ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                Pitchers
              </button>
            </div>
          </div>
        </div>

        {rosterFilterMismatchHint && (
          <p className="text-xs text-[var(--warning)]">{rosterFilterMismatchHint}</p>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)_minmax(16rem,22rem)] xl:items-start">
          <aside className="card-tech order-2 flex min-h-0 flex-col rounded-lg border border-[var(--border)] p-3 xl:order-1">
            <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Player 1
            </h2>
            <div className="mt-2">
              <CompareSidebarSelection
                player={playerA}
                onClear={() => replacePair("", playerB?.id ?? "")}
                emptyHint="Tap a player below or drag one onto the left header in the stats table."
              />
            </div>
            <p className="mt-1 text-[10px] text-[var(--text-faint)]">
              {rosterRole === "batters" ? "Batters" : "Pitchers"} — drag or tap to assign
            </p>
            <div className="mt-1 flex flex-col gap-1 pr-0.5">
              {filteredRoster.length === 0 ? (
                <p className="py-3 text-center text-xs text-[var(--text-faint)]">
                  No {rosterRole === "batters" ? "batters" : "pitchers"} on the roster.
                </p>
              ) : (
                filteredRoster.map((p) => (
                  <RosterListRow key={`L-${p.id}`} player={p} side="L" onPick={pickForA} />
                ))
              )}
            </div>
          </aside>

          <div className="order-1 flex min-w-0 flex-col gap-6 xl:order-2">
            {!compareAsPitchers ? (
              <CompareBattingPanel
                playerA={playerA}
                playerB={playerB}
                battingA={battingA}
                battingB={battingB}
                compareScope={compareScope}
              />
            ) : (
              <ComparePitchingPanel
                playerA={playerA}
                playerB={playerB}
                pitchingA={pitchingA}
                pitchingB={pitchingB}
                compareScope={compareScope}
              />
            )}
          </div>

          <aside className="card-tech order-3 flex min-h-0 flex-col rounded-lg border border-[var(--border)] p-3">
            <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Player 2
            </h2>
            <div className="mt-2">
              <CompareSidebarSelection
                player={playerB}
                onClear={() => replacePair(playerA?.id ?? "", "")}
                emptyHint="Tap a player below or drag one onto the right header in the stats table."
              />
            </div>
            <p className="mt-1 text-[10px] text-[var(--text-faint)]">
              {rosterRole === "batters" ? "Batters" : "Pitchers"} — drag or tap to assign
            </p>
            <div className="mt-1 flex flex-col gap-1 pr-0.5">
              {filteredRoster.length === 0 ? (
                <p className="py-3 text-center text-xs text-[var(--text-faint)]">
                  No {rosterRole === "batters" ? "batters" : "pitchers"} on the roster.
                </p>
              ) : (
                filteredRoster.map((p) => (
                  <RosterListRow key={`R-${p.id}`} player={p} side="R" onPick={pickForB} />
                ))
              )}
            </div>
          </aside>
        </div>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Spray charts</h2>
            <label className="flex items-center gap-2 text-xs">
              <span className="font-display uppercase tracking-wider text-white">Filter</span>
              <select
                value={sprayFilter}
                onChange={(e) => replaceSprayFilter(e.target.value as SprayResultFilterKey)}
                className="rounded border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                aria-label="Spray chart result filter"
              >
                <option value="hits">Hits</option>
                <option value="outs">Outs</option>
                <option value="both">Hits + Outs</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Same filter applies to both sides. Pitchers show BIP allowed by batter hand; hitters show BIP by opposing
            pitcher hand.
            {compareScope === "risp" && (
              <>
                {" "}
                With <span className="font-semibold text-[var(--text)]">RISP</span> selected, the{" "}
                {compareAsPitchers ? "pitching" : "batting"} stats table is runners on 2nd/3rd only; spray
                charts still use the LHP/RHP or LHB/RHB matchup split.
              </>
            )}
          </p>
          <div className="grid items-start gap-8 lg:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                {playerA?.name ?? "Player 1"}
              </h3>
              {sprayA ? (
                <PlayerSprayChartsGrid
                  spraySplits={sprayA}
                  sprayResultFilter={sprayFilter}
                  isSwitch={isSwitchA}
                  platoonScope={sprayPlatoonScope}
                  chartCompact={false}
                />
              ) : (
                <p className="text-sm text-[var(--text-muted)]">
                  {playerA ? "No spray data." : "Choose player 1 to see spray charts."}
                </p>
              )}
            </div>
            <div className="min-w-0 space-y-2">
              <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                {playerB?.name ?? "Player 2"}
              </h3>
              {sprayB ? (
                <PlayerSprayChartsGrid
                  spraySplits={sprayB}
                  sprayResultFilter={sprayFilter}
                  isSwitch={isSwitchB}
                  platoonScope={sprayPlatoonScope}
                  chartCompact={false}
                />
              ) : (
                <p className="text-sm text-[var(--text-muted)]">
                  {playerB ? "No spray data." : "Choose player 2 to see spray charts."}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragPlayer ? (
          <div className="rounded-md border border-[var(--accent)] bg-[var(--bg-card)] px-3 py-2 shadow-lg">
            <p className="font-medium text-[var(--text)]">{activeDragPlayer.name}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
