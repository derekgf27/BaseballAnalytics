"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BaseStateSelector } from "@/components/shared/BaseStateSelector";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { BoxScoreLine } from "@/components/analyst/BoxScoreLine";
import {
  BattingPitchMixCard,
  CurrentBatterPitchDataCard,
  PitchingPitchMixSupplement,
} from "@/components/analyst/BattingPitchMixCard";
import { GameBattingTable } from "@/components/analyst/GameBattingTable";
import { GamePitchingBoxTable } from "@/components/analyst/GamePitchingBoxTable";
import { RecordPitcherChangeModal } from "@/components/analyst/RecordPitcherChangeModal";
import { RecordSubstitutionModal } from "@/components/analyst/RecordSubstitutionModal";
import { ReachedOnErrorFielderModal } from "@/components/analyst/ReachedOnErrorFielderModal";
import { PitchTrackerSequence } from "@/components/analyst/PitchTrackerSequence";
import { formatDateMMDDYYYY } from "@/lib/format";
import { isGameFinalized } from "@/lib/gameRecord";
import { analystGameLogHref, analystGameReviewHref } from "@/lib/analystRoutes";
import { clearPAsForGameAction } from "@/app/analyst/games/actions";
import { isDemoId } from "@/lib/db/mockData";
import { plateAppearancesForPitchingSide } from "@/lib/compute/gamePitchingBox";
import { inferLiveLinescoreFromPAs, totalRunsBottom, totalRunsTop } from "@/lib/compute/boxScore";
import { pitchEventsFromDraftPitchLog } from "@/lib/compute/contactProfileFromPas";
import {
  hasPutawayStrikeAtTwoStrikes,
  isPitchOutcomeBlockedByFullCount,
  replayCountAtEndOfSequence,
  resultImpliesBattedBallInPlay,
  summarizePitchSequence,
  withInferredInPlayPitch,
  type PitchSequenceEntry,
} from "@/lib/compute/pitchSequence";
import { battingSideFromHalf, nextHalfInningAfterThreeOuts } from "@/lib/gameBattingSide";
import { INNING_SELECT_VALUES, MAX_SELECTABLE_INNING, REGULATION_INNINGS } from "@/lib/leagueConfig";
import {
  newPitchTrackerGroupId,
  readStoredPitchTrackerGroupId,
  writeStoredPitchTrackerGroupId,
} from "@/lib/pitchTrackerSession";
import {
  pitchTrackerAbbrev,
  pitchTrackerTypeChipClass,
  pitchTrackerTypeLabel,
} from "@/lib/pitchTrackerUi";
import { usePitchTrackerRows } from "@/hooks/usePitchTrackerRows";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  RESULT_ALLOWS_HIT_DIRECTION,
  RESULT_IS_HIT,
} from "@/lib/paResultSets";
import {
  isClubRosterPlayer,
  isPitcherPlayer,
  pitchersForGameTeamSide,
  playersForGameSideWhenNoLineup,
} from "@/lib/opponentUtils";
import type {
  Game,
  LineupSide,
  Player,
  PlateAppearance,
  PAResult,
  BaseState,
  BattedBallType,
  HitDirection,
  BaserunningEvent,
  BaserunningEventInsert,
  PitchEvent,
  PitchEventDraft,
  PitchOutcome,
  Throws,
} from "@/lib/types";

const RESULT_OPTIONS: { value: PAResult; label: string }[] = [
  { value: "single", label: "1B" },
  { value: "double", label: "2B" },
  { value: "triple", label: "3B" },
  { value: "hr", label: "HR" },
  { value: "out", label: "Out" },
  { value: "so", label: "SO" },
  { value: "gidp", label: "GIDP" },
  { value: "bb", label: "BB" },
  { value: "ibb", label: "IBB" },
  { value: "hbp", label: "HBP" },
  { value: "sac_fly", label: "Sac. Fly" },
  { value: "sac_bunt", label: "Sac. Bunt" },
  { value: "reached_on_error", label: "Reached on error" },
  { value: "fielders_choice", label: "FC" },
];

/** 1→1B … 9→9th option; 0→10th (HBP). Indices ≥10 have no digit shortcut. */
function outcomeIndexFromDigitKey(key: string): number | null {
  if (key < "0" || key > "9") return null;
  const n = Number(key);
  return n === 0 ? 9 : n - 1;
}

/** Result options grouped for Outcome section (Hits, Outs, Reach, Other). */
const RESULT_GROUPS: { label: string; options: { value: PAResult; label: string }[] }[] = [
  { label: "Hits", options: RESULT_OPTIONS.filter((o) => ["single", "double", "triple", "hr"].includes(o.value)) },
  { label: "Outs", options: RESULT_OPTIONS.filter((o) => ["out", "so", "gidp"].includes(o.value)) },
  {
    label: "Reach",
    options: RESULT_OPTIONS.filter((o) =>
      ["bb", "ibb", "hbp", "reached_on_error"].includes(o.value)
    ),
  },
  {
    label: "Other",
    options: RESULT_OPTIONS.filter((o) => ["sac_fly", "sac_bunt", "fielders_choice"].includes(o.value)),
  },
];

const RESULT_IS_OUT = new Set<PAResult>(["out", "so", "so_looking", "gidp"]);

/**
 * These plays only make sense with at least one baserunner: GIDP, FC, and sacrifices
 * (SF/SH advance or score a runner; none apply with bases empty).
 */
function requiresRunnerOnBaseForResult(value: PAResult): boolean {
  return (
    value === "gidp" ||
    value === "fielders_choice" ||
    value === "sac_fly" ||
    value === "sac_bunt"
  );
}

/** BB needs 3 balls; strikeout needs 2 strikes (final count before that outcome). */
function resultBlockedByPitchCount(value: PAResult, balls: number, strikes: number): boolean {
  if (value === "so" || value === "so_looking") return strikes < 2;
  if (value === "bb") return balls < 3;
  return false;
}

function pitchCountBlockHint(value: PAResult, balls: number, strikes: number): string | undefined {
  if (value === "so" || value === "so_looking") {
    return strikes < 2 ? "Set strikes to 2 before recording a strikeout." : undefined;
  }
  if (value === "bb") {
    return balls < 3 ? "Set balls to 3 before recording a walk (BB)." : undefined;
  }
  return undefined;
}
/** Results that add one out (used to advance outs/inning after save). */
const RESULT_ADDS_ONE_OUT = new Set<PAResult>([
  "out",
  "so",
  "so_looking",
  "sac_fly",
  "sac_bunt",
  "sac",
  "fielders_choice",
]);

function normBaseStateBits(baseState: BaseState): string {
  return String(baseState)
    .replace(/[^01]/g, "0")
    .padStart(3, "0")
    .slice(0, 3);
}

/** Compute new runner IDs after a play (for 1st, 2nd, 3rd). Used to advance state after save. */
function getRunnerIdsAfterResult(
  runner1b: string | null,
  runner2b: string | null,
  runner3b: string | null,
  batterId: string,
  result: PAResult,
  baseStateBefore: BaseState,
  rbi: number
): [string | null, string | null, string | null] {
  if (result === "hr") return [null, null, null];
  if (result === "triple") return [null, null, batterId];
  if (result === "double") {
    // Must match `baseStateFromRunnerIds` for this slot pattern (lead runner to 3rd).
    if (normBaseStateBits(baseStateBefore) === "100" && rbi === 0) {
      return [null, batterId, runner1b];
    }
    return [null, batterId, null];
  }
  if (result === "single" || result === "other" || result === "reached_on_error") {
    return [batterId, runner1b, runner2b]; // batter to 1st; other runners advance (user can adjust manually for ROE)
  }
  if (result === "bb" || result === "ibb" || result === "hbp") {
    // Free pass: only forced runners advance.
    // Example: runner on 2nd only -> stays on 2nd; batter to 1st.
    let next2 = runner2b;
    let next3 = runner3b;
    if (runner1b) {
      if (runner2b) next3 = runner2b; // 2B forced to 3B (3B forced home if occupied)
      next2 = runner1b; // 1B forced to 2B
    }
    return [batterId, next2, next3];
  }
  if (result === "sac_fly" || result === "sac") {
    return [runner1b, runner2b, null]; // runner from 3rd scores
  }
  if (result === "sac_bunt") {
    return [batterId, runner1b, runner2b ?? runner3b]; // advance, 3rd might score
  }
  if (result === "gidp") {
    // Batter and runner from 1st are out; runners on 2nd/3rd unchanged (user may adjust in UI).
    return [null, runner2b, runner3b];
  }
  return [runner1b, runner2b, runner3b]; // out, so: no change
}

/** 1st / 2nd / 3rd occupancy bits from runner ids (must stay in sync with `baseState`). */
function baseStateFromRunnerIds(
  r1: string | null,
  r2: string | null,
  r3: string | null
): BaseState {
  return `${r1 ? "1" : "0"}${r2 ? "1" : "0"}${r3 ? "1" : "0"}` as BaseState;
}

/** After save: anyone in `runs_scored_player_ids` is off the basepaths for the next PA. */
function clearScoredRunnersFromSlots(
  r1: string | null,
  r2: string | null,
  r3: string | null,
  scorerIds: string[]
): [string | null, string | null, string | null] {
  if (scorerIds.length === 0) return [r1, r2, r3];
  const s = new Set(scorerIds);
  return [
    r1 && !s.has(r1) ? r1 : null,
    r2 && !s.has(r2) ? r2 : null,
    r3 && !s.has(r3) ? r3 : null,
  ];
}

/** True if the base the runner would steal to already has a runner (bits or runner ID). */
function stealDestinationOccupied(
  baseIndex: 0 | 1 | 2,
  runner1b: string | null,
  runner2b: string | null,
  runner3b: string | null,
  baseState: string
): boolean {
  const b = baseState.padStart(3, "0").slice(0, 3);
  const bits = b.split("").map((c) => c === "1");
  if (baseIndex === 0) return bits[1] || runner2b != null;
  if (baseIndex === 1) return bits[2] || runner3b != null;
  return false;
}

/** Validate SB before save: runner must be on that base; next base must be free (except steal of home from 3rd). */
function validateStealAttempt(
  baseIndex: 0 | 1 | 2,
  runnerId: string,
  runner1b: string | null,
  runner2b: string | null,
  runner3b: string | null,
  baseState: string
): { ok: true } | { ok: false; message: string } {
  if (baseIndex === 0) {
    if (runner1b !== runnerId) return { ok: false, message: "Select the runner who is on 1st base." };
    if (stealDestinationOccupied(baseIndex, runner1b, runner2b, runner3b, baseState)) {
      return { ok: false, message: "2nd base is occupied — a runner can’t steal there until it’s clear." };
    }
    return { ok: true };
  }
  if (baseIndex === 1) {
    if (runner2b !== runnerId) return { ok: false, message: "Select the runner who is on 2nd base." };
    if (stealDestinationOccupied(baseIndex, runner1b, runner2b, runner3b, baseState)) {
      return { ok: false, message: "3rd base is occupied — a runner can’t steal there until it’s clear." };
    }
    return { ok: true };
  }
  if (runner3b !== runnerId) return { ok: false, message: "Select the runner who is on 3rd base." };
  return { ok: true };
}

/**
 * After SB, move the runner one base in the UI (1st→2nd, 2nd→3rd, 3rd→clear).
 * Returns null if the next base is occupied (except steal of home) or runner ID mismatch.
 */
function advanceRunnersAfterStolenBase(
  baseIndex: 0 | 1 | 2,
  runnerId: string,
  runner1b: string | null,
  runner2b: string | null,
  runner3b: string | null,
  baseState: string
): { runner1b: string | null; runner2b: string | null; runner3b: string | null; baseState: BaseState } | null {
  const b = baseState.padStart(3, "0").slice(0, 3);
  const bits = b.split("").map((c) => c === "1");
  const bitsToState = (nb: boolean[]): BaseState =>
    nb.map((x) => (x ? "1" : "0")).join("") as BaseState;

  if (baseIndex === 0) {
    if (runner1b !== runnerId) return null;
    if (bits[1] || runner2b != null) return null;
    const newBits = [false, true, bits[2]];
    return {
      runner1b: null,
      runner2b: runnerId,
      runner3b,
      baseState: bitsToState(newBits),
    };
  }
  if (baseIndex === 1) {
    if (runner2b !== runnerId) return null;
    if (bits[2] || runner3b != null) return null;
    const newBits = [bits[0], false, true];
    return {
      runner1b,
      runner2b: null,
      runner3b: runnerId,
      baseState: bitsToState(newBits),
    };
  }
  if (runner3b !== runnerId) return null;
  const newBits = [bits[0], bits[1], false];
  return {
    runner1b,
    runner2b,
    runner3b: null,
    baseState: bitsToState(newBits),
  };
}

/** After CS, remove that runner from the base path (they are out on the attempt). */
function removeRunnerAfterCaughtStealing(
  baseIndex: 0 | 1 | 2,
  runnerId: string,
  runner1b: string | null,
  runner2b: string | null,
  runner3b: string | null,
  baseState: string
): { runner1b: string | null; runner2b: string | null; runner3b: string | null; baseState: BaseState } | null {
  const b = baseState.padStart(3, "0").slice(0, 3);
  const bits = b.split("").map((c) => c === "1");
  const bitsToState = (nb: boolean[]): BaseState =>
    nb.map((x) => (x ? "1" : "0")).join("") as BaseState;

  if (baseIndex === 0) {
    if (runner1b !== runnerId) return null;
    const newBits = [false, bits[1], bits[2]];
    return {
      runner1b: null,
      runner2b,
      runner3b,
      baseState: bitsToState(newBits),
    };
  }
  if (baseIndex === 1) {
    if (runner2b !== runnerId) return null;
    const newBits = [bits[0], false, bits[2]];
    return {
      runner1b,
      runner2b: null,
      runner3b,
      baseState: bitsToState(newBits),
    };
  }
  if (runner3b !== runnerId) return null;
  const newBits = [bits[0], bits[1], false];
  return {
    runner1b,
    runner2b,
    runner3b: null,
    baseState: bitsToState(newBits),
  };
}

const PLAY_PRESETS = [
  "4-3",
  "6-3",
  "5-3",
  "3-1",
  "1-3",
  "6-4-3",
  "4-6-3",
  "5-4-3",
  "F7",
  "F8",
  "F9",
  "3U",
  "K",
  "ꓘ",
];


/** Format digit-only play input (e.g. "531") to dashed form ("5-3-1"). */
function formatPlayWithDashes(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && /^\d+$/.test(trimmed)) {
    return trimmed.split("").join("-");
  }
  return null;
}

const PLAY_ABBREVIATIONS: Record<string, string> = {
  dp: "6-4-3",
  "4-6-3": "4-6-3",
  "4-3": "4-3",
  "6-3": "6-3",
  "5-3": "5-3",
  "3-1": "3-1",
  f7: "F7",
  f8: "F8",
  f9: "F9",
  "3u": "3U",
  k: "K",
  kl: "ꓘ",
  "1-3": "1-3",
  ipo: "4-3",
  go: "4-3",
};

async function persistPitchTrackerGroupToGame(gameId: string, groupId: string) {
  if (isDemoId(gameId)) return;
  const sb = getSupabaseBrowserClient();
  if (!sb) return;
  await sb.from("games").update({ pitch_tracker_group_id: groupId }).eq("id", gameId);
}

async function persistPitchTrackerBatterToGame(gameId: string, batterId: string | null) {
  if (isDemoId(gameId)) return;
  const sb = getSupabaseBrowserClient();
  if (!sb) return;
  await sb.from("games").update({ pitch_tracker_batter_id: batterId }).eq("id", gameId);
}

async function persistPitchTrackerOutsToGame(gameId: string, outs: number) {
  if (isDemoId(gameId)) return;
  const sb = getSupabaseBrowserClient();
  if (!sb) return;
  const o = Math.max(0, Math.min(2, Math.trunc(outs)));
  await sb.from("games").update({ pitch_tracker_outs: o }).eq("id", gameId);
}

async function persistPitchTrackerCountToGame(gameId: string, balls: number, strikes: number) {
  if (isDemoId(gameId)) return;
  const sb = getSupabaseBrowserClient();
  if (!sb) return;
  const b = Math.max(0, Math.min(3, Math.trunc(balls)));
  const s = Math.max(0, Math.min(3, Math.trunc(strikes)));
  const { error } = await sb
    .from("games")
    .update({ pitch_tracker_balls: b, pitch_tracker_strikes: s })
    .eq("id", gameId);
  if (error) {
    console.warn("[Record] Could not sync pitch_tracker count:", error.message);
  }
}

async function persistPitchTrackerPitcherToGame(gameId: string, pitcherId: string | null) {
  if (isDemoId(gameId)) return;
  const sb = getSupabaseBrowserClient();
  if (!sb) return;
  const { error } = await sb.from("games").update({ pitch_tracker_pitcher_id: pitcherId }).eq("id", gameId);
  if (error) {
    console.warn("[Record] Could not sync pitch_tracker_pitcher_id:", error.message);
  }
}

interface RecordPageClientProps {
  games: Game[];
  players: Player[];
  /** Game to record (from `?gameId=`). No in-form game switching — open from Games → Log → Record. */
  initialGameId?: string;
  fetchPAsForGame: (gameId: string) => Promise<{
    pas: PlateAppearance[];
    pitchEvents: PitchEvent[];
  }>;
  fetchGameLineupOrder: (gameId: string) => Promise<{
    away: { order: string[]; positionByPlayerId: Record<string, string> };
    home: { order: string[]; positionByPlayerId: Record<string, string> };
  }>;
  savePlateAppearance: (
    pa: Omit<PlateAppearance, "id" | "created_at">,
    pitchLog?: PitchEventDraft[]
  ) => Promise<{ ok: boolean; error?: string; pa?: PlateAppearance }>;
  deletePlateAppearance: (paId: string) => Promise<{ ok: boolean; error?: string }>;
  fetchBaserunningEventsForGame: (gameId: string) => Promise<BaserunningEvent[]>;
  saveBaserunningEventAction: (
    row: BaserunningEventInsert
  ) => Promise<{ ok: boolean; error?: string; event?: BaserunningEvent }>;
  deleteBaserunningEventAction: (id: string) => Promise<{ ok: boolean; error?: string }>;
  saveRecordGameLineup: (
    gameId: string,
    side: LineupSide,
    slots: { player_id: string; position?: string | null }[]
  ) => Promise<{ ok: boolean; error?: string }>;
  finalizeGameScore: (
    gameId: string,
    finalHome: number,
    finalAway: number
  ) => Promise<{ ok: boolean; error?: string }>;
  linkPitchTrackerGroupToPa: (
    trackerGroupId: string,
    paId: string
  ) => Promise<{ ok: boolean; error?: string }>;
}

/** Batter credited with 1B–3B; optional `error_fielder_id` for an extra base (e.g. single + throw E). */
const RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT = new Set<PAResult>(["single", "double", "triple"]);

/** This PA includes a charged error (ROE, or 1B–3B with optional fielder). */
function recordPaShowsUnearnedRunControls(
  result: PAResult | null,
  errorFielderId: string | null
): boolean {
  if (result == null) return false;
  if (result === "reached_on_error") return true;
  return Boolean(errorFielderId && RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT.has(result));
}

/** Any saved PA in this half-inning already has an error (for “earlier in inning” unearned situations). */
function halfInningHadPriorErrorFromPas(
  pas: PlateAppearance[],
  gameId: string,
  inning: number,
  inningHalf: "top" | "bottom"
): boolean {
  return pas.some((pa) => {
    if (pa.game_id !== gameId || pa.inning !== inning) return false;
    const paHalf = pa.inning_half === "bottom" ? "bottom" : "top";
    if (paHalf !== inningHalf) return false;
    if (pa.result === "reached_on_error") return true;
    const fid = pa.error_fielder_id;
    return typeof fid === "string" && fid.length > 0;
  });
}

function computeShowEarnedUnearnedRunControls(
  pas: PlateAppearance[],
  gameId: string,
  inning: number,
  inningHalf: "top" | "bottom",
  result: PAResult | null,
  errorFielderId: string | null
): boolean {
  return (
    halfInningHadPriorErrorFromPas(pas, gameId, inning, inningHalf) ||
    recordPaShowsUnearnedRunControls(result, errorFielderId)
  );
}

function hasRunnersOnBaseForm(baseState: string): boolean {
  const b = baseState.padStart(3, "0").slice(0, 3);
  return b.includes("1");
}

/** Runner player ids currently occupying 1st / 2nd / 3rd per diamond state (not the batter at the plate). */
function occupiedRunnerIdsFromForm(
  baseState: string,
  runner1b: string | null,
  runner2b: string | null,
  runner3b: string | null
): string[] {
  const b = baseState.padStart(3, "0").slice(0, 3);
  const out: string[] = [];
  if (b[0] === "1" && runner1b) out.push(runner1b);
  if (b[1] === "1" && runner2b) out.push(runner2b);
  if (b[2] === "1" && runner3b) out.push(runner3b);
  return out;
}

const BATTED_BALL_TYPE_OPTIONS: { value: BattedBallType; label: string; title: string }[] = [
  { value: "ground_ball", label: "GB", title: "Ground ball (GB)" },
  { value: "line_drive", label: "LD", title: "Line drive (LD)" },
  { value: "fly_ball", label: "FB", title: "Fly ball (FB)" },
  { value: "infield_fly", label: "IFF", title: "Infield fly (IFF)" },
];

function parsePersistedBattedBallType(raw: unknown): BattedBallType | null {
  const v = raw as string | null | undefined;
  if (v !== "ground_ball" && v !== "line_drive" && v !== "fly_ball" && v !== "infield_fly") return null;
  return v;
}

/** Shown after save so you can verify who scored (matches DB `runs_scored_player_ids`). */
type LastSavedPaSummary = {
  inning: number;
  inningHalf: "top" | "bottom" | null;
  batterName: string;
  pitcherName: string;
  resultLabel: string;
  countLabel: string;
  pitchLine: string;
  hitDirectionLabel: string | null;
  /** Defensive player charged with an error (ROE or optional hit + E). */
  errorFielderName: string | null;
  notes: string | null;
  rbi: number;
  runsScoredNames: string[];
  /** Scorers marked unearned (for pitcher ERA). */
  unearnedRunsScoredNames: string[];
};

type PersistedRecordFormState = {
  inning: number;
  inningHalf: "top" | "bottom";
  outs: number;
  baseState: BaseState;
  runnerOn1bId: string | null;
  runnerOn2bId: string | null;
  runnerOn3bId: string | null;
  batterId: string | null;
  result: PAResult | null;
  countBalls: number;
  countStrikes: number;
  rbi: number;
  runsScoredPlayerIds: string[];
  /** Subset of `runsScoredPlayerIds` — unearned vs pitcher (ERA). */
  unearnedRunsScoredPlayerIds?: string[];
  /** Auto inherited-runner R/ER (prior pitcher + runner ids still on base). */
  inheritedForPriorPitcher?: { chargeId: string | null; runnerIds: string[] };
  hitDirection: HitDirection | null;
  battedBallType: BattedBallType | null;
  pitcherId: string | null;
  pitcherBySide: { home: string | null; away: string | null };
  pitchesSeen: number | "";
  strikesThrown: number | "";
  firstCountFromZero: "ball" | "strike" | null;
  playNote: string;
  notes: string;
  /** Defensive player charged with E (ROE required; optional on 1B–3B for extra-base errors). */
  errorFielderId: string | null;
  nextBatterIndexBySide: { away: number; home: number };
  battingTablePeekOther: boolean;
  /** Pitch-by-pitch draft (no client keys). */
  draftPitchLogRows?: { balls_before: number; strikes_before: number; outcome: PitchOutcome }[];
};

type DraftPitchRow = PitchSequenceEntry & { clientKey: string };

/** HBP and batted-ball outcomes use PA Result only — `in_play` is inferred on save when relevant. */
const PITCH_LOG_BUTTONS: { outcome: PitchOutcome; label: string; title: string }[] = [
  { outcome: "ball", label: "Ball", title: "Ball (no swing)" },
  { outcome: "called_strike", label: "Called", title: "Called strike" },
  { outcome: "swinging_strike", label: "Whiff", title: "Swinging strike" },
  { outcome: "foul", label: "Foul", title: "Foul ball" },
];

function recordFormStorageKey(gameId: string): string {
  return `record-form-state:${gameId}`;
}

function hasPersistedRecordFormState(gameId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(recordFormStorageKey(gameId)) != null;
}

const RECORD_WORKFLOW_DEFAULTS_KEY = "record-workflow-defaults:v1";

/** Saved after each PA so reopening a game without a draft blob can restore game state. */
type RecordResumeSnapshotV1 = {
  inning: number;
  inningHalf: "top" | "bottom";
  outs: number;
  baseState: BaseState;
  runnerOn1bId: string | null;
  runnerOn2bId: string | null;
  runnerOn3bId: string | null;
  nextBatterIndexBySide: { away: number; home: number };
  pitcherBySide: { home: string | null; away: string | null };
};

type RecordWorkflowDefaultsV1 = {
  resumeSnapshotByGameId?: Record<string, RecordResumeSnapshotV1>;
  lastBattedBallType?: BattedBallType | null;
};

function readWorkflowDefaults(): RecordWorkflowDefaultsV1 {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(RECORD_WORKFLOW_DEFAULTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as RecordWorkflowDefaultsV1;
  } catch {
    return {};
  }
}

function writeWorkflowDefaults(next: RecordWorkflowDefaultsV1) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECORD_WORKFLOW_DEFAULTS_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

/** Cross-session hints when this game has no `record-form-state` blob yet. */
function mergeWorkflowDefaultsForGame(
  gameId: string,
  slice: {
    resumeSnapshot?: RecordResumeSnapshotV1;
    lastBattedBallType?: BattedBallType | null;
  }
) {
  const cur = readWorkflowDefaults();
  const next: RecordWorkflowDefaultsV1 = { ...cur };
  if (slice.resumeSnapshot) {
    next.resumeSnapshotByGameId = {
      ...(cur.resumeSnapshotByGameId ?? {}),
      [gameId]: slice.resumeSnapshot,
    };
  }
  if (slice.lastBattedBallType !== undefined) {
    next.lastBattedBallType = slice.lastBattedBallType;
  }
  writeWorkflowDefaults(next);
}

function isTypingInFormField(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  if (target.closest("[data-record-shortcuts-ignore]")) return true;
  return false;
}

function throwsToPitcherHand(t: Throws | null | undefined): "L" | "R" | null {
  if (t === "L" || t === "R") return t;
  return null;
}

export default function RecordPageClient({
  games,
  players,
  initialGameId,
  fetchPAsForGame,
  fetchGameLineupOrder,
  savePlateAppearance,
  deletePlateAppearance,
  fetchBaserunningEventsForGame,
  saveBaserunningEventAction,
  deleteBaserunningEventAction,
  saveRecordGameLineup,
  finalizeGameScore,
  linkPitchTrackerGroupToPa,
}: RecordPageClientProps) {
  const router = useRouter();
  /** Fixed for this page load from URL; use Games → Log to change game. */
  const selectedGameId = initialGameId ?? null;
  const [inning, setInning] = useState(1);
  const [inningHalf, setInningHalf] = useState<"top" | "bottom">("top");
  const [outs, setOuts] = useState(0);
  const [baseState, setBaseState] = useState<BaseState>("000");
  const [runnerOn1bId, setRunnerOn1bId] = useState<string | null>(null);
  const [runnerOn2bId, setRunnerOn2bId] = useState<string | null>(null);
  const [runnerOn3bId, setRunnerOn3bId] = useState<string | null>(null);
  const [batterId, setBatterId] = useState<string | null>(players[0]?.id ?? null);
  const [result, setResult] = useState<PAResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [countBalls, setCountBalls] = useState(0);
  const [countStrikes, setCountStrikes] = useState(0);
  const [rbi, setRbi] = useState(0);
  /** Runners/batter marked as scoring on this PA (manual picks only — not inferred). */
  const [runsScoredPlayerIds, setRunsScoredPlayerIds] = useState<string[]>([]);
  const [unearnedRunsScoredPlayerIds, setUnearnedRunsScoredPlayerIds] = useState<string[]>([]);
  /**
   * Runners on base when the arm was last changed mid–half-inning: if they score, R/ER go to `chargeId`
   * (the pitcher who left). Pruned when they leave the bases. Single object avoids effect batch races.
   */
  const [inheritedForPriorPitcher, setInheritedForPriorPitcher] = useState<{
    chargeId: string | null;
    runnerIds: string[];
  }>({ chargeId: null, runnerIds: [] });
  /** Defensive player charged with the error (ROE or optional on 1B–3B). */
  const [errorFielderId, setErrorFielderId] = useState<string | null>(null);
  /** `roe`: same flow as before (confirm ROE + fielder). `hit`: optional E on a base hit. */
  const [errorFielderModalMode, setErrorFielderModalMode] = useState<null | "roe" | "hit">(null);
  const prevResultBeforeRoeModalRef = useRef<PAResult | null>(null);
  const prevErrorFielderIdBeforeRoeModalRef = useRef<string | null>(null);
  /** After first HR seed, only prune scorers who left the bases — allow toggling "Who scored" off. */
  const hrScorersSeededRef = useRef(false);
  const [baserunningEvents, setBaserunningEvents] = useState<BaserunningEvent[]>([]);
  const [hitDirection, setHitDirection] = useState<HitDirection | null>(null);
  const [battedBallType, setBattedBallType] = useState<BattedBallType | null>(null);
  /** Current pitcher on the mound (defensive team — opposite of batting team). */
  const [pitcherId, setPitcherId] = useState<string | null>(null);
  /** Remember selected pitcher per defensive side so switching half-innings keeps current arms. */
  const [pitcherBySide, setPitcherBySide] = useState<{ home: string | null; away: string | null }>({
    home: null,
    away: null,
  });
  const [pitchesSeen, setPitchesSeen] = useState<number | "">("");
  /** Total pitches that count as strikes (incl. fouls); required when pitches ≥ 1. */
  const [strikesThrown, setStrikesThrown] = useState<number | "">("");
  /** Optional pitch-by-pitch log for this PA (undoes from end only). */
  const [draftPitchLog, setDraftPitchLog] = useState<DraftPitchRow[]>([]);
  /** Coach pad / DB count sync — read in `games` realtime handler (assigned again after `recordLocked`). */
  const draftPitchLogEmptyRef = useRef(true);
  const recordLockedRef = useRef(false);
  const [pitchTrackerGroupId, setPitchTrackerGroupId] = useState<string | null>(null);
  /** Latest pitch events for this game (for future replay / stats UI). */
  const pitchEventsByGameRef = useRef<PitchEvent[]>([]);
  const countSnapRef = useRef({ balls: 0, strikes: 0 });
  countSnapRef.current = { balls: countBalls, strikes: countStrikes };
  const batterSelectRef = useRef<HTMLSelectElement>(null);
  /**
   * First + on Balls vs Strikes from 0-0 encodes first-pitch strike for FPS%
   * ('strike' → FPS yes, 'ball' → no). Cleared when count returns to 0-0.
   */
  const [firstCountFromZero, setFirstCountFromZero] = useState<"ball" | "strike" | null>(null);
  const [playNote, setPlayNote] = useState("");
  const [notes, setNotes] = useState("");
  /** Next lineup index due up for each side (persists batting turn across half-innings). */
  const [nextBatterIndexBySide, setNextBatterIndexBySide] = useState<{ away: number; home: number }>({
    away: 0,
    home: 0,
  });
  const [saving, setSaving] = useState(false);
  const [substitutionModalOpen, setSubstitutionModalOpen] = useState(false);
  const [pitcherChangeModalOpen, setPitcherChangeModalOpen] = useState(false);
  const [clearingPAs, setClearingPAs] = useState(false);
  const [destructiveConfirm, setDestructiveConfirm] = useState<
    null | "undoLastPa" | "clearGamePas" | "finalizeGame"
  >(null);
  const [destructivePending, setDestructivePending] = useState(false);
  const [finalizingGame, setFinalizingGame] = useState(false);
  const [finalizedScoreSnapshot, setFinalizedScoreSnapshot] = useState<{
    home: number | null;
    away: number | null;
  }>({ home: null, away: null });
  const [message, setMessage] = useState<{
    type: "success" | "error" | "destructive";
    text: string;
  } | null>(null);
  const [toastMounted, setToastMounted] = useState(false);
  const messageDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Detect same defensive half pitching change (for inherited runner R/ER). */
  const prevPitchContextRef = useRef<{ side: "home" | "away"; pitcherId: string | null } | null>(null);
  const prevInningFrameKeyRef = useRef<string | null>(null);
  const [allPAsForGame, setAllPAsForGame] = useState<PlateAppearance[]>([]);
  /** Pitch log rows for the loaded game (drives Sw% / Whiff% / Foul% on Pitch data card). */
  const [gamePitchEvents, setGamePitchEvents] = useState<PitchEvent[]>([]);
  const [lineupAway, setLineupAway] = useState<{
    order: string[];
    positionByPlayerId: Record<string, string>;
  }>({ order: [], positionByPlayerId: {} });
  const [lineupHome, setLineupHome] = useState<{
    order: string[];
    positionByPlayerId: Record<string, string>;
  }>({ order: [], positionByPlayerId: {} });
  /** When true, batting box shows the team not currently at bat (read-only peek). */
  const [battingTablePeekOther, setBattingTablePeekOther] = useState(false);
  /** Two-column box score: shared heading row only at lg+ (see GameBattingTable / GamePitchingBoxTable hideHeading). */
  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsLg(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const [lastSavedPaSummary, setLastSavedPaSummary] = useState<LastSavedPaSummary | null>(null);
  /** Mirrors last persist payload for synchronous flush on tab hide / beforeunload. */
  const recordFormSnapshotRef = useRef<PersistedRecordFormState | null>(null);
  /** Keyboard shortcut: repeat last saved result + counts. */
  const lastRepeatablePaRef = useRef<{
    result: PAResult;
    countBalls: number;
    countStrikes: number;
  } | null>(null);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  useEffect(() => {
    setToastMounted(true);
    return () => {
      if (messageDismissRef.current) clearTimeout(messageDismissRef.current);
    };
  }, []);

  useEffect(() => {
    setLastSavedPaSummary(null);
  }, [selectedGameId]);

  useEffect(() => {
    if (!selectedGameId) {
      setPitchTrackerGroupId(null);
      return;
    }
    const g = games.find((x) => x.id === selectedGameId);
    if (g?.pitch_tracker_group_id) {
      setPitchTrackerGroupId(g.pitch_tracker_group_id);
      writeStoredPitchTrackerGroupId(selectedGameId, g.pitch_tracker_group_id);
      return;
    }
    const existing = readStoredPitchTrackerGroupId(selectedGameId);
    const id = existing && existing.length > 0 ? existing : newPitchTrackerGroupId();
    if (!existing) writeStoredPitchTrackerGroupId(selectedGameId, id);
    setPitchTrackerGroupId(id);
    void persistPitchTrackerGroupToGame(selectedGameId, id);
  }, [selectedGameId, games]);

  useEffect(() => {
    const sb = getSupabaseBrowserClient();
    if (!sb || !selectedGameId || isDemoId(selectedGameId)) return;
    const channel = sb
      .channel(`game-pitch-tracker-group-${selectedGameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${selectedGameId}`,
        },
        (payload) => {
          const row = payload.new as {
            pitch_tracker_group_id?: string | null;
            pitch_tracker_balls?: number | null;
            pitch_tracker_strikes?: number | null;
          };
          const ng = row.pitch_tracker_group_id;
          if (ng && typeof ng === "string") {
            setPitchTrackerGroupId(ng);
            writeStoredPitchTrackerGroupId(selectedGameId, ng);
          }
          if (recordLockedRef.current || !draftPitchLogEmptyRef.current) return;
          if (Object.prototype.hasOwnProperty.call(row, "pitch_tracker_balls")) {
            const b = row.pitch_tracker_balls;
            if (typeof b === "number" && Number.isFinite(b)) {
              setCountBalls(Math.max(0, Math.min(3, Math.trunc(b))));
            }
          }
          if (Object.prototype.hasOwnProperty.call(row, "pitch_tracker_strikes")) {
            const s = row.pitch_tracker_strikes;
            if (typeof s === "number" && Number.isFinite(s)) {
              setCountStrikes(Math.max(0, Math.min(3, Math.trunc(s))));
            }
          }
        }
      )
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [selectedGameId]);

  const {
    rows: coachPitchRows,
    loading: coachPitchesLoading,
    refresh: refreshCoachPitches,
  } = usePitchTrackerRows(selectedGameId && pitchTrackerGroupId ? pitchTrackerGroupId : null);

  useEffect(() => {
    if (draftPitchLog.length > 0) return;
    if (countBalls === 0 && countStrikes === 0) {
      setFirstCountFromZero(null);
    }
  }, [countBalls, countStrikes, draftPitchLog.length]);

  /** Derive count / pitch totals from pitch-by-pitch log (+ inferred final `in_play` when Result is a batted ball). */
  useEffect(() => {
    if (draftPitchLog.length === 0) return;
    const entries: PitchSequenceEntry[] = draftPitchLog.map(
      ({ balls_before, strikes_before, outcome }) => ({
        balls_before,
        strikes_before,
        outcome,
      })
    );
    const s = summarizePitchSequence(withInferredInPlayPitch(entries, result));
    setPitchesSeen(s.pitches_seen);
    setStrikesThrown(s.strikes_thrown);
    setCountBalls(s.finalBalls);
    setCountStrikes(s.finalStrikes);
    const f = s.first_pitch_strike;
    setFirstCountFromZero(f === true ? "strike" : f === false ? "ball" : null);
  }, [draftPitchLog, result]);

  const prevDraftPitchLenRef = useRef(0);
  useEffect(() => {
    const prev = prevDraftPitchLenRef.current;
    prevDraftPitchLenRef.current = draftPitchLog.length;
    if (prev > 0 && draftPitchLog.length === 0) {
      setPitchesSeen("");
      setStrikesThrown("");
      setCountBalls(0);
      setCountStrikes(0);
      setFirstCountFromZero(null);
    }
  }, [draftPitchLog.length]);

  /**
   * No pitch-by-pitch log: choosing a batted-ball result (1B–HR, out, sac, etc.) assumes at least one pitch.
   * Default to 1 pitch / 1 strike (first-pitch swing/contact → FPS yes) so quick saves don’t require typing totals.
   * Clear that default when switching to a non–batted-ball result if totals are still 1/1.
   */
  const prevResultForBipDefaultsRef = useRef<PAResult | null>(null);
  useEffect(() => {
    if (draftPitchLog.length > 0) {
      prevResultForBipDefaultsRef.current = result;
      return;
    }
    const prev = prevResultForBipDefaultsRef.current;
    if (result != null && resultImpliesBattedBallInPlay(result)) {
      const pitchesEff = pitchesSeen === "" ? 1 : pitchesSeen;
      if (pitchesSeen === "") setPitchesSeen(1);
      setStrikesThrown((s) => {
        // Number inputs often store 0 instead of ""; 0 strikes + 1 pitch makes FPS infer "Ball".
        // For the one-pitch BIP quick path, default to 1 strike (typical swing/contact).
        if (typeof pitchesEff === "number" && pitchesEff === 1 && (s === "" || s === 0)) return 1;
        return s;
      });
    } else if (
      prev != null &&
      resultImpliesBattedBallInPlay(prev) &&
      (result === null || !resultImpliesBattedBallInPlay(result))
    ) {
      setPitchesSeen((p) => (p === 1 ? "" : p));
      setStrikesThrown((s) => (s === 1 ? "" : s));
    }
    prevResultForBipDefaultsRef.current = result;
  }, [result, draftPitchLog.length]);

  useEffect(() => {
    if (result == null) {
      setErrorFielderId(null);
      return;
    }
    const keepError =
      result === "reached_on_error" || RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT.has(result);
    if (!keepError) setErrorFielderId(null);
  }, [result]);

  useEffect(() => {
    if (pitchesSeen === "") return;
    const pc = pitchesSeen as number;
    if (pc === 0) {
      setStrikesThrown(0);
    } else {
      setStrikesThrown((s) => {
        if (s === "") return s;
        if (typeof s === "number" && s > pc) return pc;
        return s;
      });
    }
  }, [pitchesSeen]);

  const selectedGame = games.find((g) => g.id === selectedGameId);
  const recordLocked = selectedGame != null && isGameFinalized(selectedGame);
  const selectedBatter = players.find((p) => p.id === batterId);
  draftPitchLogEmptyRef.current = draftPitchLog.length === 0;
  recordLockedRef.current = recordLocked;

  useEffect(() => {
    if (!selectedGameId || recordLocked) return;
    void persistPitchTrackerBatterToGame(selectedGameId, batterId);
  }, [selectedGameId, batterId, recordLocked]);

  useEffect(() => {
    if (!selectedGameId || recordLocked) return;
    void persistPitchTrackerOutsToGame(selectedGameId, outs);
  }, [selectedGameId, outs, recordLocked]);

  useEffect(() => {
    setFinalizedScoreSnapshot({
      home: selectedGame?.final_score_home ?? null,
      away: selectedGame?.final_score_away ?? null,
    });
  }, [selectedGame?.id, selectedGame?.final_score_home, selectedGame?.final_score_away]);

  const battingSide = battingSideFromHalf(inningHalf);
  const showEarnedUnearnedRunControls = useMemo(
    () =>
      selectedGameId != null &&
      computeShowEarnedUnearnedRunControls(
        allPAsForGame,
        selectedGameId,
        inning,
        inningHalf,
        result,
        errorFielderId
      ),
    [
      selectedGameId,
      allPAsForGame,
      inning,
      inningHalf,
      result,
      errorFielderId,
    ]
  );
  /** Defense this half: who is on the mound (top → home pitches; bottom → away pitches). */
  const pitchingSide = battingSide === "away" ? "home" : "away";

  useEffect(() => {
    prevPitchContextRef.current = null;
    prevInningFrameKeyRef.current = null;
  }, [selectedGameId]);

  const inningFrameKey = `${inning}:${inningHalf}`;
  useEffect(() => {
    if (
      prevInningFrameKeyRef.current != null &&
      prevInningFrameKeyRef.current !== inningFrameKey
    ) {
      setInheritedForPriorPitcher({ chargeId: null, runnerIds: [] });
    }
    prevInningFrameKeyRef.current = inningFrameKey;
  }, [inningFrameKey]);

  useEffect(() => {
    const prev = prevPitchContextRef.current;
    const onBase = new Set(
      occupiedRunnerIdsFromForm(baseState, runnerOn1bId, runnerOn2bId, runnerOn3bId)
    );

    const pitcherSwap =
      prev &&
      prev.side === pitchingSide &&
      prev.pitcherId &&
      pitcherId &&
      prev.pitcherId !== pitcherId;

    setInheritedForPriorPitcher((prior) => {
      let { chargeId, runnerIds } = prior;

      if (pitcherSwap) {
        if (hasRunnersOnBaseForm(baseState)) {
          const fresh = occupiedRunnerIdsFromForm(
            baseState,
            runnerOn1bId,
            runnerOn2bId,
            runnerOn3bId
          );
          if (fresh.length > 0) {
            chargeId = prev.pitcherId;
            runnerIds = fresh;
          } else {
            chargeId = null;
            runnerIds = [];
          }
        } else {
          chargeId = null;
          runnerIds = [];
        }
      }

      const pruned = runnerIds.filter((id) => onBase.has(id));
      const nextCharge = pruned.length === 0 ? null : chargeId;

      if (
        pruned.length === prior.runnerIds.length &&
        nextCharge === prior.chargeId &&
        pruned.every((id, i) => id === prior.runnerIds[i])
      ) {
        return prior;
      }
      return { chargeId: nextCharge, runnerIds: pruned };
    });

    prevPitchContextRef.current = { side: pitchingSide, pitcherId };
  }, [
    pitcherId,
    pitchingSide,
    baseState,
    runnerOn1bId,
    runnerOn2bId,
    runnerOn3bId,
  ]);

  const lineupForBatting = battingSide === "away" ? lineupAway : lineupHome;
  const displayBattingSide = battingTablePeekOther
    ? battingSide === "away"
      ? "home"
      : "away"
    : battingSide;
  /** Pitching box + pitch mix: defensive team (`plateAppearancesForPitchingSide`), not the batting column / peek. */
  const pitchingSideForBox = pitchingSide;
  const lineupForBattingTable =
    displayBattingSide === "away" ? lineupAway : lineupHome;
  const pasForBattingTable = useMemo(
    () =>
      allPAsForGame.filter((p) =>
        p.inning_half === (displayBattingSide === "away" ? "top" : "bottom")
      ),
    [allPAsForGame, displayBattingSide]
  );
  const draftPaForPitchMix = useMemo<PlateAppearance | null>(() => {
    if (!selectedGameId || !pitcherId) return null;
    if (pitchesSeen === "" || strikesThrown === "" || pitchesSeen < 0) return null;
    const inningHalfForDraft = inningHalf ?? "top";
    const inferredFirstPitch =
      pitchesSeen > 0
        ? firstCountFromZero === null
          ? countBalls === 0 && countStrikes === 0
            ? (strikesThrown as number) > 0
            : null
          : firstCountFromZero === "strike"
        : null;
    return {
      id: "__draft_pitch_mix__",
      game_id: selectedGameId,
      batter_id: batterId ?? "__draft_batter__",
      inning,
      outs,
      base_state: baseState,
      score_diff: 0,
      count_balls: countBalls,
      count_strikes: countStrikes,
      result: result ?? "other",
      contact_quality: null,
      chase: null,
      hit_direction:
        result != null && RESULT_ALLOWS_HIT_DIRECTION.has(result) ? hitDirection : null,
      batted_ball_type:
        result != null && RESULT_ALLOWS_HIT_DIRECTION.has(result) ? battedBallType : null,
      pitches_seen: pitchesSeen as number,
      strikes_thrown: pitchesSeen > 0 ? (strikesThrown as number) : 0,
      first_pitch_strike: inferredFirstPitch,
      rbi: 0,
      runs_scored_player_ids: [],
      unearned_runs_scored_player_ids: [],
      pitcher_hand: null,
      pitcher_id: pitcherId,
      error_fielder_id: null,
      inning_half: inningHalfForDraft,
      notes: null,
      created_at: new Date().toISOString(),
    };
  }, [
    selectedGameId,
    pitcherId,
    pitchesSeen,
    strikesThrown,
    inningHalf,
    inning,
    outs,
    baseState,
    countBalls,
    countStrikes,
    firstCountFromZero,
    batterId,
    result,
    hitDirection,
    battedBallType,
  ]);
  /** Same PAs as the pitching box (defensive team on the mound), not the batting half. */
  const pasForPitchMixUnderPitchingTable = useMemo(
    () =>
      plateAppearancesForPitchingSide(
        draftPaForPitchMix ? [...allPAsForGame, draftPaForPitchMix] : allPAsForGame,
        pitchingSideForBox
      ),
    [allPAsForGame, draftPaForPitchMix, pitchingSideForBox]
  );
  const pitchEventsForPitchMixCard = useMemo(() => {
    const ids = new Set(pasForPitchMixUnderPitchingTable.map((p) => p.id));
    const fromDb = gamePitchEvents.filter(
      (e) => ids.has(e.pa_id) && e.pa_id !== "__draft_pitch_mix__"
    );
    const synthetic =
      draftPaForPitchMix &&
      draftPitchLog.length > 0 &&
      ids.has("__draft_pitch_mix__")
        ? pitchEventsFromDraftPitchLog("__draft_pitch_mix__", draftPitchLog)
        : [];
    return [...fromDb, ...synthetic];
  }, [gamePitchEvents, pasForPitchMixUnderPitchingTable, draftPaForPitchMix, draftPitchLog]);

  /** Current batter’s PAs in this game (+ draft PA when it matches selected batter). */
  const pasForCurrentBatterPitchData = useMemo(() => {
    if (!batterId) return [];
    const fromDb = allPAsForGame.filter((p) => p.batter_id === batterId);
    if (draftPaForPitchMix && draftPaForPitchMix.batter_id === batterId) {
      return [...fromDb, draftPaForPitchMix];
    }
    return fromDb;
  }, [allPAsForGame, batterId, draftPaForPitchMix]);

  const pitchEventsForCurrentBatter = useMemo(() => {
    const ids = new Set(
      pasForCurrentBatterPitchData.map((p) => p.id).filter((id) => id !== "__draft_pitch_mix__")
    );
    const fromDb = gamePitchEvents.filter((e) => ids.has(e.pa_id));
    const draftInSample =
      draftPaForPitchMix &&
      batterId &&
      draftPaForPitchMix.batter_id === batterId &&
      pasForCurrentBatterPitchData.some((p) => p.id === "__draft_pitch_mix__");
    const synthetic =
      draftInSample && draftPitchLog.length > 0
        ? pitchEventsFromDraftPitchLog("__draft_pitch_mix__", draftPitchLog)
        : [];
    return [...fromDb, ...synthetic];
  }, [
    gamePitchEvents,
    pasForCurrentBatterPitchData,
    draftPaForPitchMix,
    draftPitchLog,
    batterId,
  ]);

  const currentBatterPitchDataName = useMemo(() => {
    if (!selectedBatter) return "Select batter";
    const j = selectedBatter.jersey != null ? ` #${selectedBatter.jersey}` : "";
    return `${selectedBatter.name.trim()}${j}`;
  }, [selectedBatter]);

  const battingTableTeamName = selectedGame
    ? displayBattingSide === "home"
      ? selectedGame.home_team
      : selectedGame.away_team
    : "";
  const pitchingTableTeamName = selectedGame
    ? pitchingSideForBox === "home"
      ? selectedGame.home_team
      : selectedGame.away_team
    : "";
  const liveAwayRuns = useMemo(() => totalRunsTop(allPAsForGame), [allPAsForGame]);
  const liveHomeRuns = useMemo(() => totalRunsBottom(allPAsForGame), [allPAsForGame]);
  const finalizedScoreText =
    finalizedScoreSnapshot.away != null && finalizedScoreSnapshot.home != null
      ? `${finalizedScoreSnapshot.away}-${finalizedScoreSnapshot.home}`
      : null;
  const finalizedOutcomeText = useMemo(() => {
    if (!selectedGame) return null;
    const away = finalizedScoreSnapshot.away;
    const home = finalizedScoreSnapshot.home;
    if (away == null || home == null) return null;
    const ourRuns = selectedGame.our_side === "home" ? home : away;
    const oppRuns = selectedGame.our_side === "home" ? away : home;
    if (ourRuns > oppRuns) return "W";
    if (ourRuns < oppRuns) return "L";
    return "T";
  }, [selectedGame, finalizedScoreSnapshot.away, finalizedScoreSnapshot.home]);

  /** Box score toggle: peek other side vs team at bat (away/home, not team names). */
  const recordBoxScoreToggleLabel = battingTablePeekOther
    ? battingSide === "away"
      ? "View away team"
      : "View home team"
    : battingSide === "away"
      ? "View home team"
      : "View away team";

  const baserunningByPlayerId = useMemo(() => {
    const m: Record<string, { sb: number; cs: number }> = {};
    for (const e of baserunningEvents) {
      if (!m[e.runner_id]) m[e.runner_id] = { sb: 0, cs: 0 };
      if (e.event_type === "sb") m[e.runner_id].sb++;
      else m[e.runner_id].cs++;
    }
    return m;
  }, [baserunningEvents]);

  const battersForDropdown = useMemo(() => {
    const order = lineupForBatting.order;
    if (order.length > 0) {
      return order
        .map((id) => players.find((p) => p.id === id))
        .filter((p): p is Player => p != null)
        .filter((p) => !isPitcherPlayer(p));
    }
    if (!selectedGame) return [];
    return playersForGameSideWhenNoLineup(selectedGame, battingSide, players).filter(
      (p) => !isPitcherPlayer(p)
    );
  }, [lineupForBatting.order, players, selectedGame, battingSide]);

  const runnerOptionsForBaseSelector = useMemo(
    () => battersForDropdown.map((p) => ({ id: p.id, name: p.name, jersey: p.jersey ?? null })),
    [battersForDropdown]
  );

  const battersForSide = useCallback(
    (side: "away" | "home") => {
      const order = (side === "away" ? lineupAway.order : lineupHome.order) ?? [];
      if (order.length > 0) {
        return order
          .map((id) => players.find((p) => p.id === id))
          .filter((p): p is Player => p != null)
          .filter((p) => !isPitcherPlayer(p));
      }
      if (!selectedGame) return [];
      return playersForGameSideWhenNoLineup(selectedGame, side, players).filter(
        (p) => !isPitcherPlayer(p)
      );
    },
    [lineupAway.order, lineupHome.order, players, selectedGame]
  );

  const pitchersForDropdown = useMemo(() => {
    if (!selectedGame) return [];
    return pitchersForGameTeamSide(selectedGame, pitchingSide, players);
  }, [selectedGame, pitchingSide, players]);

  /** Defensive roster / lineup + current pitcher (for P covering first, etc.). */
  const fieldersForErrorPicker = useMemo(() => {
    if (!selectedGame) return [];
    const lineup = pitchingSide === "away" ? lineupAway : lineupHome;
    let pool: Player[];
    if (lineup.order.length > 0) {
      pool = lineup.order
        .map((id) => players.find((p) => p.id === id))
        .filter((p): p is Player => p != null);
    } else {
      pool = [...playersForGameSideWhenNoLineup(selectedGame, pitchingSide, players)];
    }
    const seen = new Set(pool.map((p) => p.id));
    if (pitcherId && !seen.has(pitcherId)) {
      const pp = players.find((p) => p.id === pitcherId);
      if (pp) pool.push(pp);
    }
    return pool.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [selectedGame, pitchingSide, lineupAway, lineupHome, players, pitcherId]);

  /** Lineup slots + mound pitcher as P when not in saved lineup (same card treatment as C). */
  const positionByPlayerIdForRoeModal = useMemo(() => {
    const base =
      pitchingSide === "away" ? lineupAway.positionByPlayerId : lineupHome.positionByPlayerId;
    const merged: Record<string, string> = { ...base };
    if (pitcherId && !merged[pitcherId]?.trim()) {
      merged[pitcherId] = "P";
    }
    return merged;
  }, [pitchingSide, lineupAway, lineupHome, pitcherId]);

  const handleErrorFielderModalCancel = useCallback(() => {
    if (errorFielderModalMode === "roe") {
      setResult(prevResultBeforeRoeModalRef.current);
      setErrorFielderId(prevErrorFielderIdBeforeRoeModalRef.current);
    }
    setErrorFielderModalMode(null);
  }, [errorFielderModalMode]);

  const handleErrorFielderModalConfirm = useCallback((fielderId: string) => {
    setErrorFielderId(fielderId);
    setErrorFielderModalMode(null);
  }, []);

  /** Close fielder picker if result no longer matches the open mode. */
  useEffect(() => {
    if (errorFielderModalMode === "roe" && result !== "reached_on_error") {
      setErrorFielderModalMode(null);
    }
    if (
      errorFielderModalMode === "hit" &&
      (result == null || !RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT.has(result))
    ) {
      setErrorFielderModalMode(null);
    }
  }, [result, errorFielderModalMode]);

  const undoLastDraftPitch = useCallback(() => {
    setDraftPitchLog((prev) => prev.slice(0, -1));
  }, []);

  const clearDraftPitchLog = useCallback(() => {
    setDraftPitchLog([]);
  }, []);

  const loadPAs = useCallback((options?: { resetBatter?: boolean }) => {
    if (!selectedGameId) return;
    const resetBatter = options?.resetBatter !== false;
    setAllPAsForGame([]);
    setGamePitchEvents([]);
    setLineupAway({ order: [], positionByPlayerId: {} });
    setLineupHome({ order: [], positionByPlayerId: {} });
    Promise.all([
      fetchPAsForGame(selectedGameId),
      fetchGameLineupOrder(selectedGameId),
      fetchBaserunningEventsForGame(selectedGameId),
    ]).then(([{ pas, pitchEvents }, lineups, events]) => {
      setAllPAsForGame(pas);
      setGamePitchEvents(pitchEvents);
      pitchEventsByGameRef.current = pitchEvents;
      setBaserunningEvents(events);
      setLineupAway(lineups.away);
      setLineupHome(lineups.home);
      const hasPersistedState = hasPersistedRecordFormState(selectedGameId);
      if (resetBatter && !hasPersistedState) {
        const resume = readWorkflowDefaults().resumeSnapshotByGameId?.[selectedGameId];
        const playerOk = (id: string | null) =>
          id == null || players.some((p) => p.id === id);
        const resumeOk =
          resume &&
          playerOk(resume.runnerOn1bId) &&
          playerOk(resume.runnerOn2bId) &&
          playerOk(resume.runnerOn3bId) &&
          playerOk(resume.pitcherBySide?.home ?? null) &&
          playerOk(resume.pitcherBySide?.away ?? null) &&
          typeof resume.inning === "number" &&
          (resume.inningHalf === "top" || resume.inningHalf === "bottom");

        if (resumeOk) {
          setInning(Math.max(1, Math.min(resume.inning, MAX_SELECTABLE_INNING)));
          setInningHalf(resume.inningHalf);
          setOuts(Math.max(0, Math.min(resume.outs ?? 0, 2)));
          setBaseState((resume.baseState ?? "000") as BaseState);
          setRunnerOn1bId(resume.runnerOn1bId ?? null);
          setRunnerOn2bId(resume.runnerOn2bId ?? null);
          setRunnerOn3bId(resume.runnerOn3bId ?? null);
          setNextBatterIndexBySide(resume.nextBatterIndexBySide ?? { away: 0, home: 0 });
          setPitcherBySide(resume.pitcherBySide ?? { home: null, away: null });
          const side = battingSideFromHalf(resume.inningHalf);
          const order = side === "away" ? lineups.away.order : lineups.home.order;
          const firstAway = lineups.away.order[0];
          const firstHome = lineups.home.order[0];
          const fallbackFirst = firstAway ?? firstHome ?? players[0]?.id ?? null;
          if (order.length > 0) {
            const slot =
              (resume.nextBatterIndexBySide?.[side] ?? 0) % order.length;
            const batterFromOrder = order[slot] ?? null;
            setBatterId(
              batterFromOrder && players.some((p) => p.id === batterFromOrder)
                ? batterFromOrder
                : fallbackFirst
            );
          } else {
            setBatterId(fallbackFirst);
          }
        } else {
          const inferred = inferLiveLinescoreFromPAs(pas);
          setInning(Math.max(1, Math.min(inferred.liveInning, MAX_SELECTABLE_INNING)));
          setInningHalf(inferred.liveHalf ?? "top");
          const firstAway = lineups.away.order[0];
          const firstHome = lineups.home.order[0];
          const firstBatterId =
            firstAway ?? firstHome ?? players[0]?.id ?? null;
          setBatterId(firstBatterId);
        }
      }
    });
  }, [selectedGameId, fetchPAsForGame, fetchGameLineupOrder, fetchBaserunningEventsForGame, players]);

  const autoAdvanceAfterThreeOuts = useCallback(
    (currentInning: number, currentHalf: "top" | "bottom") => {
      // Do not auto-advance from bottom of regulation into extras.
      if (currentHalf === "bottom" && currentInning >= REGULATION_INNINGS) {
        return {
          inning: currentInning,
          half: currentHalf as "bottom",
          heldForManualExtras: true,
        };
      }
      const next = nextHalfInningAfterThreeOuts(currentInning, currentHalf);
      return {
        inning: Math.min(next.inning, MAX_SELECTABLE_INNING),
        half: next.half,
        heldForManualExtras: false,
      };
    },
    []
  );

  useEffect(() => {
    loadPAs();
  }, [loadPAs]);

  useEffect(() => {
    setBattingTablePeekOther(false);
  }, [inningHalf]);

  useEffect(() => {
    if (!selectedGameId) return;
    const raw = window.localStorage.getItem(recordFormStorageKey(selectedGameId));
    if (!raw) {
      setInning(1);
      setInningHalf("top");
      setOuts(0);
      setBaseState("000");
      setRunnerOn1bId(null);
      setRunnerOn2bId(null);
      setRunnerOn3bId(null);
      setBattingTablePeekOther(false);
      setPitcherId(null);
      setPitcherBySide({ home: null, away: null });
      setRunsScoredPlayerIds([]);
      setUnearnedRunsScoredPlayerIds([]);
      setInheritedForPriorPitcher({ chargeId: null, runnerIds: [] });
      setDraftPitchLog([]);
      setErrorFielderId(null);
      return;
    }
    try {
      const saved = JSON.parse(raw) as PersistedRecordFormState;
      setInning(Math.max(1, Math.min(saved.inning ?? 1, MAX_SELECTABLE_INNING)));
      setInningHalf(saved.inningHalf === "bottom" ? "bottom" : "top");
      setOuts(Math.max(0, Math.min(saved.outs ?? 0, 2)));
      setBaseState((saved.baseState ?? "000") as BaseState);
      setRunnerOn1bId(saved.runnerOn1bId ?? null);
      setRunnerOn2bId(saved.runnerOn2bId ?? null);
      setRunnerOn3bId(saved.runnerOn3bId ?? null);
      setBatterId(saved.batterId ?? null);
      setResult(saved.result ?? null);
      setCountBalls(Math.max(0, Math.min(saved.countBalls ?? 0, 3)));
      setCountStrikes(Math.max(0, Math.min(saved.countStrikes ?? 0, 3)));
      setRbi(Math.max(0, saved.rbi ?? 0));
      setRunsScoredPlayerIds(
        Array.isArray(saved.runsScoredPlayerIds) ? saved.runsScoredPlayerIds : []
      );
      const loadedScorers = Array.isArray(saved.runsScoredPlayerIds) ? saved.runsScoredPlayerIds : [];
      const loadedUe = Array.isArray(saved.unearnedRunsScoredPlayerIds)
        ? saved.unearnedRunsScoredPlayerIds
        : [];
      setUnearnedRunsScoredPlayerIds(loadedUe.filter((id) => loadedScorers.includes(id)));
      const rawInherited = saved.inheritedForPriorPitcher;
      if (
        rawInherited &&
        typeof rawInherited === "object" &&
        Array.isArray(rawInherited.runnerIds) &&
        (rawInherited.chargeId === null ||
          (typeof rawInherited.chargeId === "string" && rawInherited.chargeId.length > 0))
      ) {
        const chargeId =
          typeof rawInherited.chargeId === "string" && rawInherited.chargeId.length > 0
            ? rawInherited.chargeId
            : null;
        const onBase = new Set(
          occupiedRunnerIdsFromForm(
            (saved.baseState ?? "000") as BaseState,
            saved.runnerOn1bId ?? null,
            saved.runnerOn2bId ?? null,
            saved.runnerOn3bId ?? null
          )
        );
        const runnerIds = rawInherited.runnerIds.filter((id) => onBase.has(id));
        setInheritedForPriorPitcher({
          chargeId: runnerIds.length > 0 ? chargeId : null,
          runnerIds,
        });
      } else {
        setInheritedForPriorPitcher({ chargeId: null, runnerIds: [] });
      }
      setHitDirection(saved.hitDirection ?? null);
      setBattedBallType(parsePersistedBattedBallType(saved.battedBallType));
      setPitcherId(saved.pitcherId ?? null);
      setPitcherBySide(saved.pitcherBySide ?? { home: null, away: null });
      setPitchesSeen(saved.pitchesSeen ?? "");
      setStrikesThrown(saved.strikesThrown ?? "");
      setFirstCountFromZero(saved.firstCountFromZero ?? null);
      setPlayNote(saved.playNote ?? "");
      setNotes(saved.notes ?? "");
      setErrorFielderId(
        typeof saved.errorFielderId === "string" &&
          saved.errorFielderId &&
          saved.result != null &&
          (saved.result === "reached_on_error" ||
            RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT.has(saved.result))
          ? saved.errorFielderId
          : null
      );
      setNextBatterIndexBySide(saved.nextBatterIndexBySide ?? { away: 0, home: 0 });
      setBattingTablePeekOther(saved.battingTablePeekOther ?? false);
      if (
        saved.draftPitchLogRows &&
        Array.isArray(saved.draftPitchLogRows) &&
        saved.draftPitchLogRows.length > 0
      ) {
        setDraftPitchLog(
          saved.draftPitchLogRows.map((row) => ({
            balls_before: row.balls_before,
            strikes_before: row.strikes_before,
            outcome: row.outcome,
            clientKey:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `p-${Date.now()}-${Math.random()}`,
          }))
        );
      } else {
        setDraftPitchLog([]);
      }
    } catch {
      setInning(1);
      setInningHalf("top");
      setOuts(0);
      setBaseState("000");
      setRunnerOn1bId(null);
      setRunnerOn2bId(null);
      setRunnerOn3bId(null);
      setBattingTablePeekOther(false);
      setPitcherId(null);
      setPitcherBySide({ home: null, away: null });
      setRunsScoredPlayerIds([]);
      setUnearnedRunsScoredPlayerIds([]);
      setInheritedForPriorPitcher({ chargeId: null, runnerIds: [] });
      setDraftPitchLog([]);
      setErrorFielderId(null);
    }
  }, [selectedGameId]);

  useEffect(() => {
    if (!selectedGameId) return;
    const payload: PersistedRecordFormState = {
      inning,
      inningHalf,
      outs,
      baseState,
      runnerOn1bId,
      runnerOn2bId,
      runnerOn3bId,
      batterId,
      result,
      countBalls,
      countStrikes,
      rbi,
      runsScoredPlayerIds,
      unearnedRunsScoredPlayerIds,
      inheritedForPriorPitcher,
      hitDirection,
      battedBallType,
      pitcherId,
      pitcherBySide,
      pitchesSeen,
      strikesThrown,
      firstCountFromZero,
      playNote,
      notes,
      errorFielderId,
      nextBatterIndexBySide,
      battingTablePeekOther,
      draftPitchLogRows: draftPitchLog.map(({ balls_before, strikes_before, outcome }) => ({
        balls_before,
        strikes_before,
        outcome,
      })),
    };
    recordFormSnapshotRef.current = payload;
    window.localStorage.setItem(recordFormStorageKey(selectedGameId), JSON.stringify(payload));
  }, [
    selectedGameId,
    inning,
    inningHalf,
    outs,
    baseState,
    runnerOn1bId,
    runnerOn2bId,
    runnerOn3bId,
    batterId,
    result,
    countBalls,
    countStrikes,
    rbi,
    runsScoredPlayerIds,
    unearnedRunsScoredPlayerIds,
    inheritedForPriorPitcher,
    hitDirection,
    battedBallType,
    pitcherId,
    pitcherBySide,
    pitchesSeen,
    strikesThrown,
    firstCountFromZero,
    playNote,
    notes,
    errorFielderId,
    nextBatterIndexBySide,
    battingTablePeekOther,
    draftPitchLog,
  ]);

  /** Keep selected batter on the team at bat (lineup order or club/opponent fallback). */
  useEffect(() => {
    if (battersForDropdown.length === 0) {
      if (batterId) setBatterId(null);
      return;
    }
    if (!batterId || !battersForDropdown.some((p) => p.id === batterId)) {
      setBatterId(battersForDropdown[0]!.id);
    }
  }, [battersForDropdown, batterId]);

  /** Keep pitcher on defensive roster; remember user choice per side, else use starter fallback. */
  useEffect(() => {
    if (pitchersForDropdown.length === 0) {
      if (pitcherId) setPitcherId(null);
      if (pitcherBySide[pitchingSide] != null) {
        setPitcherBySide((prev) => ({ ...prev, [pitchingSide]: null }));
      }
      return;
    }
    const remembered = pitcherBySide[pitchingSide];
    const starterId =
      pitchingSide === "home"
        ? selectedGame?.starting_pitcher_home_id
        : selectedGame?.starting_pitcher_away_id;
    const starterPreferred =
      starterId && pitchersForDropdown.some((p) => p.id === starterId)
        ? starterId
        : pitchersForDropdown[0]!.id;
    const resolved =
      remembered && pitchersForDropdown.some((p) => p.id === remembered)
        ? remembered
        : starterPreferred;
    if (pitcherId !== resolved) {
      setPitcherId(resolved);
    }
    if (pitcherBySide[pitchingSide] !== resolved) {
      setPitcherBySide((prev) => ({ ...prev, [pitchingSide]: resolved }));
    }
  }, [
    pitchersForDropdown,
    pitcherId,
    pitcherBySide,
    pitchingSide,
    selectedGame?.starting_pitcher_home_id,
    selectedGame?.starting_pitcher_away_id,
  ]);

  /** After mound pitcher is resolved — skip null while roster has arms (avoids clearing DB before hydrate). */
  useEffect(() => {
    if (!selectedGameId || recordLocked) return;
    if (pitcherId == null && pitchersForDropdown.length > 0) return;
    void persistPitchTrackerPitcherToGame(selectedGameId, pitcherId);
  }, [selectedGameId, pitcherId, recordLocked, pitchersForDropdown.length]);

  /** Home run: seed full scorer list once per HR stretch; then only prune if a runner leaves the bases. */
  useEffect(() => {
    if (result !== "hr") {
      hrScorersSeededRef.current = false;
      return;
    }
    const bits = baseState.padStart(3, "0").slice(0, 3);
    const ids: string[] = [];
    if (bits[0] === "1" && runnerOn1bId) ids.push(runnerOn1bId);
    if (bits[1] === "1" && runnerOn2bId) ids.push(runnerOn2bId);
    if (bits[2] === "1" && runnerOn3bId) ids.push(runnerOn3bId);
    if (batterId) ids.push(batterId);
    const unique = [...new Set(ids)];
    setUnearnedRunsScoredPlayerIds((prev) => prev.filter((id) => unique.includes(id)));
    setRunsScoredPlayerIds((prev) => {
      if (!hrScorersSeededRef.current) {
        hrScorersSeededRef.current = true;
        return unique;
      }
      const allowed = new Set(unique);
      return prev.filter((id) => allowed.has(id));
    });
  }, [result, baseState, runnerOn1bId, runnerOn2bId, runnerOn3bId, batterId]);

  useEffect(() => {
    if (result !== "hr") return;
    setRbi(runsScoredPlayerIds.length);
  }, [result, runsScoredPlayerIds]);

  /** Drop unearned flags for anyone no longer in Who scored. */
  useEffect(() => {
    setUnearnedRunsScoredPlayerIds((prev) => prev.filter((id) => runsScoredPlayerIds.includes(id)));
  }, [runsScoredPlayerIds]);

  /** Hide E/UE when no error on this PA and no prior error in the half — clear stale UE flags (HR keeps per-scorer E/UE). */
  useEffect(() => {
    if (result === "hr") return;
    if (!showEarnedUnearnedRunControls) {
      setUnearnedRunsScoredPlayerIds([]);
    }
  }, [result, showEarnedUnearnedRunControls]);

  /** Cap RBI to scorers (and 4) when not HR — HR effect owns both fields. RBI can stay below runs when some score on error. */
  useEffect(() => {
    if (result === "hr") return;
    const n = runsScoredPlayerIds.length;
    setRbi((r) => Math.max(0, Math.min(r, Math.min(n, 4))));
  }, [runsScoredPlayerIds, result]);

  /** Keep hit direction / batted-ball type for balls in play, clear for non-BIP outcomes. */
  useEffect(() => {
    if (result !== null && !RESULT_ALLOWS_HIT_DIRECTION.has(result)) {
      setHitDirection(null);
      setBattedBallType(null);
    }
  }, [result]);

  const prevResultForBipDefaultRef = useRef<PAResult | null>(null);
  /** Default batted-ball type from last saved preference when entering a BIP outcome. */
  useEffect(() => {
    const prev = prevResultForBipDefaultRef.current;
    prevResultForBipDefaultRef.current = result;
    if (!result || !RESULT_ALLOWS_HIT_DIRECTION.has(result) || battedBallType != null) return;
    const pref = readWorkflowDefaults().lastBattedBallType;
    if (!pref) return;
    if (prev == null || !RESULT_ALLOWS_HIT_DIRECTION.has(prev)) {
      setBattedBallType(pref);
    }
  }, [result, battedBallType]);

  /** GIDP / FC / SF / SH invalid with bases empty — clear selection if user empties the diamond. */
  useEffect(() => {
    if (result != null && requiresRunnerOnBaseForResult(result) && baseState === "000") {
      setResult(null);
    }
  }, [baseState, result]);

  const dismissMessage = useCallback(() => {
    if (messageDismissRef.current) {
      clearTimeout(messageDismissRef.current);
      messageDismissRef.current = null;
    }
    setMessage(null);
  }, []);

  const showMsg = useCallback(
    (type: "success" | "error" | "destructive", text: string) => {
      if (messageDismissRef.current) clearTimeout(messageDismissRef.current);
      setMessage({ type, text });
      const ms = type === "error" ? 8000 : type === "destructive" ? 5000 : 4000;
      messageDismissRef.current = setTimeout(() => {
        setMessage(null);
        messageDismissRef.current = null;
      }, ms);
    },
    []
  );

  /** Count after the current draft sequence (or manual count when log empty). */
  const pitchLogEndCount = useMemo(() => {
    if (draftPitchLog.length === 0) return { balls: countBalls, strikes: countStrikes };
    return replayCountAtEndOfSequence(
      draftPitchLog.map(({ balls_before, strikes_before, outcome }) => ({
        balls_before,
        strikes_before,
        outcome,
      }))
    );
  }, [draftPitchLog, countBalls, countStrikes]);

  const appendDraftPitch = useCallback(
    (outcome: PitchOutcome) => {
      setDraftPitchLog((prev) => {
        const { balls, strikes } =
          prev.length === 0
            ? { balls: countSnapRef.current.balls, strikes: countSnapRef.current.strikes }
            : replayCountAtEndOfSequence(
                prev.map(({ balls_before, strikes_before, outcome: o }) => ({
                  balls_before,
                  strikes_before,
                  outcome: o,
                }))
              );
        const lastPitch =
          prev.length > 0
            ? {
                balls_before: prev[prev.length - 1]!.balls_before,
                strikes_before: prev[prev.length - 1]!.strikes_before,
                outcome: prev[prev.length - 1]!.outcome,
              }
            : null;
        if (isPitchOutcomeBlockedByFullCount(balls, strikes, outcome, lastPitch)) {
          const msg =
            outcome === "ball"
              ? "Count is already 3 balls — set Outcome to Walk (BB) instead of logging another ball."
              : "You already logged a called strike or swing/miss at 2 strikes — use Undo if that was wrong.";
          queueMicrotask(() => showMsg("error", msg));
          return prev;
        }
        const clientKey =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `p-${Date.now()}-${Math.random()}`;
        return [...prev, { clientKey, balls_before: balls, strikes_before: strikes, outcome }];
      });
    },
    [showMsg]
  );

  const handleBaserunning = useCallback(
    async ({
      baseIndex,
      runnerId,
      type,
    }: {
      baseIndex: 0 | 1 | 2;
      runnerId: string;
      type: "sb" | "cs";
    }) => {
      if (!selectedGameId) return;
      if (type === "sb") {
        const v = validateStealAttempt(
          baseIndex,
          runnerId,
          runnerOn1bId,
          runnerOn2bId,
          runnerOn3bId,
          baseState
        );
        if (!v.ok) {
          showMsg("error", v.message);
          return;
        }
      }
      const row: BaserunningEventInsert = {
        game_id: selectedGameId,
        inning,
        inning_half: inningHalf,
        outs,
        runner_id: runnerId,
        event_type: type,
        batter_id: batterId,
      };
      const res = await saveBaserunningEventAction(row);
      if (res.ok && res.event) {
        setBaserunningEvents((prev) => [...prev, res.event!]);
        if (type === "sb") {
          const next = advanceRunnersAfterStolenBase(
            baseIndex,
            runnerId,
            runnerOn1bId,
            runnerOn2bId,
            runnerOn3bId,
            baseState
          );
          if (next) {
            setRunnerOn1bId(next.runner1b);
            setRunnerOn2bId(next.runner2b);
            setRunnerOn3bId(next.runner3b);
            setBaseState(next.baseState);
            showMsg("success", "Stolen base — runner advanced");
          } else {
            showMsg("error", "Could not advance runner — check bases and try again.");
          }
        } else {
          const newOuts = outs + 1;
          if (newOuts >= 3) {
            const next = autoAdvanceAfterThreeOuts(inning, inningHalf);
            setInning(next.inning);
            setInningHalf(next.half);
            setOuts(0);
            setBaseState("000");
            setRunnerOn1bId(null);
            setRunnerOn2bId(null);
            setRunnerOn3bId(null);
            showMsg(
              "success",
              next.heldForManualExtras
                ? "3rd out — regulation complete. Set inning/half manually for extras."
                : "Caught stealing — 3rd out, side retired"
            );
          } else {
            const cleared = removeRunnerAfterCaughtStealing(
              baseIndex,
              runnerId,
              runnerOn1bId,
              runnerOn2bId,
              runnerOn3bId,
              baseState
            );
            if (cleared) {
              setRunnerOn1bId(cleared.runner1b);
              setRunnerOn2bId(cleared.runner2b);
              setRunnerOn3bId(cleared.runner3b);
              setBaseState(cleared.baseState);
            }
            setOuts(newOuts);
            showMsg("destructive", "Caught stealing — runner removed, +1 out");
          }
        }
      } else {
        showMsg("error", res.error ?? "Failed to save baserunning event");
      }
    },
    [
      selectedGameId,
      inning,
      inningHalf,
      outs,
      batterId,
      saveBaserunningEventAction,
      runnerOn1bId,
      runnerOn2bId,
      runnerOn3bId,
      baseState,
    ]
  );

  const handleSave = async () => {
    if (!selectedGameId || !batterId || result === null) return;
    const pitcherPlayer = pitcherId ? players.find((p) => p.id === pitcherId) : null;
    const pitcherHandFromThrows = throwsToPitcherHand(pitcherPlayer?.throws);
    if (!pitcherId || !pitcherPlayer) {
      showMsg("error", "Select a pitcher (Game state).");
      return;
    }
    if (pitcherHandFromThrows === null) {
      showMsg(
        "error",
        "Selected pitcher has no throwing hand on file — set L/R in roster for that player."
      );
      return;
    }
    const sequenceBase: PitchSequenceEntry[] = draftPitchLog.map(
      ({ balls_before, strikes_before, outcome }) => ({
        balls_before,
        strikes_before,
        outcome,
      })
    );
    const sequenceForSave = withInferredInPlayPitch(sequenceBase, result);
    const pitchLogForSave: PitchEventDraft[] | undefined =
      sequenceForSave.length > 0
        ? sequenceForSave.map((row, i) => ({
            pitch_index: i + 1,
            balls_before: row.balls_before,
            strikes_before: row.strikes_before,
            outcome: row.outcome,
            pitch_type: null,
          }))
        : undefined;
    const seqSummary =
      sequenceForSave.length > 0 ? summarizePitchSequence(sequenceForSave) : null;

    if (seqSummary == null) {
      if (pitchesSeen === "") {
        showMsg("error", "Pitches seen is required.");
        return;
      }
      const pitchCountManual = pitchesSeen as number;
      if (pitchCountManual > 0) {
        if (strikesThrown === "") {
          showMsg("error", "Strikes thrown is required when pitches ≥ 1.");
          return;
        }
        const st = strikesThrown as number;
        if (st < 0 || st > pitchCountManual) {
          showMsg("error", "Strikes thrown must be between 0 and pitches seen.");
          return;
        }
      }
    }
    if (RESULT_IS_HIT.has(result) && hitDirection === null) {
      showMsg("error", "Hit direction is required for base hits (1B–HR).");
      return;
    }
    if (RESULT_ALLOWS_HIT_DIRECTION.has(result) && battedBallType === null) {
      showMsg("error", "Batted ball type is required for balls in play (GB, LD, FB, or IFF).");
      return;
    }
    if (result != null && requiresRunnerOnBaseForResult(result) && baseState === "000") {
      showMsg(
        "error",
        "GIDP, fielder's choice, and sacrifice plays require at least one runner on base."
      );
      return;
    }
    const ballsForResultGate = seqSummary?.finalBalls ?? countBalls;
    const strikesForResultGate = seqSummary?.finalStrikes ?? countStrikes;
    if (result != null && resultBlockedByPitchCount(result, ballsForResultGate, strikesForResultGate)) {
      showMsg(
        "error",
        result === "bb"
          ? "Set the count to 3 balls before recording a walk (BB)."
          : "Set the count to 2 strikes before recording a strikeout."
      );
      return;
    }
    if (
      (result === "so" || result === "so_looking") &&
      sequenceForSave.length > 0 &&
      !hasPutawayStrikeAtTwoStrikes(sequenceForSave)
    ) {
      showMsg(
        "error",
        "Strikeout with a pitch log: at 2 strikes, log the putaway with Called strike or Swing / miss, then save."
      );
      return;
    }
    if (result === "hr" && runsScoredPlayerIds.length === 0) {
      showMsg("error", "Home run: mark at least one scorer, or change the outcome.");
      return;
    }
    if (rbi > 0 && runsScoredPlayerIds.length === 0) {
      showMsg("error", "Select which runners scored (Who scored).");
      return;
    }
    if (runsScoredPlayerIds.length > 0 && rbi > runsScoredPlayerIds.length) {
      showMsg(
        "error",
        "RBI cannot exceed the number of runners marked as scoring on this play."
      );
      return;
    }
    if (rbi > 4) {
      showMsg("error", "RBI on one play cannot exceed 4.");
      return;
    }
    if (result === "reached_on_error") {
      if (!errorFielderId) {
        showMsg("error", "Select which fielder charged the error.");
        return;
      }
      if (!fieldersForErrorPicker.some((p) => p.id === errorFielderId)) {
        showMsg("error", "Chosen fielder is not on the defensive team — pick again.");
        return;
      }
    }
    if (
      result != null &&
      RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT.has(result) &&
      errorFielderId &&
      !fieldersForErrorPicker.some((p) => p.id === errorFielderId)
    ) {
      showMsg("error", "Chosen fielder is not on the defensive team — pick again.");
      return;
    }
    setSaving(true);
    try {
      const playFormatted =
        formatPlayWithDashes(playNote.trim()) ||
        (PLAY_ABBREVIATIONS[playNote.trim().toLowerCase()] ?? playNote.trim());
      const notesCombined = [playFormatted, notes.trim()].filter(Boolean).join(" — ") || null;
      const runsScoredIds = runsScoredPlayerIds;
      const persistUnearned =
        selectedGameId != null &&
        (result === "hr" ||
          computeShowEarnedUnearnedRunControls(
            allPAsForGame,
            selectedGameId,
            inning,
            inningHalf,
            result,
            errorFielderId
          ));
      const unearnedScorerIds = persistUnearned
        ? unearnedRunsScoredPlayerIds.filter((id) => runsScoredIds.includes(id))
        : [];
      let runs_scored_charged_pitcher_by_scorer: Record<string, string> | undefined;
      const inhCharge = inheritedForPriorPitcher.chargeId;
      const inhIds = inheritedForPriorPitcher.runnerIds;
      if (inhCharge && pitcherId && inhCharge !== pitcherId && inhIds.length > 0) {
        const m: Record<string, string> = {};
        for (const sid of runsScoredIds) {
          if (inhIds.includes(sid)) m[sid] = inhCharge;
        }
        if (Object.keys(m).length > 0) runs_scored_charged_pitcher_by_scorer = m;
      }
      const countBallsSave = seqSummary?.finalBalls ?? countBalls;
      const countStrikesRaw = seqSummary?.finalStrikes ?? countStrikes;
      /** DB / PA row: strikes top out at 2; pitch log replay may show 3 for the putaway row. */
      const countStrikesSave = Math.min(2, countStrikesRaw);
      const pitchCount = seqSummary?.pitches_seen ?? (pitchesSeen as number);
      const strikesThrownSave = seqSummary?.strikes_thrown ?? (pitchCount > 0 ? (strikesThrown as number) : 0);
      const firstPitchStrikeSave: boolean | null =
        pitchCount > 0
          ? seqSummary != null
            ? seqSummary.first_pitch_strike
            : firstCountFromZero === null
              ? countBallsSave === 0 && countStrikesSave === 0
                ? (strikesThrownSave as number) > 0
                : null
              : firstCountFromZero === "strike"
          : null;
      const pa: Omit<PlateAppearance, "id" | "created_at"> = {
        game_id: selectedGameId,
        batter_id: batterId,
        inning,
        outs,
        base_state: baseState,
        score_diff: 0,
        count_balls: countBallsSave,
        count_strikes: countStrikesSave,
        result,
        contact_quality: null,
        chase: null,
        hit_direction: RESULT_ALLOWS_HIT_DIRECTION.has(result) ? hitDirection : null,
        batted_ball_type: RESULT_ALLOWS_HIT_DIRECTION.has(result) ? battedBallType : null,
        pitches_seen: pitchCount,
        strikes_thrown: pitchCount > 0 ? strikesThrownSave : 0,
        first_pitch_strike: firstPitchStrikeSave,
        rbi,
        runs_scored_player_ids: runsScoredIds,
        unearned_runs_scored_player_ids: unearnedScorerIds,
        runs_scored_charged_pitcher_by_scorer: runs_scored_charged_pitcher_by_scorer ?? {},
        pitcher_hand: pitcherHandFromThrows,
        pitcher_id: pitcherId,
        error_fielder_id:
          (result === "reached_on_error" || RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT.has(result)) &&
          errorFielderId
            ? errorFielderId
            : null,
        inning_half: inningHalf ?? "top",
        notes: notesCombined,
      };
      const { ok, error, pa: insertedPa } = await savePlateAppearance(
        pa,
        pitchLogForSave
      );
      if (!ok) {
        showMsg("error", error ?? "Failed to save PA");
        return;
      }
      if (
        insertedPa?.id &&
        !insertedPa.id.startsWith("local-") &&
        pitchTrackerGroupId
      ) {
        const linkRes = await linkPitchTrackerGroupToPa(pitchTrackerGroupId, insertedPa.id);
        if (!linkRes.ok) {
          showMsg("error", linkRes.error ?? "Pitch tracker rows could not be linked to this PA.");
        }
      }
      if (selectedGameId) {
        const nextTracker = newPitchTrackerGroupId();
        writeStoredPitchTrackerGroupId(selectedGameId, nextTracker);
        setPitchTrackerGroupId(nextTracker);
        void persistPitchTrackerGroupToGame(selectedGameId, nextTracker);
      }
      const scorerIds = runsScoredIds;
      const scorerNames = scorerIds.map(
        (id) => players.find((p) => p.id === id)?.name ?? "?"
      );
      const unearnedNameSet = new Set(unearnedScorerIds);
      const unearnedRunsScoredNames = scorerIds
        .filter((id) => unearnedNameSet.has(id))
        .map((id) => players.find((p) => p.id === id)?.name ?? "?");
      const resultLabel =
        RESULT_OPTIONS.find((o) => o.value === result)?.label ?? result;
      const batterName = players.find((p) => p.id === batterId)?.name ?? "?";
      const pitcherName = players.find((p) => p.id === pitcherId)?.name ?? "?";
      const hitDirectionLabel =
        hitDirection === "pulled"
          ? "Pull"
          : hitDirection === "up_the_middle"
            ? "Middle"
            : hitDirection === "opposite_field"
              ? "Oppo"
              : null;
      const errorFielderName =
        errorFielderId &&
        (result === "reached_on_error" || RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT.has(result))
          ? players.find((p) => p.id === errorFielderId)?.name ?? "?"
          : null;
      setLastSavedPaSummary({
        inning,
        inningHalf: inningHalf ?? null,
        batterName,
        pitcherName,
        resultLabel,
        countLabel: `${countBallsSave}-${Math.min(countStrikesRaw, 3)}`,
        pitchLine:
          pitchCount > 0
            ? `${pitchCount} pitches · ${strikesThrownSave} strikes`
            : "0 pitches",
        hitDirectionLabel,
        errorFielderName,
        notes: notesCombined,
        rbi,
        runsScoredNames: scorerNames,
        unearnedRunsScoredNames,
      });
      lastRepeatablePaRef.current = {
        result,
        countBalls: countBallsSave,
        countStrikes: countStrikesRaw,
      };
      showMsg(
        "success",
        scorerNames.length > 0
          ? `PA saved — Scored: ${scorerNames.join(", ")}`
          : "PA saved — No runs scored on this play"
      );
      const optimisticPa: PlateAppearance = insertedPa ?? {
        ...pa,
        id: `local-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      setAllPAsForGame((prev) => [...prev, optimisticPa]);
      if (pitchLogForSave && pitchLogForSave.length > 0 && optimisticPa.id) {
        const created = new Date().toISOString();
        setGamePitchEvents((prev) => [
          ...prev,
          ...pitchLogForSave.map((row) => ({
            id: `local-pe-${optimisticPa.id}-${row.pitch_index}`,
            pa_id: optimisticPa.id,
            pitch_index: row.pitch_index,
            balls_before: row.balls_before,
            strikes_before: row.strikes_before,
            outcome: row.outcome,
            pitch_type: row.pitch_type ?? null,
            created_at: created,
          })),
        ]);
      }
      setDraftPitchLog([]);
      setResult(null);
      setCountBalls(0);
      setCountStrikes(0);
      setRbi(0);
      setRunsScoredPlayerIds([]);
      setUnearnedRunsScoredPlayerIds([]);
      setInheritedForPriorPitcher((prev) => {
        const s = new Set(runsScoredIds);
        const nextIds = prev.runnerIds.filter((id) => !s.has(id));
        return {
          chargeId: nextIds.length === 0 ? null : prev.chargeId,
          runnerIds: nextIds,
        };
      });
      setErrorFielderId(null);
      setHitDirection(null);
      setBattedBallType(null);
      setPitchesSeen("");
      setStrikesThrown("");
      setPlayNote("");
      setNotes("");
      let advancedNextIdxForCurrentSide = nextBatterIndexBySide[battingSide] ?? 0;
      if (battersForDropdown.length > 0) {
        const idx = battersForDropdown.findIndex((p) => p.id === batterId);
        advancedNextIdxForCurrentSide =
          idx < 0 ? (nextBatterIndexBySide[battingSide] ?? 0) % battersForDropdown.length : (idx + 1) % battersForDropdown.length;
        setNextBatterIndexBySide((prev) => ({
          ...prev,
          [battingSide]: advancedNextIdxForCurrentSide,
        }));
      }
      const [newR1, newR2, newR3] = getRunnerIdsAfterResult(
        runnerOn1bId,
        runnerOn2bId,
        runnerOn3bId,
        batterId,
        result,
        baseState,
        rbi
      );
      const [cR1, cR2, cR3] = clearScoredRunnersFromSlots(newR1, newR2, newR3, runsScoredIds);
      const newBaseState = baseStateFromRunnerIds(cR1, cR2, cR3);
      if (result === "gidp") {
        const newOuts = outs + 2;
        const gidpHadRunner2ndOr3rd =
          baseState[1] === "1" ||
          baseState[2] === "1" ||
          runnerOn2bId != null ||
          runnerOn3bId != null;
        if (newOuts >= 3) {
          const next = autoAdvanceAfterThreeOuts(inning, inningHalf);
          setInning(next.inning);
          setInningHalf(next.half);
          setOuts(0);
          setBaseState("000");
          setRunnerOn1bId(null);
          setRunnerOn2bId(null);
          setRunnerOn3bId(null);
          {
            const nextSide = battingSideFromHalf(next.half);
            const nextBatters = battersForSide(nextSide);
            if (nextBatters.length > 0) {
              const nextIdx = (nextBatterIndexBySide[nextSide] ?? 0) % nextBatters.length;
              setBatterId(nextBatters[nextIdx]?.id ?? null);
            }
          }
        } else {
          setOuts(newOuts);
          setBaseState(newBaseState);
          setRunnerOn1bId(cR1);
          setRunnerOn2bId(cR2);
          setRunnerOn3bId(cR3);
          if (battersForDropdown.length > 0) {
            setBatterId(battersForDropdown[advancedNextIdxForCurrentSide]?.id ?? null);
          }
        }
        if (gidpHadRunner2ndOr3rd) {
          setTimeout(() => {
            window.alert(
              "GIDP: 1st-base runner was cleared and +2 outs were recorded. If a runner was on 2nd or 3rd, update the diamond to match what happened on the play (they may have been out or advanced)."
            );
          }, 150);
        }
      } else if (RESULT_ADDS_ONE_OUT.has(result)) {
        if (outs >= 2) {
          const next = autoAdvanceAfterThreeOuts(inning, inningHalf);
          setInning(next.inning);
          setInningHalf(next.half);
          setOuts(0);
          setBaseState("000");
          setRunnerOn1bId(null);
          setRunnerOn2bId(null);
          setRunnerOn3bId(null);
          {
            const nextSide = battingSideFromHalf(next.half);
            const nextBatters = battersForSide(nextSide);
            if (nextBatters.length > 0) {
              const nextIdx = (nextBatterIndexBySide[nextSide] ?? 0) % nextBatters.length;
              setBatterId(nextBatters[nextIdx]?.id ?? null);
            }
          }
        } else {
          setOuts((o) => o + 1);
          setBaseState(newBaseState);
          setRunnerOn1bId(cR1);
          setRunnerOn2bId(cR2);
          setRunnerOn3bId(cR3);
          if (battersForDropdown.length > 0) {
            setBatterId(battersForDropdown[advancedNextIdxForCurrentSide]?.id ?? null);
          }
        }
      } else {
        setBaseState(newBaseState);
        setRunnerOn1bId(cR1);
        setRunnerOn2bId(cR2);
        setRunnerOn3bId(cR3);
        if (battersForDropdown.length > 0) {
          setBatterId(battersForDropdown[advancedNextIdxForCurrentSide]?.id ?? null);
        }
      }
      {
        let wfInning = inning;
        let wfHalf: "top" | "bottom" = inningHalf ?? "top";
        let wfOuts = outs;
        let wfBase: BaseState = baseState;
        let wfR1: string | null = runnerOn1bId;
        let wfR2: string | null = runnerOn2bId;
        let wfR3: string | null = runnerOn3bId;
        const wfNextIdx = {
          ...nextBatterIndexBySide,
          [battingSide]: advancedNextIdxForCurrentSide,
        };
        const wfPitcherBySide = { ...pitcherBySide, [pitchingSide]: pitcherId };

        if (result === "gidp") {
          const newOutsGidp = outs + 2;
          if (newOutsGidp >= 3) {
            const next = autoAdvanceAfterThreeOuts(inning, inningHalf);
            wfInning = next.inning;
            wfHalf = next.half;
            wfOuts = 0;
            wfBase = "000";
            wfR1 = null;
            wfR2 = null;
            wfR3 = null;
          } else {
            wfOuts = newOutsGidp;
            wfBase = newBaseState;
            wfR1 = cR1;
            wfR2 = cR2;
            wfR3 = cR3;
          }
        } else if (RESULT_ADDS_ONE_OUT.has(result)) {
          if (outs >= 2) {
            const next = autoAdvanceAfterThreeOuts(inning, inningHalf);
            wfInning = next.inning;
            wfHalf = next.half;
            wfOuts = 0;
            wfBase = "000";
            wfR1 = null;
            wfR2 = null;
            wfR3 = null;
          } else {
            wfOuts = outs + 1;
            wfBase = newBaseState;
            wfR1 = cR1;
            wfR2 = cR2;
            wfR3 = cR3;
          }
        } else {
          wfBase = newBaseState;
          wfR1 = cR1;
          wfR2 = cR2;
          wfR3 = cR3;
        }

        mergeWorkflowDefaultsForGame(selectedGameId, {
          resumeSnapshot: {
            inning: Math.max(1, Math.min(wfInning, MAX_SELECTABLE_INNING)),
            inningHalf: wfHalf,
            outs: Math.max(0, Math.min(wfOuts, 2)),
            baseState: wfBase,
            runnerOn1bId: wfR1,
            runnerOn2bId: wfR2,
            runnerOn3bId: wfR3,
            nextBatterIndexBySide: wfNextIdx,
            pitcherBySide: wfPitcherBySide,
          },
          lastBattedBallType:
            RESULT_ALLOWS_HIT_DIRECTION.has(result) && battedBallType != null
              ? battedBallType
              : undefined,
        });
      }
      loadPAs({ resetBatter: false });
      queueMicrotask(() => {
        batterSelectRef.current?.focus();
      });
    } finally {
      setSaving(false);
    }
  };

  const lastPA = allPAsForGame.length > 0
    ? [...allPAsForGame].sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      )[0]
    : null;

  const requestUndoLastPA = () => {
    if (!lastPA || !selectedGameId) return;
    setDestructiveConfirm("undoLastPa");
  };

  const handleFinalizeGame = useCallback(async () => {
    if (!selectedGameId) return;
    const currentFinalAway = finalizedScoreSnapshot.away;
    const currentFinalHome = finalizedScoreSnapshot.home;
    if (currentFinalAway === liveAwayRuns && currentFinalHome === liveHomeRuns) {
      showMsg("success", `Already finalized. Final score: ${liveAwayRuns}-${liveHomeRuns}.`);
      router.push(`/analyst/games/${selectedGameId}/review`);
      return;
    }
    setFinalizingGame(true);
    try {
      const result = await finalizeGameScore(selectedGameId, liveHomeRuns, liveAwayRuns);
      if (!result.ok) {
        showMsg("error", result.error ?? "Failed to finalize game");
        return;
      }
      const wasPreviouslyFinalized = currentFinalAway != null && currentFinalHome != null;
      setFinalizedScoreSnapshot({ away: liveAwayRuns, home: liveHomeRuns });
      showMsg(
        "success",
        wasPreviouslyFinalized
          ? `Final score updated. Final: ${liveAwayRuns}-${liveHomeRuns}.`
          : `Game finalized. Final score: ${liveAwayRuns}-${liveHomeRuns}.`
      );
      router.push(`/analyst/games/${selectedGameId}/review`);
    } finally {
      setFinalizingGame(false);
    }
  }, [
    router,
    selectedGameId,
    finalizedScoreSnapshot.away,
    finalizedScoreSnapshot.home,
    finalizeGameScore,
    liveHomeRuns,
    liveAwayRuns,
    showMsg,
  ]);

  const handleDestructiveConfirm = async () => {
    if (destructiveConfirm === "undoLastPa") {
      if (!lastPA || !selectedGameId) return;
      setDestructivePending(true);
      try {
        const { ok, error } = await deletePlateAppearance(lastPA.id);
        setDestructiveConfirm(null);
        if (ok) {
          setLastSavedPaSummary(null);
          lastRepeatablePaRef.current = null;
          showMsg("destructive", "Last PA removed");
          loadPAs();
        } else {
          showMsg("error", error ?? "Failed to remove");
        }
      } finally {
        setDestructivePending(false);
      }
    } else if (destructiveConfirm === "clearGamePas") {
      if (!selectedGameId) return;
      setDestructivePending(true);
      setClearingPAs(true);
      try {
        const result = await clearPAsForGameAction(selectedGameId);
        setDestructiveConfirm(null);
        if (result.ok) {
          setLastSavedPaSummary(null);
          lastRepeatablePaRef.current = null;
          showMsg(
            "destructive",
            result.count > 0 ? `Cleared ${result.count} PA(s).` : "No PAs to clear."
          );
          loadPAs();
        } else {
          showMsg("error", result.error ?? "Failed to clear PAs.");
        }
      } finally {
        setDestructivePending(false);
        setClearingPAs(false);
      }
    } else if (destructiveConfirm === "finalizeGame") {
      setDestructivePending(true);
      setDestructiveConfirm(null);
      try {
        await handleFinalizeGame();
      } finally {
        setDestructivePending(false);
      }
    }
  };

  const clearForm = () => {
    setInning(1);
    setInningHalf("top");
    setOuts(0);
    setBaseState("000");
    setRunnerOn1bId(null);
    setRunnerOn2bId(null);
    setRunnerOn3bId(null);
    setBatterId(lineupAway.order[0] ?? lineupHome.order[0] ?? players[0]?.id ?? null);
    setResult(null);
    setCountBalls(0);
    setCountStrikes(0);
    setRbi(0);
    setRunsScoredPlayerIds([]);
    setUnearnedRunsScoredPlayerIds([]);
    setBaserunningEvents([]);
    setLastSavedPaSummary(null);
    lastRepeatablePaRef.current = null;
    setHitDirection(null);
    setBattedBallType(null);
    setPitcherId(null);
    setPitchesSeen("");
    setStrikesThrown("");
    setDraftPitchLog([]);
    setPlayNote("");
    setNotes("");
  };

  const selectedPitcher = pitcherId ? players.find((p) => p.id === pitcherId) : null;
  const pitcherReadOnlyAccentSuffix = useMemo(() => {
    if (!selectedPitcher) return null;
    const j = selectedPitcher.jersey?.trim();
    const th = throwsToPitcherHand(selectedPitcher.throws);
    const parts: string[] = [];
    if (j) parts.push(`#${j}`);
    if (th) parts.push(`${th}HP`);
    if (parts.length === 0) return null;
    return parts.join(" · ");
  }, [selectedPitcher]);
  const showPitcherWarning =
    Boolean(batterId || result !== null) &&
    (pitchersForDropdown.length === 0 ||
      !pitcherId ||
      throwsToPitcherHand(selectedPitcher?.throws) === null);
  const showPitchesWarning =
    Boolean(batterId) && result !== null && pitchesSeen === "";
  const showHitDirectionWarning =
    Boolean(batterId) &&
    result !== null &&
    RESULT_IS_HIT.has(result) &&
    hitDirection === null;
  const showBattedBallTypeWarning =
    Boolean(batterId) &&
    result !== null &&
    RESULT_ALLOWS_HIT_DIRECTION.has(result) &&
    battedBallType === null;

  /** Runners on base + batter — tap to mark who scored. */
  const scoringCandidates = useMemo(() => {
    const map = new Map<string, string[]>();
    const add = (id: string | null, label: string) => {
      if (!id) return;
      const cur = map.get(id) ?? [];
      if (!cur.includes(label)) cur.push(label);
      map.set(id, cur);
    };
    const b = baseState.padStart(3, "0").slice(0, 3);
    if (b[0] === "1") add(runnerOn1bId, "1st");
    if (b[1] === "1") add(runnerOn2bId, "2nd");
    if (b[2] === "1") add(runnerOn3bId, "3rd");
    add(batterId, "Batter");
    return Array.from(map.entries()).map(([id, labels]) => ({
      id,
      label: labels.join(" · "),
    }));
  }, [baseState, runnerOn1bId, runnerOn2bId, runnerOn3bId, batterId]);

  const scoringCandidateIdSet = useMemo(
    () => new Set(scoringCandidates.map((c) => c.id)),
    [scoringCandidates]
  );

  /** Max RBI for this PA (official max 4; cannot exceed number who scored on the play). */
  const rbiInputMax = Math.min(4, runsScoredPlayerIds.length);

  useEffect(() => {
    setRunsScoredPlayerIds((prev) => {
      const next = prev.filter((id) => scoringCandidateIdSet.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [scoringCandidateIdSet, runsScoredPlayerIds]);

  /**
   * Display-only fallback:
   * if user leaves count at 0-0 for a first-pitch outcome, infer first pitch from strikes thrown.
   */
  const inferredFirstPitchFromZero = useMemo<"ball" | "strike" | null>(() => {
    if (firstCountFromZero != null) return firstCountFromZero;
    if (countBalls !== 0 || countStrikes !== 0) return null;
    if (pitchesSeen === "" || pitchesSeen <= 0 || strikesThrown === "") return null;
    return (strikesThrown as number) > 0 ? "strike" : "ball";
  }, [firstCountFromZero, countBalls, countStrikes, pitchesSeen, strikesThrown]);

  /** Same frame as `draftPitchLog` updates (effect sync can lag one paint). */
  const livePitchSequenceSummary = useMemo(() => {
    if (draftPitchLog.length === 0) return null;
    const entries: PitchSequenceEntry[] = draftPitchLog.map(
      ({ balls_before, strikes_before, outcome }) => ({
        balls_before,
        strikes_before,
        outcome,
      })
    );
    return summarizePitchSequence(withInferredInPlayPitch(entries, result));
  }, [draftPitchLog, result]);

  const displayCountBalls = livePitchSequenceSummary?.finalBalls ?? countBalls;
  const displayCountStrikes = livePitchSequenceSummary?.finalStrikes ?? countStrikes;

  /** Coach pad reads `games.pitch_tracker_*` — must match PA form display (incl. pitch-log totals). */
  useEffect(() => {
    if (!selectedGameId || recordLocked) return;
    void persistPitchTrackerCountToGame(selectedGameId, displayCountBalls, displayCountStrikes);
  }, [selectedGameId, displayCountBalls, displayCountStrikes, recordLocked]);

  const displayPitchesSeen =
    livePitchSequenceSummary != null
      ? livePitchSequenceSummary.pitches_seen
      : pitchesSeen === ""
        ? null
        : pitchesSeen;
  const displayStrikesThrown =
    livePitchSequenceSummary != null
      ? livePitchSequenceSummary.strikes_thrown
      : strikesThrown === ""
        ? null
        : strikesThrown;

  const pitchTotalsFromLog = draftPitchLog.length > 0;

  const displayFirstPitchStrikeLabel = useMemo(() => {
    if (livePitchSequenceSummary != null && livePitchSequenceSummary.pitches_seen > 0) {
      const f = livePitchSequenceSummary.first_pitch_strike;
      if (f === true) return "Strike";
      if (f === false) return "Ball";
      return "—";
    }
    if (inferredFirstPitchFromZero === "strike") return "Strike";
    if (inferredFirstPitchFromZero === "ball") return "Ball";
    return "—";
  }, [livePitchSequenceSummary, inferredFirstPitchFromZero]);

  const outcomeCountGateRef = useRef({ balls: 0, strikes: 0 });
  outcomeCountGateRef.current = { balls: displayCountBalls, strikes: displayCountStrikes };

  const isPaDraftDirty = useMemo(() => {
    if (!selectedGameId) return false;
    if (draftPitchLog.length > 0) return true;
    if (result != null) return true;
    if (playNote.trim() !== "" || notes.trim() !== "") return true;
    if (runsScoredPlayerIds.length > 0) return true;
    if (unearnedRunsScoredPlayerIds.length > 0) return true;
    if (rbi !== 0) return true;
    if (countBalls !== 0 || countStrikes !== 0) return true;
    if (pitchesSeen !== "" || strikesThrown !== "") return true;
    if (firstCountFromZero != null) return true;
    if (hitDirection != null || battedBallType != null) return true;
    if (errorFielderId != null) return true;
    if (
      inheritedForPriorPitcher.runnerIds.length > 0 ||
      inheritedForPriorPitcher.chargeId != null
    ) {
      return true;
    }
    return false;
  }, [
    selectedGameId,
    draftPitchLog.length,
    result,
    playNote,
    notes,
    runsScoredPlayerIds.length,
    unearnedRunsScoredPlayerIds.length,
    rbi,
    countBalls,
    countStrikes,
    pitchesSeen,
    strikesThrown,
    firstCountFromZero,
    hitDirection,
    battedBallType,
    errorFielderId,
    inheritedForPriorPitcher.runnerIds.length,
    inheritedForPriorPitcher.chargeId,
  ]);

  useEffect(() => {
    if (!selectedGameId) return;
    const flush = () => {
      const snap = recordFormSnapshotRef.current;
      if (!snap) return;
      try {
        window.localStorage.setItem(
          recordFormStorageKey(selectedGameId),
          JSON.stringify(snap)
        );
      } catch {
        /* ignore */
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isPaDraftDirty) return;
      flush();
      e.preventDefault();
      e.returnValue = "";
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [selectedGameId, isPaDraftDirty]);

  const advanceToNextLineupBatter = useCallback(() => {
    if (battersForDropdown.length === 0) return;
    const idx = battersForDropdown.findIndex((p) => p.id === batterId);
    const curSlot =
      idx < 0
        ? (nextBatterIndexBySide[battingSide] ?? 0) % battersForDropdown.length
        : idx;
    const nextIdx = (curSlot + 1) % battersForDropdown.length;
    setNextBatterIndexBySide((prev) => ({ ...prev, [battingSide]: nextIdx }));
    setBatterId(battersForDropdown[nextIdx]?.id ?? null);
    queueMicrotask(() => batterSelectRef.current?.focus());
  }, [battersForDropdown, batterId, nextBatterIndexBySide, battingSide]);

  const repeatLastSavedOutcome = useCallback(() => {
    const rep = lastRepeatablePaRef.current;
    if (!rep) {
      showMsg("error", "Save a PA first to repeat its result.");
      return;
    }
    if (resultBlockedByPitchCount(rep.result, rep.countBalls, rep.countStrikes)) {
      showMsg("error", "Set the count to match that outcome, or change counts first.");
      return;
    }
    setDraftPitchLog([]);
    setCountBalls(rep.countBalls);
    setCountStrikes(rep.countStrikes);
    setFirstCountFromZero(null);
    setHitDirection(null);
    setBattedBallType(null);
    if (rep.result === "reached_on_error") {
      prevResultBeforeRoeModalRef.current = result;
      prevErrorFielderIdBeforeRoeModalRef.current = errorFielderId;
      setResult("reached_on_error");
      setErrorFielderModalMode("roe");
    } else {
      setErrorFielderId(null);
      setResult(rep.result);
    }
  }, [showMsg, result, errorFielderId]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const advanceToNextLineupBatterRef = useRef(advanceToNextLineupBatter);
  advanceToNextLineupBatterRef.current = advanceToNextLineupBatter;
  const repeatLastSavedOutcomeRef = useRef(repeatLastSavedOutcome);
  repeatLastSavedOutcomeRef.current = repeatLastSavedOutcome;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedGameId || recordLocked) return;
      const blockNavShortcuts =
        substitutionModalOpen ||
        pitcherChangeModalOpen ||
        destructiveConfirm != null ||
        errorFielderModalMode != null;
      if (blockNavShortcuts) return;
      if (shortcutsHelpOpen) {
        if (e.key === "Escape") {
          setShortcutsHelpOpen(false);
          e.preventDefault();
        }
        return;
      }
      if (isTypingInFormField(e.target)) return;

      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setShortcutsHelpOpen(true);
        return;
      }
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        batterSelectRef.current?.focus();
        return;
      }
      if (e.key === "j" || e.key === "J") {
        if (!batterId) return;
        e.preventDefault();
        advanceToNextLineupBatterRef.current();
        return;
      }
      if (e.key === "s" || e.key === "S") {
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        e.preventDefault();
        setSubstitutionModalOpen(true);
        return;
      }
      if (e.key === "p" || e.key === "P") {
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        e.preventDefault();
        setPitcherChangeModalOpen(true);
        return;
      }
      if (e.key === "r" || e.key === "R") {
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        e.preventDefault();
        repeatLastSavedOutcomeRef.current();
        return;
      }

      if (!batterId) return;
      if (e.key === "Enter") {
        handleSaveRef.current();
        return;
      }
      if (e.key >= "0" && e.key <= "9") {
        const idx = outcomeIndexFromDigitKey(e.key);
        if (idx == null) return;
        const opt = RESULT_OPTIONS[idx];
        if (!opt) return;
        const { balls, strikes } = outcomeCountGateRef.current;
        if (result === opt.value) {
          setResult(null);
          setErrorFielderId(null);
          setHitDirection(null);
          setBattedBallType(null);
          e.preventDefault();
          return;
        }
        if (resultBlockedByPitchCount(opt.value, balls, strikes)) return;
        if (opt.value === "reached_on_error") {
          prevResultBeforeRoeModalRef.current = result;
          prevErrorFielderIdBeforeRoeModalRef.current = errorFielderId;
          setResult("reached_on_error");
          setErrorFielderModalMode("roe");
        } else {
          setResult(opt.value);
        }
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    selectedGameId,
    recordLocked,
    batterId,
    result,
    errorFielderId,
    substitutionModalOpen,
    pitcherChangeModalOpen,
    destructiveConfirm,
    errorFielderModalMode,
    shortcutsHelpOpen,
  ]);

  return (
    <div className="space-y-2 pb-6 sm:space-y-3 sm:pb-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1
            id="record-pas-heading"
            className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]"
          >
            Record
          </h1>
          {selectedGameId && !recordLocked ? (
            <p className="mt-1 max-w-xl text-xs text-[var(--text-muted)]">
              {isPaDraftDirty
                ? "Unsaved PA — your draft is auto-saved in this browser. You may still see a leave warning until you save; Enter records the PA to the server."
                : "PA form auto-saves locally per game while you work."}
            </p>
          ) : null}
        </div>
        {selectedGameId && !recordLocked ? (
          <button
            type="button"
            data-record-shortcuts-ignore
            className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-[var(--border)] bg-[var(--bg-card)] text-base font-semibold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            onClick={() => setShortcutsHelpOpen(true)}
          >
            ?
          </button>
        ) : null}
      </header>

      {!selectedGameId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
          <p>
            No game selected. Open <strong className="font-medium text-[var(--text)]">Games</strong>, choose{" "}
            <strong className="font-medium text-[var(--text)]">Log</strong> on a row, then{" "}
            <strong className="font-medium text-[var(--text)]">Record</strong>.
          </p>
          <Link
            href="/analyst/games"
            className="mt-3 inline-block font-medium text-[var(--accent)] hover:underline"
          >
            Go to Games →
          </Link>
        </div>
      )}

      {selectedGameId && selectedGame && recordLocked && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-10 text-center sm:px-8">
          <p className="font-display text-lg font-semibold text-[var(--text)]">Recording is closed</p>
          <p className="mx-auto mt-3 max-w-lg text-sm text-[var(--text-muted)]">
            This game is finalized (
            <span className="tabular-nums text-[var(--text)]">
              {selectedGame.final_score_away ?? "—"}–{selectedGame.final_score_home ?? "—"}
            </span>
            ). The PA form is disabled. Use{" "}
            <Link href={analystGameLogHref(selectedGame.id)} className="font-medium text-[var(--accent)] hover:underline">
              Log
            </Link>{" "}
            to edit existing rows, or{" "}
            <Link
              href={analystGameReviewHref(selectedGame.id)}
              className="font-medium text-[var(--accent)] hover:underline"
            >
              Review
            </Link>{" "}
            for the box score.
          </p>
          <Link
            href="/analyst/games"
            className="mt-6 inline-flex min-h-[44px] items-center rounded-lg border-2 border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--accent)]/50"
          >
            All games
          </Link>
        </div>
      )}

      {selectedGameId && selectedGame && !recordLocked && (
        <main
          id="record-pas-main"
          aria-labelledby="record-pas-heading"
          className="contents"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
            <p className="text-sm font-medium text-[var(--text)]">
              {formatDateMMDDYYYY(selectedGame.date)} — {selectedGame.away_team} @ {selectedGame.home_team}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {finalizedScoreText ? (
                <span
                  className="inline-flex min-h-[44px] min-w-[12.5rem] items-center justify-center rounded-lg border-2 border-[var(--accent)]/60 bg-[var(--accent)]/12 px-5 py-2 text-base font-semibold tabular-nums tracking-wide text-[var(--accent)]"
                  title="Finalized score snapshot"
                >
                  Final: {finalizedScoreText}
                  {finalizedOutcomeText ? <span className="ml-3">({finalizedOutcomeText})</span> : null}
                </span>
              ) : null}
              {!isDemoId(selectedGameId) && (
                <button
                  type="button"
                  onClick={() => setDestructiveConfirm("finalizeGame")}
                  disabled={finalizingGame}
                  className="font-display min-h-[44px] rounded-lg border-2 border-[var(--danger)] bg-[var(--danger)]/15 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-[var(--danger)] transition hover:bg-[var(--danger)]/25 hover:border-[var(--danger)]/80 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Freeze final score snapshot from currently recorded PAs."
                >
                  {finalizingGame ? "Finalizing…" : "Finalize game"}
                </button>
              )}
            </div>
          </div>

          {toastMounted &&
            createPortal(
              <AnimatePresence mode="wait">
                {message && (
                  <motion.div
                    key={`${message.type}-${message.text}`}
                    role="alert"
                    aria-live={
                      message.type === "error" || message.type === "destructive"
                        ? "assertive"
                        : "polite"
                    }
                    initial={{ opacity: 0, y: -28, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -16, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 440, damping: 32 }}
                    className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex justify-center p-3 sm:p-4"
                  >
                    <div
                      className={`pointer-events-auto flex w-full max-w-xl items-start gap-3 rounded-xl border-2 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.55)] sm:gap-4 sm:px-5 sm:py-4 ${
                        message.type === "success"
                          ? "border-[var(--success)] bg-[#0a1f18] text-[var(--success)] ring-2 ring-[var(--success)]/25"
                          : message.type === "destructive"
                            ? "border-[var(--danger)] bg-[#1a1014] text-[#fecdd3] ring-2 ring-[var(--danger)]/35"
                            : "border-amber-400 bg-[#1f1810] text-[#fff8e8] ring-2 ring-amber-500/35"
                      }`}
                    >
                      {message.type === "error" ? (
                        <span
                          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-lg font-bold text-amber-300"
                          aria-hidden
                        >
                          !
                        </span>
                      ) : message.type === "destructive" ? (
                        <span
                          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--danger)]/25 text-xl font-bold leading-none text-[var(--danger)]"
                          aria-hidden
                        >
                          −
                        </span>
                      ) : (
                        <span
                          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--success)]/15 text-lg font-bold text-[var(--success)]"
                          aria-hidden
                        >
                          ✓
                        </span>
                      )}
                      <p className="min-w-0 flex-1 pt-0.5 text-base font-medium leading-snug tracking-tight sm:text-lg">
                        {message.text}
                      </p>
                      <button
                        type="button"
                        onClick={dismissMessage}
                        className={`shrink-0 rounded-lg px-2 py-1 text-sm font-semibold transition hover:bg-white/10 ${
                          message.type === "success"
                            ? "text-[var(--success)]"
                            : message.type === "destructive"
                              ? "text-[#fecdd3]"
                              : "text-amber-200"
                        }`}
                        aria-label="Dismiss notification"
                      >
                        ×
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body
            )}

          <div className="card-tech rounded-lg border p-2">
            <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
              <CurrentBatterPitchDataCard
                batterName={currentBatterPitchDataName}
                pas={pasForCurrentBatterPitchData}
                pitchEvents={pitchEventsForCurrentBatter}
                compact
              />
              <BattingPitchMixCard
                pas={pasForPitchMixUnderPitchingTable}
                players={players}
                pitchEvents={pitchEventsForPitchMixCard}
                compact
                currentPitcherId={pitcherId}
              />
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
            {/* Game state + At bat (left) · Outcome (right, sticky on lg) */}
            <div className="grid gap-1.5 lg:grid-cols-2 lg:gap-2 lg:items-start">
            <div className="min-w-0 space-y-1.5">
            {/* Game state */}
            <section
              className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5"
              aria-labelledby="record-h-game-state"
            >
              <h4
                id="record-h-game-state"
                className="font-display mb-1 text-[10px] font-semibold uppercase tracking-wider text-white"
              >
                Game state
              </h4>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3 sm:gap-x-6">
              <label htmlFor="record-inning-select" className="flex min-w-0 flex-col gap-1">
                <span className="font-heading text-xs font-semibold text-[var(--text)]">Inning</span>
                <select
                  id="record-inning-select"
                  value={inning}
                  onChange={(e) => setInning(Number(e.target.value))}
                  className="input-tech block min-h-[44px] w-[4.25rem] px-2 py-2 text-sm touch-manipulation"
                >
                  {INNING_SELECT_VALUES.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col gap-1">
                <span
                  id="record-half-label"
                  className="font-heading text-xs font-semibold text-[var(--text)]"
                >
                  Half
                </span>
                <div
                  role="group"
                  aria-labelledby="record-half-label"
                  className="flex gap-1"
                >
                  {(["top", "bottom"] as const).map((half) => (
                    <button
                      key={half}
                      type="button"
                      onClick={() => setInningHalf(half)}
                      aria-label={
                        inningHalf === half
                          ? `${half} half, selected`
                          : `${half} half`
                      }
                      className={`min-h-[44px] min-w-[52px] cursor-pointer rounded-lg border-2 px-2 py-2 text-sm font-medium capitalize transition duration-200 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)] ${
                        inningHalf === half
                          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)]"
                          : "border-[var(--border)] bg-transparent text-[var(--text-muted)]"
                      }`}
                    >
                      {half}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span
                  id="record-outs-label"
                  className="font-heading text-xs font-semibold text-[var(--text)]"
                >
                  Outs
                </span>
                <div role="group" aria-labelledby="record-outs-label" className="flex gap-1">
                  {[0, 1, 2].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setOuts(n)}
                      aria-label={
                        outs === n
                          ? `${n} out${n === 1 ? "" : "s"}, selected`
                          : `${n} out${n === 1 ? "" : "s"}`
                      }
                      className={`min-h-[44px] min-w-[44px] cursor-pointer rounded-lg border-2 px-2 py-2 text-base font-semibold transition duration-200 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)] ${
                        outs === n
                          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)] hover:opacity-90"
                          : "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-[var(--accent)]/60"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-2 block">
              <span className="font-heading text-xs font-semibold text-[var(--text)]">
                Pitcher (
                {pitchingSide === "home" ? selectedGame.home_team : selectedGame.away_team})
              </span>
              <div className="mt-0.5 flex max-w-md flex-col gap-2 sm:flex-row sm:items-stretch">
                <div
                  className="input-tech flex min-h-[44px] flex-1 items-center px-3 py-2 text-sm text-[var(--text)]"
                  role="status"
                  aria-label="Current pitcher"
                >
                  <span className="min-w-0 truncate">
                    {pitchersForDropdown.length === 0 ? (
                      "No pitchers on roster"
                    ) : !selectedPitcher ? (
                      "—"
                    ) : (
                      <>
                        <span className="text-[var(--text)]">{selectedPitcher.name}</span>
                        {pitcherReadOnlyAccentSuffix ? (
                          <span className="font-semibold text-[var(--accent)]">
                            {" "}
                            {pitcherReadOnlyAccentSuffix}
                          </span>
                        ) : null}
                      </>
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPitcherChangeModalOpen(true)}
                  disabled={pitchersForDropdown.length === 0}
                  className="font-display min-h-[44px] shrink-0 rounded-lg border-2 border-[var(--accent)] bg-[var(--accent)]/12 px-4 py-2 text-center text-sm font-semibold tracking-wide text-[var(--accent)] transition hover:bg-[var(--accent)]/22 disabled:cursor-not-allowed disabled:opacity-45 touch-manipulation"
                >
                  Change pitcher
                </button>
              </div>
              {showPitcherWarning && (
                <p className="mt-1 text-[11px] leading-snug text-[var(--warning)]">
                  {pitchersForDropdown.length === 0
                    ? "Add at least one pitcher (position P, throwing hand) on the defensive team’s roster."
                    : !pitcherId
                      ? "Select a pitcher."
                      : "Selected pitcher needs a throwing hand (L/R) on the player profile."}
                </p>
              )}
            </div>
            </section>

            {/* At bat */}
            <section
              className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5 sm:p-2"
              aria-labelledby="record-h-at-bat"
            >
              <h4
                id="record-h-at-bat"
                className="font-display mb-1 text-[10px] font-semibold uppercase tracking-wider text-white"
              >
                At bat
              </h4>
              <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-start sm:gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)]">
                <div className="min-w-0 space-y-1.5 sm:self-start">
                  <div>
                    <span className="font-heading text-xs font-semibold text-[var(--text)]">Batter</span>
                    <select
                      ref={batterSelectRef}
                      value={batterId ?? ""}
                      onChange={(e) => setBatterId(e.target.value || null)}
                      className="input-tech mt-0.5 block w-full max-w-[11.5rem] min-h-[36px] px-2 py-1.5 text-sm touch-manipulation sm:max-w-[12.5rem]"
                      aria-label="Batter"
                    >
                      <option value="">Select</option>
                      {battersForDropdown.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.jersey ? `#${p.jersey}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                <div
                  role="status"
                  aria-live="polite"
                  aria-label={`Count ${displayCountBalls}-${displayCountStrikes}, ${displayPitchesSeen ?? "—"} pitches, ${displayStrikesThrown ?? "—"} strikes thrown`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text)]">
                    {pitchTotalsFromLog ? "Pitch totals (from log)" : "Totals only (no pitch log)"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-end gap-3 sm:gap-4">
                    <label className="flex flex-col gap-0.5 text-[11px] text-[var(--text)]">
                      B
                      <input
                        type="number"
                        min={0}
                        max={3}
                        readOnly={pitchTotalsFromLog}
                        value={pitchTotalsFromLog ? displayCountBalls : countBalls}
                        onChange={
                          pitchTotalsFromLog
                            ? undefined
                            : (e) => {
                                const v = Math.max(0, Math.min(3, Number(e.target.value) || 0));
                                if (countBalls === 0 && countStrikes === 0) {
                                  if (v > 0) setFirstCountFromZero("ball");
                                  else setFirstCountFromZero(null);
                                } else if (v === 0 && countStrikes === 0 && countBalls > 0) {
                                  setFirstCountFromZero(null);
                                }
                                setCountBalls(v);
                              }
                        }
                        className={`input-tech input-no-spinner h-9 w-11 px-1 text-center text-sm tabular-nums ${
                          pitchTotalsFromLog ? "cursor-default bg-[var(--bg-base)] text-[var(--text)]" : ""
                        }`}
                        aria-label="Balls in count"
                      />
                    </label>
                    <label className="flex flex-col gap-0.5 text-[11px] text-[var(--text)]">
                      S
                      <input
                        type="number"
                        min={0}
                        max={pitchTotalsFromLog ? 3 : 2}
                        readOnly={pitchTotalsFromLog}
                        value={pitchTotalsFromLog ? displayCountStrikes : countStrikes}
                        onChange={
                          pitchTotalsFromLog
                            ? undefined
                            : (e) => {
                                const v = Math.max(0, Math.min(2, Number(e.target.value) || 0));
                                if (countBalls === 0 && countStrikes === 0) {
                                  if (v > 0) setFirstCountFromZero("strike");
                                  else setFirstCountFromZero(null);
                                } else if (v === 0 && countBalls === 0 && countStrikes > 0) {
                                  setFirstCountFromZero(null);
                                }
                                setCountStrikes(v);
                              }
                        }
                        className={`input-tech input-no-spinner h-9 w-11 px-1 text-center text-sm tabular-nums ${
                          pitchTotalsFromLog ? "cursor-default bg-[var(--bg-base)] text-[var(--text)]" : ""
                        }`}
                        aria-label="Strikes in count"
                      />
                    </label>
                    <label className="flex flex-col gap-0.5 text-[11px] text-[var(--text)]">
                      Pitches
                      <input
                        type="number"
                        min={0}
                        readOnly={pitchTotalsFromLog}
                        value={
                          pitchTotalsFromLog
                            ? displayPitchesSeen ?? 0
                            : pitchesSeen === ""
                              ? ""
                              : pitchesSeen
                        }
                        onChange={
                          pitchTotalsFromLog
                            ? undefined
                            : (e) =>
                                setPitchesSeen(
                                  e.target.value === "" ? "" : Math.max(0, Number(e.target.value))
                                )
                        }
                        className={`input-tech input-no-spinner h-9 w-12 px-1 text-center text-sm tabular-nums ${
                          pitchTotalsFromLog ? "cursor-default bg-[var(--bg-base)] text-[var(--text)]" : ""
                        }`}
                        aria-label="Pitches seen"
                      />
                    </label>
                    <label className="flex flex-col gap-0.5 text-[11px] text-[var(--text)]">
                      Strikes thr.
                      <input
                        type="number"
                        min={0}
                        readOnly={pitchTotalsFromLog}
                        value={
                          pitchTotalsFromLog
                            ? displayStrikesThrown ?? 0
                            : strikesThrown === ""
                              ? ""
                              : strikesThrown
                        }
                        onChange={
                          pitchTotalsFromLog
                            ? undefined
                            : (e) =>
                                setStrikesThrown(
                                  e.target.value === "" ? "" : Math.max(0, Number(e.target.value))
                                )
                        }
                        className={`input-tech input-no-spinner h-9 w-12 px-1 text-center text-sm tabular-nums ${
                          pitchTotalsFromLog ? "cursor-default bg-[var(--bg-base)] text-[var(--text)]" : ""
                        }`}
                        aria-label="Strikes thrown"
                      />
                    </label>
                  </div>
                  {!pitchTotalsFromLog && showPitchesWarning && (
                    <p className="mt-1.5 text-[11px] leading-snug text-[var(--warning)]">
                      Pitches seen is required.
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        displayFirstPitchStrikeLabel !== "—"
                          ? "text-[var(--accent)]"
                          : "text-[var(--text-muted)]"
                      }`}
                    >
                      First pitch (FPS%): {displayFirstPitchStrikeLabel}
                    </span>
                  </div>
                </div>

                <details className="mt-2">
                  <summary className="mb-0.5 cursor-pointer list-none text-[9px] text-[var(--text-muted)] underline decoration-dotted underline-offset-2 marker:content-none [&::-webkit-details-marker]:hidden">
                    Pitch log tips
                  </summary>
                  <p className="mt-1 text-[9px] leading-snug text-[var(--text-muted)]">
                    Tap a pitch — count updates live. At 2 strikes you can still tap Called or Whiff for the putaway strike; Foul stays available for two-strike fouls. If you use a pitch log and save a strikeout, log that putaway pitch before saving. Walk / HBP without a log: use Outcome only; clear the log if not logging pitches.
                  </p>
                </details>

                <div className="mt-2 grid w-full min-w-0 max-w-[min(100%,13rem)] grid-cols-3 grid-rows-2 gap-1 sm:gap-1.5">
                  {PITCH_LOG_BUTTONS.map(({ outcome, label, title }) => {
                    const lastPitch =
                      draftPitchLog.length > 0
                        ? {
                            balls_before: draftPitchLog[draftPitchLog.length - 1]!.balls_before,
                            strikes_before: draftPitchLog[draftPitchLog.length - 1]!.strikes_before,
                            outcome: draftPitchLog[draftPitchLog.length - 1]!.outcome,
                          }
                        : null;
                    const countBlocked = isPitchOutcomeBlockedByFullCount(
                      pitchLogEndCount.balls,
                      pitchLogEndCount.strikes,
                      outcome,
                      lastPitch
                    );
                    const blockHint =
                      outcome === "ball"
                        ? "3 balls already — choose Walk (BB) as outcome."
                        : "Putaway strike already logged at 2 strikes — Undo to change.";
                    return (
                      <button
                        key={outcome}
                        type="button"
                        title={countBlocked ? blockHint : title}
                        disabled={countBlocked}
                        onClick={() => appendDraftPitch(outcome)}
                        className="flex min-h-[40px] w-full items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-1 py-1.5 text-[11px] font-semibold leading-tight text-[var(--text)] transition hover:border-[var(--accent)]/60 hover:bg-[var(--bg-elevated)] touch-manipulation disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border)] disabled:hover:bg-[var(--bg-input)] sm:min-h-[44px] sm:text-xs"
                      >
                        {label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={undoLastDraftPitch}
                    disabled={draftPitchLog.length === 0}
                    className="flex min-h-[40px] w-full items-center justify-center rounded-md border border-[var(--border)] px-1 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--border)]/30 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[44px] sm:text-xs"
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    onClick={clearDraftPitchLog}
                    disabled={draftPitchLog.length === 0}
                    className="flex min-h-[40px] w-full items-center justify-center rounded-md border border-[var(--danger)]/40 px-1 py-1.5 text-[11px] font-medium text-[var(--danger)] transition hover:bg-[var(--danger)]/10 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[44px] sm:text-xs"
                  >
                    Clear
                  </button>
                </div>
                </div>

                <div className="min-w-0 sm:min-h-0">
                  <span className="mb-1 block font-heading text-xs font-semibold text-[var(--text)]">
                    Sequence
                  </span>
                  {selectedGameId ? (
                    <PitchTrackerSequence
                      gameId={selectedGameId}
                      trackerGroupId={pitchTrackerGroupId}
                      batterId={batterId}
                      pitcherId={pitcherId}
                      outs={outs}
                      players={players}
                      disabled={recordLocked}
                      coachPitchRows={coachPitchRows}
                      coachPitchesLoading={coachPitchesLoading}
                      refreshCoachPitches={refreshCoachPitches}
                      onTrackerGroupIdChange={(id) => {
                        setPitchTrackerGroupId(id);
                        if (selectedGameId) {
                          writeStoredPitchTrackerGroupId(selectedGameId, id);
                          void persistPitchTrackerGroupToGame(selectedGameId, id);
                        }
                      }}
                    />
                  ) : null}
                  {draftPitchLog.length > 0 ? (
                    <ul className="max-h-40 space-y-1 overflow-y-auto overscroll-contain sm:max-h-[min(28rem,65dvh)]">
                      {draftPitchLog.map((row, i) => {
                        const prefix: PitchSequenceEntry[] = draftPitchLog.slice(0, i + 1).map((r) => ({
                          balls_before: r.balls_before,
                          strikes_before: r.strikes_before,
                          outcome: r.outcome,
                        }));
                        const after = replayCountAtEndOfSequence(prefix);
                        const lbl =
                          PITCH_LOG_BUTTONS.find((b) => b.outcome === row.outcome)?.label ??
                          (row.outcome === "in_play"
                            ? "In play"
                            : row.outcome.replace(/_/g, " "));
                        const coachType =
                          coachPitchRows.find((p) => p.pitch_number === i + 1)?.pitch_type ?? null;
                        return (
                          <li key={row.clientKey}>
                            <div
                              className="flex flex-wrap items-center gap-x-2 gap-y-0 rounded-md border border-[var(--border)] bg-[var(--bg-base)]/50 px-2 py-1.5 text-[11px] sm:text-xs"
                              aria-label={`Pitch ${i + 1}: ${coachType ? pitchTrackerAbbrev(coachType) : "type pending"} ${lbl} count ${row.balls_before}-${row.strikes_before} to ${after.balls}-${after.strikes}`}
                            >
                              {coachType ? (
                                <span
                                  className={`inline-flex h-5 shrink-0 items-center justify-center rounded border px-1 text-[10px] font-bold ${pitchTrackerTypeChipClass(coachType)}`}
                                  title={pitchTrackerTypeLabel(coachType)}
                                >
                                  {pitchTrackerAbbrev(coachType)}
                                </span>
                              ) : (
                                <span
                                  className="inline-flex h-5 min-w-[1.75rem] shrink-0 items-center justify-center rounded border border-dashed border-[var(--border)] px-1 text-[9px] font-medium text-[var(--text-muted)] opacity-75"
                                  title="Coach pitch type (iPad) — appears when logged for this pitch #"
                                >
                                  —
                                </span>
                              )}
                              <span className="min-w-0 shrink-0 font-semibold text-[var(--text)]">{lbl}</span>
                              <span className="shrink-0 text-[var(--text-muted)]" aria-hidden>
                                →
                              </span>
                              <div className="ml-auto flex min-w-0 shrink-0 items-center gap-x-1.5 tabular-nums sm:gap-x-2">
                                <span className="text-[var(--text-muted)]">
                                  {row.balls_before}-{row.strikes_before}
                                </span>
                                <span className="shrink-0 text-[var(--text-muted)]" aria-hidden>
                                  →
                                </span>
                                <span className="font-semibold text-[var(--accent)]">
                                  {after.balls}-{after.strikes}
                                </span>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                      {result != null &&
                        resultImpliesBattedBallInPlay(result) &&
                        draftPitchLog[draftPitchLog.length - 1]?.outcome !== "in_play" && (
                          <li>
                            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-dashed border-[var(--accent)]/45 bg-[var(--accent-dim)]/10 px-2 py-1.5 text-[10px] text-[var(--text-muted)]">
                              <span className="font-medium text-[var(--accent)]">+ In play</span>
                              <span className="truncate">
                                ({RESULT_OPTIONS.find((o) => o.value === result)?.label ?? result})
                              </span>
                            </div>
                          </li>
                        )}
                    </ul>
                  ) : !selectedGameId ? (
                    <p className="py-2 text-[11px] leading-snug text-[var(--text-muted)]">
                      Tap Ball, Called, Whiff, or Foul — each pitch appears here.
                    </p>
                  ) : (
                    <p className="py-1 text-[10px] leading-snug text-[var(--text-muted)]">
                      Each pitch you log appears here with a slot for the coach’s pitch type (iPad). Use{" "}
                      <span className="text-[var(--accent)]">iPad link &amp; tools</span> above.
                    </p>
                  )}
                </div>
              </div>
            </section>
            </div>

            {/* Outcome */}
            <section
              className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] p-2 sm:p-3 lg:sticky lg:top-2 lg:z-10 lg:max-h-[calc(100dvh-5rem)] lg:overflow-y-auto lg:overscroll-contain"
              aria-labelledby="record-h-outcome"
            >
              <h4
                id="record-h-outcome"
                className="font-display mb-2 text-[10px] font-semibold uppercase tracking-wider text-white"
              >
                Outcome
              </h4>
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-5">
                    {(["Hits", "Outs", "Reach", "Other"] as const).map((label) => {
                      const group = RESULT_GROUPS.find((g) => g.label === label);
                      if (!group) return null;
                      const runnerAware = label === "Outs" || label === "Other";
                      const hitErrorForGrid =
                        result != null && RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT.has(result);
                      const gridClass =
                        label === "Hits"
                          ? "grid grid-cols-4 gap-2"
                          : label === "Outs"
                            ? "grid grid-cols-3 gap-2"
                            : label === "Reach"
                              ? "flex flex-wrap gap-2"
                              : label === "Other"
                                ? "grid grid-cols-2 gap-2"
                                : "grid grid-cols-3 gap-2";
                      return (
                        <div key={group.label} className="min-w-0">
                          <span className="mb-2.5 block font-heading text-xs font-semibold text-[var(--text)]">
                            {group.label}
                          </span>
                          <div className={gridClass}>
                            {group.options.map((opt) => {
                              const runnerRequiredBlocked =
                                runnerAware &&
                                requiresRunnerOnBaseForResult(opt.value) &&
                                baseState === "000";
                              const countBlocked = resultBlockedByPitchCount(
                                opt.value,
                                displayCountBalls,
                                displayCountStrikes
                              );
                              const countHint = pitchCountBlockHint(
                                opt.value,
                                displayCountBalls,
                                displayCountStrikes
                              );
                              const disabled = runnerRequiredBlocked || countBlocked;
                              const runnerHint = runnerRequiredBlocked
                                ? "Put at least one runner on base before recording GIDP, fielder's choice, or a sacrifice."
                                : undefined;
                              const title = runnerAware
                                ? [runnerHint, countHint].filter(Boolean).join(" ") || undefined
                                : countHint;
                              const spanFull = label === "Reach" && opt.value === "reached_on_error";
                              const selected = result === opt.value;
                              const inactive = disabled
                                ? "cursor-not-allowed border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] opacity-60"
                                : selected
                                  ? "cursor-pointer border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)] hover:opacity-90"
                                  : "cursor-pointer border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--bg-elevated)]";
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  title={title || undefined}
                                  disabled={disabled}
                                  onClick={() => {
                                    if (opt.value === "reached_on_error") {
                                      if (result === "reached_on_error") {
                                        setResult(null);
                                        setErrorFielderId(null);
                                        setHitDirection(null);
                                        setBattedBallType(null);
                                        return;
                                      }
                                      prevResultBeforeRoeModalRef.current = result;
                                      prevErrorFielderIdBeforeRoeModalRef.current = errorFielderId;
                                      setResult("reached_on_error");
                                      setErrorFielderModalMode("roe");
                                    } else if (result === opt.value) {
                                      setResult(null);
                                      setErrorFielderId(null);
                                      setHitDirection(null);
                                      setBattedBallType(null);
                                    } else {
                                      setResult(opt.value);
                                    }
                                  }}
                                  className={`min-h-[42px] rounded-lg border-2 px-2 py-2 text-center text-xs font-semibold transition duration-200 touch-manipulation sm:min-h-[44px] sm:px-2.5 sm:text-sm ${inactive} ${
                                    label === "Hits" || label === "Outs" || label === "Other"
                                      ? "w-full"
                                      : spanFull
                                        ? "min-w-[12rem] flex-1 basis-full sm:basis-auto sm:min-w-[14rem]"
                                        : "min-w-[3rem] flex-1 basis-[calc(50%-0.25rem)] sm:basis-auto sm:min-w-[3.25rem]"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                            {label === "Other" ? (
                              <button
                                type="button"
                                disabled={!hitErrorForGrid}
                                title={
                                  hitErrorForGrid
                                    ? errorFielderId
                                      ? `Fielding error: ${players.find((p) => p.id === errorFielderId)?.name ?? "?"}. Tap to change.`
                                      : "Charge a fielding error after a clean hit (batter keeps 1B / 2B / 3B)."
                                    : "Select 1B, 2B, or 3B first — then tap Error to charge a fielder for an extra base."
                                }
                                onClick={() => {
                                  if (hitErrorForGrid) setErrorFielderModalMode("hit");
                                }}
                                className={`min-h-[42px] w-full rounded-lg border-2 px-2 py-2 text-center text-xs font-semibold transition duration-200 touch-manipulation sm:min-h-[44px] sm:px-2.5 sm:text-sm ${
                                  !hitErrorForGrid
                                    ? "cursor-not-allowed border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] opacity-60"
                                    : errorFielderId
                                      ? "cursor-pointer border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)] hover:opacity-90"
                                      : "cursor-pointer border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--bg-elevated)]"
                                }`}
                              >
                                Error
                              </button>
                            ) : null}
                          </div>
                          {label === "Other" && hitErrorForGrid && errorFielderId ? (
                            <p className="mt-2 text-[10px] leading-snug text-[var(--text-muted)]">
                              E: {players.find((p) => p.id === errorFielderId)?.name ?? "?"}
                              <button
                                type="button"
                                onClick={() => setErrorFielderId(null)}
                                className="ml-2 font-medium text-[var(--text)] underline decoration-[var(--border)] underline-offset-2 hover:text-[var(--danger)] touch-manipulation"
                              >
                                Clear
                              </button>
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                </div>

                <div className="border-t border-[var(--border)]/55 pt-5">
                  <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
                    <div className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-white">
                        Hit direction
                      </span>
                      <div className="mt-2 grid grid-cols-2 gap-2.5 sm:gap-3">
                        {[
                          { value: "pulled" as const, label: "Pulled" },
                          { value: "up_the_middle" as const, label: "Up the middle" },
                          { value: "opposite_field" as const, label: "Opposite field", span: true as const },
                        ].map(({ value, label, span }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() =>
                              setHitDirection((h) => (h === value ? null : value))
                            }
                            className={`min-h-[42px] w-full cursor-pointer rounded-lg border-2 px-2 py-2 text-center text-xs font-semibold transition duration-200 touch-manipulation sm:min-h-[44px] sm:px-3 sm:text-sm ${
                              span ? "col-span-2" : ""
                            } ${
                              hitDirection === value
                                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)] hover:opacity-90"
                                : "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--bg-elevated)]"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {showHitDirectionWarning && (
                        <p className="mt-2 text-[11px] leading-snug text-[var(--warning)]">
                          Choose pull, middle, or oppo for this base hit.
                        </p>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-white">
                        Batted ball (GB / LD / FB / IFF)
                      </span>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:gap-2.5">
                        {BATTED_BALL_TYPE_OPTIONS.map(({ value, label, title }) => (
                          <button
                            key={value}
                            type="button"
                            title={title}
                            onClick={() =>
                              setBattedBallType((t) => (t === value ? null : t))
                            }
                            className={`min-h-[42px] w-full cursor-pointer rounded-lg border-2 px-2 py-2 text-center text-xs font-semibold transition duration-200 touch-manipulation sm:min-h-[44px] sm:px-2.5 sm:text-sm ${
                              battedBallType === value
                                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)] hover:opacity-90"
                                : "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--bg-elevated)]"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {showBattedBallTypeWarning && (
                        <p className="mt-2 text-[11px] leading-snug text-[var(--warning)]">
                          Choose GB, LD, FB, or IFF for this ball in play.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-[var(--border)]/55 pt-5">
                  <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-x-6 sm:gap-y-2">
                    <div className="flex shrink-0 flex-wrap items-center gap-2 pt-0.5 sm:pt-1">
                      <span className="font-heading text-xs font-semibold text-[var(--text)]">RBI</span>
                      <input
                        type="number"
                        min={0}
                        max={Math.max(0, rbiInputMax)}
                        readOnly={result === "hr"}
                        value={rbi}
                        onChange={(e) => {
                          if (result === "hr") return;
                          const raw = e.target.value;
                          if (raw === "") {
                            setRbi(0);
                            return;
                          }
                          const v = Number.parseInt(raw, 10);
                          if (Number.isNaN(v)) return;
                          setRbi(Math.max(0, Math.min(v, Math.max(0, rbiInputMax))));
                        }}
                        className={`input-tech input-no-spinner min-h-[40px] w-14 px-2 py-2 text-center text-sm tabular-nums touch-manipulation ${
                          result === "hr" ? "cursor-default opacity-90" : ""
                        }`}
                        aria-label={
                          result === "hr"
                            ? "RBI on home run (matches everyone who scored)"
                            : "RBI credited to the batter (can be less than Who scored, e.g. runs on error)"
                        }
                        title={
                          result === "hr"
                            ? "Home run: all baserunners and the batter score; RBI is set automatically."
                            : undefined
                        }
                      />
                    </div>
                    <div className="min-w-0 flex flex-col gap-2">
                      <span className="font-heading text-xs font-semibold text-[var(--text)]">Who scored</span>
                      <div className="flex min-w-0 flex-col gap-2">
                        {scoringCandidates.length > 0 ? (
                          <div className="flex flex-wrap gap-2" role="group" aria-label="Mark who scored">
                              {scoringCandidates.map(({ id, label }) => {
                                const selected = runsScoredPlayerIds.includes(id);
                                const unearned = unearnedRunsScoredPlayerIds.includes(id);
                                const p = players.find((x) => x.id === id);
                                const shortName =
                                  p?.name?.split(/\s+/).slice(-1)[0] ?? p?.name ?? "?";
                                const jersey = p?.jersey?.trim() || null;
                                const ariaJersey = jersey ? ` #${jersey}` : "";
                                return (
                                  <div key={id} className="flex min-w-0 flex-col gap-1">
                                    <button
                                      type="button"
                                      aria-label={`${label} ${shortName}${ariaJersey}: ${selected ? "scored — tap to unmark" : "not scored — tap to mark"}`}
                                      onClick={() => {
                                        const adding = !selected;
                                        setRunsScoredPlayerIds((prev) =>
                                          prev.includes(id)
                                            ? prev.filter((i) => i !== id)
                                            : [...prev, id]
                                        );
                                        if (result !== "hr" && adding) {
                                          setRbi((r) => Math.min(r + 1, 4));
                                        }
                                      }}
                                      className={`min-h-[40px] rounded-lg border-2 px-2.5 py-1.5 text-left text-xs font-semibold transition touch-manipulation ${
                                        selected
                                          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)]"
                                          : "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)] hover:border-[var(--accent)]/60 hover:bg-[var(--bg-elevated)]"
                                      }`}
                                    >
                                      <span
                                        className={`block text-[10px] font-medium uppercase tracking-wide ${
                                          selected
                                            ? "text-[var(--bg-base)]/85"
                                            : "text-[var(--text-muted)]"
                                        }`}
                                      >
                                        {label}
                                      </span>
                                      <span
                                        className={`block max-w-[11rem] truncate tabular-nums ${
                                          selected ? "text-[var(--bg-base)]" : "text-[var(--text)]"
                                        }`}
                                      >
                                        {shortName}
                                        {jersey ? (
                                          <span
                                            className={
                                              selected
                                                ? "font-semibold text-cyan-950"
                                                : "font-semibold text-[var(--accent)]"
                                            }
                                          >
                                            {" "}
                                            #{jersey}
                                          </span>
                                        ) : null}
                                      </span>
                                    </button>
                                    {selected && (result === "hr" || showEarnedUnearnedRunControls) ? (
                                      <div
                                        className="flex flex-wrap items-center gap-1"
                                        role="group"
                                        aria-label={`Earned or unearned run for ${shortName}${ariaJersey}`}
                                      >
                                        <button
                                          type="button"
                                          title="Earned run (counts toward pitcher ER)"
                                          onClick={() =>
                                            setUnearnedRunsScoredPlayerIds((prev) =>
                                              prev.filter((i) => i !== id)
                                            )
                                          }
                                          className={`min-h-[28px] min-w-[2rem] rounded-md border px-2 text-[11px] font-bold tabular-nums transition touch-manipulation ${
                                            !unearned
                                              ? "border-[var(--accent)] bg-[var(--accent)]/25 text-[var(--accent)]"
                                              : "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-[var(--accent)]/50"
                                          }`}
                                        >
                                          E
                                        </button>
                                        <button
                                          type="button"
                                          title="Unearned run (does not count toward pitcher ER)"
                                          onClick={() =>
                                            setUnearnedRunsScoredPlayerIds((prev) =>
                                              prev.includes(id)
                                                ? prev.filter((i) => i !== id)
                                                : [...prev, id]
                                            )
                                          }
                                          className={`min-h-[28px] min-w-[2.25rem] rounded-md border px-2 text-[11px] font-bold tabular-nums transition touch-manipulation ${
                                            unearned
                                              ? "border-[var(--danger)]/85 bg-[var(--danger-dim)] text-[var(--danger)]"
                                              : "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-[var(--danger)]/35"
                                          }`}
                                        >
                                          UE
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[11px] text-[var(--text-muted)]">
                              Put runners on base (Runners) or pick a batter to enable quick picks.
                            </p>
                          )}
                        </div>
                      </div>
                  </div>
                </div>
              </div>
            </section>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="cursor-pointer text-[11px] font-medium text-[var(--accent)] hover:underline"
              >
                {showDetails ? "− Hide details" : "+ Add details (play, notes)"}
              </button>
              {showDetails && (
                <div className="mt-1 grid grid-cols-1 gap-1 rounded border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5 sm:grid-cols-2">
                  <div className="space-y-0.5">
                    <span className="font-heading text-xs font-semibold text-[var(--text)]">Play</span>
                    <div className="mt-0.5 grid grid-cols-7 gap-2">
                      {PLAY_PRESETS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPlayNote(playNote === p ? "" : p)}
                          className={`flex min-h-[44px] w-full min-w-0 cursor-pointer items-center justify-center rounded-lg border-2 px-1 py-2 text-center text-xs font-medium transition duration-200 touch-manipulation sm:px-2 sm:text-sm ${
                            playNote === p
                              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)]"
                              : "border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:border-[var(--accent)]/50"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={playNote}
                      onChange={(e) => setPlayNote(e.target.value)}
                      onBlur={() => {
                        const raw = playNote.trim();
                        if (!raw) return;
                        const dashed = formatPlayWithDashes(raw);
                        if (dashed) {
                          setPlayNote(dashed);
                          return;
                        }
                        const key = raw.toLowerCase();
                        if (PLAY_ABBREVIATIONS[key]) {
                          setPlayNote(PLAY_ABBREVIATIONS[key]);
                        }
                      }}
                      className="input-tech mt-0.5 block w-full px-1.5 py-0.5 text-xs"
                      placeholder="6-4-3, F8, dp…"
                      aria-label="Play description"
                    />
                  </div>
                  <label className="space-y-0.5">
                    <span className="font-heading text-xs font-semibold text-[var(--text)]">Notes</span>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="input-tech mt-0.5 block w-full px-1.5 py-0.5 text-xs"
                      placeholder="Optional"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={requestUndoLastPA}
                disabled={!lastPA || destructivePending}
                title={
                  lastPA
                    ? "Remove the most recently saved plate appearance for this game."
                    : "Save a plate appearance first — then you can undo the last one if you mis-entered it."
                }
                className="min-h-[48px] shrink-0 rounded-lg border-2 border-[var(--border)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)] touch-manipulation disabled:cursor-not-allowed disabled:opacity-50"
              >
                Undo last PA
              </button>
              <button
                type="button"
                onClick={() => setSubstitutionModalOpen(true)}
                disabled={isDemoId(selectedGameId)}
                className="min-h-[48px] shrink-0 cursor-pointer rounded-lg border-2 border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--accent)]/60 hover:bg-[var(--accent-dim)]/20 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
              >
                Substitution
              </button>
              {!isDemoId(selectedGameId) && (
                <button
                  type="button"
                  disabled={clearingPAs || destructivePending}
                  onClick={() => setDestructiveConfirm("clearGamePas")}
                  className="min-h-[48px] shrink-0 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition hover:border-[var(--danger)] hover:bg-[var(--danger-dim)]/25 hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {clearingPAs ? "Clearing…" : "Clear PAs"}
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={
                  !batterId ||
                  result === null ||
                  !pitcherId ||
                  throwsToPitcherHand(selectedPitcher?.throws) === null ||
                  pitchesSeen === "" ||
                  (typeof pitchesSeen === "number" &&
                    pitchesSeen > 0 &&
                    strikesThrown === "") ||
                  (RESULT_IS_HIT.has(result) && hitDirection === null) ||
                  (RESULT_ALLOWS_HIT_DIRECTION.has(result) && battedBallType === null) ||
                  (result != null && requiresRunnerOnBaseForResult(result) && baseState === "000") ||
                  (result === "reached_on_error" && !errorFielderId) ||
                  (result === "hr" && runsScoredPlayerIds.length === 0) ||
                  saving
                }
                className="min-h-[48px] min-w-[8rem] flex-1 cursor-pointer rounded-lg bg-[var(--accent)] py-3 text-base font-semibold text-[var(--bg-base)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none touch-manipulation"
              >
                {saving ? "Saving…" : "Save PA"}
              </button>
            </div>
              </div>
              <div className="w-full max-w-[280px] shrink-0 self-start lg:min-w-[240px]">
                <section className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5">
                  <h4 className="font-display mb-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                    Runners
                  </h4>
                  <div className="mt-0.5">
                    <BaseStateSelector
                      value={baseState}
                      onChange={setBaseState}
                      runnerIds={[runnerOn1bId, runnerOn2bId, runnerOn3bId]}
                      onRunnerChange={(idx, id) => {
                        if (idx === 0) setRunnerOn1bId(id);
                        else if (idx === 1) setRunnerOn2bId(id);
                        else setRunnerOn3bId(id);
                      }}
                      runnerOptions={runnerOptionsForBaseSelector}
                      currentBatterId={batterId}
                      onBaserunning={selectedGameId ? handleBaserunning : undefined}
                    />
                    {baserunningEvents.length > 0 && (
                      <div className="mt-2 border-t border-[var(--border)] pt-2">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                          This game (SB / CS)
                        </p>
                        <ul className="mt-1 max-h-24 space-y-1 overflow-y-auto text-xs text-[var(--text)]">
                          {baserunningEvents.map((ev) => {
                            const runner = players.find((p) => p.id === ev.runner_id);
                            return (
                              <li key={ev.id} className="flex items-center justify-between gap-2">
                                <span>
                                  {ev.event_type === "sb" ? "SB" : "CS"} {runner?.name ?? "?"}
                                </span>
                                <button
                                  type="button"
                                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--danger)]/40 text-xl font-bold leading-none text-[var(--danger)] transition hover:bg-[var(--danger)]/10 touch-manipulation"
                                  aria-label={`Remove ${ev.event_type === "sb" ? "stolen base" : "caught stealing"} for ${runner?.name ?? "runner"}`}
                                  onClick={async () => {
                                    const r = await deleteBaserunningEventAction(ev.id);
                                    if (r.ok) {
                                      setBaserunningEvents((prev) => prev.filter((x) => x.id !== ev.id));
                                      showMsg("destructive", "Removed");
                                    } else showMsg("error", r.error ?? "Failed");
                                  }}
                                >
                                  ×
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <BoxScoreLine
              game={selectedGame}
              pas={allPAsForGame}
              liveInning={inning}
              liveInningHalf={inningHalf}
            />
          </div>

          {lastSavedPaSummary && (
            <section
              className="rounded-lg border border-[var(--accent)]/35 bg-[var(--accent-dim)]/25 px-3 py-2.5"
              aria-label="Last saved plate appearance — who scored"
            >
              <p className="font-display text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Last PA saved — verify
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="text-[var(--text)]">
                  <span className="font-semibold">Batter:</span>{" "}
                  <span className="text-[var(--accent)]">{lastSavedPaSummary.batterName}</span>
                </span>
                <span className="text-[var(--text)]">
                  <span className="font-semibold">Result:</span>{" "}
                  <span className="text-[var(--accent)]">{lastSavedPaSummary.resultLabel}</span>
                </span>
                {lastSavedPaSummary.errorFielderName != null && (
                  <span className="text-[var(--text)]">
                    <span className="font-semibold">Error charged to:</span>{" "}
                    <span className="text-[var(--accent)]">{lastSavedPaSummary.errorFielderName}</span>
                  </span>
                )}
                <span className="text-[var(--text)]">
                  <span className="font-semibold">Hit direction:</span>{" "}
                  <span className="text-[var(--accent)]">
                    {lastSavedPaSummary.hitDirectionLabel ?? "—"}
                  </span>
                </span>
                {lastSavedPaSummary.rbi > 0 && (
                  <span className="text-[var(--text)]">
                    <span className="font-semibold">RBI:</span>{" "}
                    <span className="text-[var(--accent)]">{lastSavedPaSummary.rbi}</span>
                  </span>
                )}
                <span className="text-[var(--text)]">
                  <span className="font-semibold">Pitcher:</span>{" "}
                  <span className="text-[var(--accent)]">{lastSavedPaSummary.pitcherName}</span>
                </span>
                <span className="text-[var(--text)]">
                  <span className="font-semibold">Count:</span>{" "}
                  <span className="text-[var(--accent)]">{lastSavedPaSummary.countLabel}</span>
                </span>
                <span className="text-[var(--text)]">
                  <span className="font-semibold">Pitches:</span>{" "}
                  <span className="text-[var(--accent)]">{lastSavedPaSummary.pitchLine}</span>
                </span>
                <span className="text-[var(--text)]">
                  <span className="font-semibold">Scored:</span>{" "}
                  <span className="text-[var(--accent)]">
                    {lastSavedPaSummary.runsScoredNames.length > 0
                      ? lastSavedPaSummary.runsScoredNames.join(", ")
                      : "None"}
                  </span>
                </span>
                {lastSavedPaSummary.unearnedRunsScoredNames.length > 0 && (
                  <span className="text-[var(--text)]">
                    <span className="font-semibold">Unearned (vs ERA):</span>{" "}
                    <span className="text-amber-200/95">
                      {lastSavedPaSummary.unearnedRunsScoredNames.join(", ")}
                    </span>
                  </span>
                )}
                {lastSavedPaSummary.notes && (
                  <span className="min-w-0 text-[var(--text-muted)]">
                    <span className="font-semibold">Play/Notes:</span>{" "}
                    <span className="text-[var(--accent)]">{lastSavedPaSummary.notes}</span>
                  </span>
                )}
              </div>
            </section>
          )}

          <div className="space-y-3">
            {isLg ? (
              <>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-x-4 gap-y-2">
                  <h2 className="font-display min-w-0 text-sm font-semibold uppercase tracking-wider text-white">
                    Batters – {battingTableTeamName}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setBattingTablePeekOther((v) => !v)}
                    className="mb-px shrink-0 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-medium text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-dim)]/30"
                  >
                    {recordBoxScoreToggleLabel}
                  </button>
                  <h2 className="font-display min-w-0 text-right text-sm font-semibold uppercase tracking-wider text-white">
                    Pitchers – {pitchingTableTeamName}
                  </h2>
                </div>
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-5">
                  <div className="min-w-0">
                    <GameBattingTable
                      game={selectedGame}
                      teamName={battingTableTeamName}
                      pas={pasForBattingTable}
                      players={players}
                      lineupOrder={
                        lineupForBattingTable.order.length > 0
                          ? lineupForBattingTable.order
                          : undefined
                      }
                      lineupPositionByPlayerId={lineupForBattingTable.positionByPlayerId}
                      highlightedBatterId={battingTablePeekOther ? null : batterId}
                      baserunningByPlayerId={baserunningByPlayerId}
                      hideHeading
                      showPitchData={false}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-3">
                    <GamePitchingBoxTable
                      game={selectedGame}
                      side={pitchingSideForBox}
                      pas={allPAsForGame}
                      players={players}
                      compact
                      hideHeading
                    />
                    <PitchingPitchMixSupplement
                      pas={pasForPitchMixUnderPitchingTable}
                      players={players}
                      pitchEvents={pitchEventsForPitchMixCard}
                      compact
                      currentPitcherId={pitcherId}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap justify-end">
                  <button
                    type="button"
                    onClick={() => setBattingTablePeekOther((v) => !v)}
                    className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-medium text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-dim)]/30"
                  >
                    {recordBoxScoreToggleLabel}
                  </button>
                </div>
                <div className="grid grid-cols-1 items-start gap-4">
                  <div className="min-w-0">
                    <GameBattingTable
                      game={selectedGame}
                      teamName={battingTableTeamName}
                      pas={pasForBattingTable}
                      players={players}
                      lineupOrder={
                        lineupForBattingTable.order.length > 0
                          ? lineupForBattingTable.order
                          : undefined
                      }
                      lineupPositionByPlayerId={lineupForBattingTable.positionByPlayerId}
                      highlightedBatterId={battingTablePeekOther ? null : batterId}
                      baserunningByPlayerId={baserunningByPlayerId}
                      showPitchData={false}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-3">
                    <GamePitchingBoxTable
                      game={selectedGame}
                      side={pitchingSideForBox}
                      pas={allPAsForGame}
                      players={players}
                      compact
                    />
                    <PitchingPitchMixSupplement
                      pas={pasForPitchMixUnderPitchingTable}
                      players={players}
                      pitchEvents={pitchEventsForPitchMixCard}
                      compact
                      currentPitcherId={pitcherId}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      )}

      <ConfirmDeleteDialog
        open={destructiveConfirm !== null}
        onClose={() => !destructivePending && setDestructiveConfirm(null)}
        title={
          destructiveConfirm === "undoLastPa"
            ? "Remove last plate appearance?"
            : destructiveConfirm === "clearGamePas"
              ? "Clear all plate appearances for this game?"
              : "Finalize game score?"
        }
        description={
          destructiveConfirm === "undoLastPa"
            ? "The most recently recorded plate appearance will be permanently removed."
            : destructiveConfirm === "clearGamePas"
              ? "This cannot be undone. All PAs recorded for this game will be deleted."
              : `This sets the final score snapshot to ${liveAwayRuns}-${liveHomeRuns} and opens the box score review.`
        }
        confirmLabel={
          destructiveConfirm === "undoLastPa"
            ? "Remove"
            : destructiveConfirm === "clearGamePas"
              ? "Clear plate appearances"
              : "Finalize game"
        }
        pendingLabel={
          destructiveConfirm === "undoLastPa"
            ? "Removing…"
            : destructiveConfirm === "clearGamePas"
              ? "Clearing…"
              : "Finalizing…"
        }
        pending={destructivePending || finalizingGame}
        onConfirm={handleDestructiveConfirm}
      />

      {errorFielderModalMode != null && selectedGameId && selectedGame ? (
        <ReachedOnErrorFielderModal
          pitchingTeamName={pitchingTableTeamName}
          fielders={fieldersForErrorPicker}
          positionByPlayerId={positionByPlayerIdForRoeModal}
          moundPitcherId={pitcherId}
          initialFielderId={errorFielderId}
          title={errorFielderModalMode === "hit" ? "Error on the bases" : undefined}
          description={
            errorFielderModalMode === "hit"
              ? `The batter still gets credit for the hit (${RESULT_OPTIONS.find((o) => o.value === result)?.label ?? "1B–3B"}). Choose the ${pitchingTableTeamName} fielder charged with the error (e.g. misplay or bad throw for an extra base).`
              : undefined
          }
          onCancel={handleErrorFielderModalCancel}
          onConfirm={handleErrorFielderModalConfirm}
        />
      ) : null}

      {selectedGame ? (
        <RecordPitcherChangeModal
          open={pitcherChangeModalOpen}
          onClose={() => setPitcherChangeModalOpen(false)}
          teamName={pitchingSide === "home" ? selectedGame.home_team : selectedGame.away_team}
          currentPitcherId={pitcherId}
          pitchers={pitchersForDropdown}
          onApply={(playerId) => {
            setPitcherId(playerId);
            setPitcherBySide((prev) => ({ ...prev, [pitchingSide]: playerId }));
          }}
        />
      ) : null}

      {selectedGameId && selectedGame && (
        <RecordSubstitutionModal
          open={substitutionModalOpen}
          onClose={() => setSubstitutionModalOpen(false)}
          gameId={selectedGameId}
          game={selectedGame}
          defaultSide={battingSide}
          awayLineup={lineupAway}
          homeLineup={lineupHome}
          players={players}
          onSave={saveRecordGameLineup}
          onApplied={(side, order, positionByPlayerId) => {
            if (side === "away") {
              setLineupAway({ order, positionByPlayerId });
            } else {
              setLineupHome({ order, positionByPlayerId });
            }
            if (side === battingSide) {
              const eligible = new Set(
                order
                  .map((id) => players.find((p) => p.id === id))
                  .filter((p): p is Player => p != null && !isPitcherPlayer(p))
                  .map((p) => p.id)
              );
              setRunnerOn1bId((r) => (r && eligible.has(r) ? r : null));
              setRunnerOn2bId((r) => (r && eligible.has(r) ? r : null));
              setRunnerOn3bId((r) => (r && eligible.has(r) ? r : null));
            }
            showMsg(
              "success",
              `Lineup saved (${side === "away" ? selectedGame.away_team : selectedGame.home_team})`
            );
          }}
        />
      )}

      {shortcutsHelpOpen ? (
        <div
          className="fixed inset-0 z-[220] flex items-start justify-center overflow-y-auto bg-black/55 p-4 pt-[max(2rem,10vh)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-shortcuts-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close shortcuts"
            onClick={() => setShortcutsHelpOpen(false)}
          />
          <div
            data-record-shortcuts-ignore
            className="relative z-[1] w-full max-w-md rounded-xl border-2 border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2
                id="record-shortcuts-title"
                className="font-display text-lg font-semibold text-[var(--text)]"
              >
                Keyboard shortcuts
              </h2>
              <button
                type="button"
                className="shrink-0 rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={() => setShortcutsHelpOpen(false)}
              >
                Esc
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Shortcuts are off while typing in inputs, in a select, or when another dialog is open.
            </p>
            <dl className="mt-4 space-y-2.5 text-sm text-[var(--text)]">
              {(
                [
                  ["Enter", "Save the current PA (same as Save button)"],
                  [
                    "1 – 9, 0",
                    "Outcome by grid order: 1 = 1B, 2 = 2B, 3 = 3B, 4 = HR, …; 0 = 10th (HBP). Sac / ROE / FC use the grid.",
                  ],
                  ["B", "Focus batter"],
                  ["J", "Next batter in lineup (no save)"],
                  ["S", "Open substitution"],
                  ["P", "Open pitcher change"],
                  ["R", "Repeat last saved result and count"],
                  ["?", "Open this panel (Shift + /)"],
                ] as const
              ).map(([keys, desc]) => (
                <div key={keys} className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1">
                  <dt>
                    <kbd className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-xs">
                      {keys}
                    </kbd>
                  </dt>
                  <dd className="text-[var(--text-muted)]">{desc}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}
