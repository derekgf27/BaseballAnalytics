import { resolveRosterStatus } from "@/lib/playerRoster";
import type { Player } from "@/lib/types";

/**
 * Roster-style display names: sort by last name, then full string for ties.
 * Uses the last word as last name ("Kenneth Lozada" → "lozada"); treats common
 * suffixes so "John Smith Jr." sorts by "Smith".
 */

const NAME_SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"]);

function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/\./g, "");
}

/** Lowercased string used for comparing last names (not for display). */
export function playerLastNameSortKey(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0]!.toLowerCase();

  let last = parts[parts.length - 1]!;
  if (parts.length >= 2 && NAME_SUFFIXES.has(normalizeToken(last))) {
    last = parts[parts.length - 2]!;
  }
  return last.toLowerCase();
}

/** Alphabetical by last name, then by full name. */
export function comparePlayersByLastNameThenFull(a: { name: string }, b: { name: string }): number {
  const la = playerLastNameSortKey(a.name);
  const lb = playerLastNameSortKey(b.name);
  const c = la.localeCompare(lb, undefined, { sensitivity: "base" });
  if (c !== 0) return c;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export type RosterSortKey = "name" | "jersey" | "position" | "status" | "bats" | "throws";
export type RosterSortDir = "asc" | "desc";

const ROSTER_STATUS_ORDER: Record<string, number> = {
  active: 0,
  injured: 1,
  inactive: 2,
  other: 3,
};

function jerseySortKey(jersey: string | null | undefined): number {
  const raw = jersey?.trim();
  if (!raw) return Number.POSITIVE_INFINITY;
  const n = parseInt(raw.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function handSortKey(hand: string | null | undefined): string {
  const h = hand?.trim().toUpperCase() ?? "";
  if (h === "L") return "0";
  if (h === "R") return "1";
  if (h === "S") return "2";
  return "9";
}

/** Compare two roster rows for list sorting (call with `dir` applied by caller). */
export function compareRosterPlayers(a: Player, b: Player, key: RosterSortKey): number {
  switch (key) {
    case "name":
      return comparePlayersByLastNameThenFull(a, b);
    case "jersey": {
      const c = jerseySortKey(a.jersey) - jerseySortKey(b.jersey);
      return c !== 0 ? c : comparePlayersByLastNameThenFull(a, b);
    }
    case "position": {
      const pa = (a.primary_position ?? a.positions[0] ?? "").trim();
      const pb = (b.primary_position ?? b.positions[0] ?? "").trim();
      const c = pa.localeCompare(pb, undefined, { sensitivity: "base" });
      return c !== 0 ? c : comparePlayersByLastNameThenFull(a, b);
    }
    case "status": {
      const sa = ROSTER_STATUS_ORDER[resolveRosterStatus(a)];
      const sb = ROSTER_STATUS_ORDER[resolveRosterStatus(b)];
      const c = sa - sb;
      return c !== 0 ? c : comparePlayersByLastNameThenFull(a, b);
    }
    case "bats": {
      const c = handSortKey(a.bats).localeCompare(handSortKey(b.bats));
      return c !== 0 ? c : comparePlayersByLastNameThenFull(a, b);
    }
    case "throws": {
      const c = handSortKey(a.throws).localeCompare(handSortKey(b.throws));
      return c !== 0 ? c : comparePlayersByLastNameThenFull(a, b);
    }
  }
}
