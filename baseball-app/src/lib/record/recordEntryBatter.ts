import { inferLiveLinescoreFromPAs } from "@/lib/compute/boxScore";
import { lastPaChronological } from "@/lib/compute/plateAppearanceOrder";
import { battingSideFromHalf } from "@/lib/gameBattingSide";
import type { LineupSide, PlateAppearance, Player } from "@/lib/types";
import {
  batterIdAtLineupSlot,
  firstBatterInLineupOrder,
  lineupSlotForBatterId,
} from "@/lib/record/recordLineup";

export type GameLineupOrders = {
  away: { order: string[] };
  home: { order: string[] };
};

/** Top 1st, away leadoff — used when opening Record on a game with no PAs yet. */
export function freshGameRecordBatterState(
  lineups: GameLineupOrders,
  players: Player[]
): {
  inning: number;
  inningHalf: "top";
  nextBatterIndexBySide: { away: number; home: number };
  batterId: string | null;
} {
  const awayOrder = lineups.away.order;
  const batterId =
    firstBatterInLineupOrder(awayOrder, players) ??
    firstBatterInLineupOrder(lineups.home.order, players) ??
    null;
  return {
    inning: 1,
    inningHalf: "top",
    nextBatterIndexBySide: { away: 0, home: 0 },
    batterId,
  };
}

function orderForSide(lineups: GameLineupOrders, side: LineupSide): string[] {
  return side === "away" ? lineups.away.order : lineups.home.order;
}

/** Resume batter pointer from saved PAs when there is no in-progress draft in localStorage. */
export function inferRecordBatterFromExistingPAs(
  pas: PlateAppearance[],
  lineups: GameLineupOrders,
  players: Player[]
): {
  inning: number;
  inningHalf: "top" | "bottom";
  nextBatterIndexBySide: { away: number; home: number };
  batterId: string | null;
} {
  const { liveInning, liveHalf } = inferLiveLinescoreFromPAs(pas);
  const inningHalf = liveHalf ?? "top";
  const battingSide = battingSideFromHalf(inningHalf);
  const order = orderForSide(lineups, battingSide);

  const nextBatterIndexBySide = { away: 0, home: 0 };

  if (order.length === 0) {
    const batterId =
      firstBatterInLineupOrder(lineups.away.order, players) ??
      firstBatterInLineupOrder(lineups.home.order, players) ??
      null;
    return { inning: liveInning, inningHalf, nextBatterIndexBySide, batterId };
  }

  const last = lastPaChronological(pas);
  if (!last) {
    const batterId = batterIdAtLineupSlot(order, players, 0);
    nextBatterIndexBySide[battingSide] = 0;
    return { inning: liveInning, inningHalf, nextBatterIndexBySide, batterId };
  }

  const lastHalf = last.inning_half === "bottom" ? "bottom" : "top";
  const lastSide = battingSideFromHalf(lastHalf);
  const sameHalfPointer = last.inning === liveInning && lastHalf === inningHalf;

  let slot = 0;
  if (sameHalfPointer && lastSide === battingSide) {
    slot = (lineupSlotForBatterId(order, last.batter_id) + 1) % order.length;
  }

  nextBatterIndexBySide[battingSide] = slot;
  const batterId = batterIdAtLineupSlot(order, players, slot);

  return { inning: liveInning, inningHalf, nextBatterIndexBySide, batterId };
}
