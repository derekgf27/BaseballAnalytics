import { ROSTER_POSITION_CODES } from "@/lib/rosterPositions";
import type { Player, PlayerRosterStatus } from "@/lib/types";

export const PLAYER_ROSTER_STATUSES = [
  "active",
  "injured",
  "inactive",
  "other",
] as const;

export const PLAYER_ROSTER_STATUS_LABELS: Record<PlayerRosterStatus, string> = {
  active: "Active",
  injured: "Injured",
  inactive: "Inactive",
  other: "Other",
};

export function isPlayerRosterStatus(value: string): value is PlayerRosterStatus {
  return (PLAYER_ROSTER_STATUSES as readonly string[]).includes(value);
}

/** Legacy rows may only have `is_active`; prefer `roster_status` when set. */
export function resolveRosterStatus(
  player: Pick<Player, "roster_status" | "is_active"> | null | undefined
): PlayerRosterStatus {
  if (player?.roster_status && isPlayerRosterStatus(player.roster_status)) {
    return player.roster_status;
  }
  return player?.is_active === false ? "injured" : "active";
}

export function isActiveRosterStatus(status: PlayerRosterStatus): boolean {
  return status === "active";
}

export function rosterStatusBadgeClass(status: PlayerRosterStatus): string {
  switch (status) {
    case "active":
      return "border-emerald-400/40 bg-emerald-500/10 text-emerald-200";
    case "injured":
      return "border-amber-400/40 bg-amber-500/10 text-amber-200";
    case "inactive":
      return "border-slate-400/40 bg-slate-500/10 text-slate-200";
    case "other":
      return "border-[var(--border)] bg-[var(--bg-elevated)]/40 text-[var(--text-muted)]";
  }
}

export function getPlayerPrimaryPosition(
  player: Pick<Player, "primary_position" | "positions"> | null | undefined
): string | null {
  if (!player) return null;
  const primary = player.primary_position?.trim();
  if (primary) return primary;
  return player.positions?.[0] ?? null;
}

/** Puts primary first; drops primary from array if not in selected list. */
export function orderPositionsWithPrimary(
  positions: string[],
  primaryPosition: string | null | undefined
): string[] {
  const unique = [...new Set(positions.filter(Boolean))];
  const primary = primaryPosition?.trim();
  if (!primary || !unique.includes(primary)) return unique;
  return [primary, ...unique.filter((p) => p !== primary)];
}

export function normalizePrimaryPosition(
  positions: string[],
  primaryPosition: string | null | undefined
): string | null {
  const ordered = orderPositionsWithPrimary(positions, primaryPosition);
  return ordered[0] ?? null;
}

export function formatPositionsDisplay(
  player: Pick<Player, "positions" | "primary_position">
): string {
  const ordered = orderPositionsWithPrimary(
    player.positions ?? [],
    getPlayerPrimaryPosition(player)
  );
  return ordered.join(", ");
}

const STAFF_NOTES_MAX = 500;

export function trimStaffNotes(notes: string | null | undefined): string | null {
  const t = notes?.trim() ?? "";
  if (!t) return null;
  return t.slice(0, STAFF_NOTES_MAX);
}

export function preparePlayerRosterPayload(input: {
  positions: string[];
  primary_position?: string | null;
  roster_status: PlayerRosterStatus;
}): Pick<Player, "positions" | "primary_position" | "roster_status" | "is_active"> {
  const positions = orderPositionsWithPrimary(input.positions, input.primary_position);
  const primary_position = normalizePrimaryPosition(positions, input.primary_position);
  const roster_status = input.roster_status;
  return {
    positions,
    primary_position,
    roster_status,
    is_active: isActiveRosterStatus(roster_status),
  };
}

export function isValidRosterPrimaryPosition(
  primary: string | null | undefined,
  positions: string[]
): boolean {
  if (!primary?.trim()) return true;
  const code = primary.trim().toUpperCase();
  if (!(ROSTER_POSITION_CODES as readonly string[]).includes(code)) return false;
  return positions.includes(code);
}
