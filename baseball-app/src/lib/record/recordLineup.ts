import { isPitcherPlayer } from "@/lib/opponentUtils";
import type { Player } from "@/lib/types";

export function lineupSlotForBatterId(order: string[], batterId: string | null): number {
  if (!batterId || order.length === 0) return 0;
  const slot = order.indexOf(batterId);
  return slot >= 0 ? slot : 0;
}

export function batterIdAtLineupSlot(order: string[], players: Player[], slot: number): string | null {
  if (order.length === 0) return null;
  const normalized = ((slot % order.length) + order.length) % order.length;
  const id = order[normalized];
  if (!id) return null;
  const p = players.find((pl) => pl.id === id);
  return p != null && !isPitcherPlayer(p) ? id : null;
}

/** First non-pitcher in batting-order array (skips SP/RP rows if present in `order`). */
export function firstBatterInLineupOrder(order: string[], players: Player[]): string | null {
  for (let i = 0; i < order.length; i++) {
    const id = batterIdAtLineupSlot(order, players, i);
    if (id) return id;
  }
  return null;
}
