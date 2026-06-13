/** First open batting-order slot (1–9) when slots 1…N are filled consecutively. */
export function firstEmptyLineupSlot(order: string[]): number {
  if (order.length >= 9) return 9;
  return order.length + 1;
}

/** Max slot a new player can be placed into without gaps (append or replace). */
export function maxSelectableLineupSlot(order: string[]): number {
  return Math.min(9, Math.max(1, order.length + 1));
}

export function isLineupSlotSelectable(order: string[], slot: number): boolean {
  return slot >= 1 && slot <= maxSelectableLineupSlot(order);
}

/**
 * Place `playerId` in batting-order slot `slot` (1–9). Replaces occupant or appends at the next open slot.
 * Removes the player from a prior slot if they were already in the order.
 */
export function applyPlayerToLineupSlot(
  order: string[],
  positionByPlayerId: Record<string, string>,
  slot: number,
  playerId: string,
  gamePosition: string | null
): { order: string[]; positionByPlayerId: Record<string, string> } {
  const capped = Math.min(9, Math.max(1, Math.trunc(slot)));
  if (!isLineupSlotSelectable(order, capped) && capped > order.length) {
    throw new Error("Invalid lineup slot.");
  }

  const nextOrder = [...order];
  const priorIdx = nextOrder.indexOf(playerId);
  if (priorIdx >= 0) nextOrder.splice(priorIdx, 1);

  const idx = capped - 1;
  if (idx < nextOrder.length) {
    nextOrder[idx] = playerId;
  } else {
    nextOrder.push(playerId);
  }

  const nextPos = { ...positionByPlayerId };
  for (const [pid, pos] of Object.entries(nextPos)) {
    if (!nextOrder.includes(pid)) delete nextPos[pid];
  }
  const pos = gamePosition?.trim();
  if (pos) nextPos[playerId] = pos;

  return { order: nextOrder, positionByPlayerId: nextPos };
}

export function lineupSlotsForSave(
  order: string[],
  positionByPlayerId: Record<string, string>
): { player_id: string; position?: string | null }[] {
  return order.map((player_id) => ({
    player_id,
    position: positionByPlayerId[player_id]?.trim() || null,
  }));
}
