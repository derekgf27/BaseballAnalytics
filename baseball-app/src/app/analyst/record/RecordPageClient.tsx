"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BaseStateSelector } from "@/components/shared/BaseStateSelector";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { BoxScoreLine } from "@/components/analyst/BoxScoreLine";
import { BattingPitchMixCard } from "@/components/analyst/BattingPitchMixCard";
import { GameBattingTable } from "@/components/analyst/GameBattingTable";
import { GamePitchingBoxTable } from "@/components/analyst/GamePitchingBoxTable";
import { formatDateMMDDYYYY } from "@/lib/format";
import { clearPAsForGameAction } from "@/app/analyst/games/actions";
import { isDemoId } from "@/lib/db/mockData";
import {
  getBaseStateAfterResult,
  type BaseStateAfterResultOpts,
} from "@/lib/compute/runExpectancy";
import { plateAppearancesForPitchingSide } from "@/lib/compute/gamePitchingBox";
import { battingSideFromHalf, nextHalfInningAfterThreeOuts } from "@/lib/gameBattingSide";
import { INNING_SELECT_VALUES, MAX_SELECTABLE_INNING } from "@/lib/leagueConfig";
import {
  isClubRosterPlayer,
  isPitcherPlayer,
  pitchersForGameTeamSide,
  playersForGameSideWhenNoLineup,
} from "@/lib/opponentUtils";
import type {
  Game,
  Player,
  PlateAppearance,
  PAResult,
  BaseState,
  HitDirection,
  BaserunningEvent,
  BaserunningEventInsert,
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
  { value: "sac_fly", label: "Sacrifice Fly" },
  { value: "sac_bunt", label: "Sacrifice Bunt" },
  { value: "reached_on_error", label: "Reached on error" },
  { value: "fielders_choice", label: "FC" },
];

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
    // Must match getBaseStateAfterResult(baseStateBefore, "double", { rbi }).
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

/** Infer which player IDs scored on this play from runner IDs and RBI (for runs_scored_player_ids). */
function getPlayersWhoScoredOnPlay(
  result: PAResult,
  rbi: number,
  runner1b: string | null,
  runner2b: string | null,
  runner3b: string | null,
  batterId: string
): string[] {
  if (rbi <= 0) return [];
  const runnersByOrder = [runner3b, runner2b, runner1b].filter(Boolean) as string[];
  if (result === "hr") {
    return [batterId, ...runnersByOrder].slice(0, 4);
  }
  if (result === "triple") {
    return runnersByOrder.slice(0, rbi);
  }
  if (
    result === "double" ||
    result === "single" ||
    result === "bb" ||
    result === "ibb" ||
    result === "hbp" ||
    result === "fielders_choice" ||
    result === "other" ||
    result === "reached_on_error"
  ) {
    return runnersByOrder.slice(0, rbi);
  }
  if (result === "sac_fly" || result === "sac") {
    return runner3b ? [runner3b] : [];
  }
  if (result === "sac_bunt") {
    return runner3b && rbi >= 1 ? [runner3b] : [];
  }
  return [];
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

interface RecordPageClientProps {
  games: Game[];
  players: Player[];
  /** Game to record (from `?gameId=`). No in-form game switching — open Record PAs from Games or dashboard. */
  initialGameId?: string;
  fetchPAsForGame: (gameId: string) => Promise<PlateAppearance[]>;
  fetchGameLineupOrder: (gameId: string) => Promise<{
    away: { order: string[]; positionByPlayerId: Record<string, string> };
    home: { order: string[]; positionByPlayerId: Record<string, string> };
  }>;
  savePlateAppearance: (
    pa: Omit<PlateAppearance, "id" | "created_at">
  ) => Promise<{ ok: boolean; error?: string }>;
  deletePlateAppearance: (paId: string) => Promise<{ ok: boolean; error?: string }>;
  fetchBaserunningEventsForGame: (gameId: string) => Promise<BaserunningEvent[]>;
  saveBaserunningEventAction: (
    row: BaserunningEventInsert
  ) => Promise<{ ok: boolean; error?: string; event?: BaserunningEvent }>;
  deleteBaserunningEventAction: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

const RESULT_IS_HIT = new Set<PAResult>(["single", "double", "triple", "hr"]);

/** Shown after save so you can verify who scored (matches DB `runs_scored_player_ids`). */
type LastSavedPaSummary = {
  inning: number;
  inningHalf: "top" | "bottom" | null;
  batterName: string;
  resultLabel: string;
  rbi: number;
  runsScoredNames: string[];
};

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
}: RecordPageClientProps) {
  /** Fixed for this page load from URL; use Games → Record PAs to change game. */
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
  /** `null` = use inferred scorers for save/display chips; array = user override (empty array = no one scored). */
  const [runsScoredPlayerIds, setRunsScoredPlayerIds] = useState<string[] | null>(null);
  const [baserunningEvents, setBaserunningEvents] = useState<BaserunningEvent[]>([]);
  const [hitDirection, setHitDirection] = useState<HitDirection | null>(null);
  /** Current pitcher on the mound (defensive team — opposite of batting team). */
  const [pitcherId, setPitcherId] = useState<string | null>(null);
  const [pitchesSeen, setPitchesSeen] = useState<number | "">("");
  /** Total pitches that count as strikes (incl. fouls); required when pitches ≥ 1. */
  const [strikesThrown, setStrikesThrown] = useState<number | "">("");
  /**
   * First + on Balls vs Strikes from 0-0 encodes first-pitch strike for FPS%
   * ('strike' → FPS yes, 'ball' → no). Cleared when count returns to 0-0.
   */
  const [firstCountFromZero, setFirstCountFromZero] = useState<"ball" | "strike" | null>(null);
  const [playNote, setPlayNote] = useState("");
  const [notes, setNotes] = useState("");
  const [autoAdvanceBatter, setAutoAdvanceBatter] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearingPAs, setClearingPAs] = useState(false);
  const [destructiveConfirm, setDestructiveConfirm] = useState<null | "undoLastPa" | "clearGamePas">(null);
  const [destructivePending, setDestructivePending] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "destructive";
    text: string;
  } | null>(null);
  const [toastMounted, setToastMounted] = useState(false);
  const messageDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [allPAsForGame, setAllPAsForGame] = useState<PlateAppearance[]>([]);
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
    if (countBalls === 0 && countStrikes === 0) {
      setFirstCountFromZero(null);
    }
  }, [countBalls, countStrikes]);

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
  const selectedBatter = players.find((p) => p.id === batterId);

  const battingSide = battingSideFromHalf(inningHalf);
  const lineupForBatting = battingSide === "away" ? lineupAway : lineupHome;
  const displayBattingSide = battingTablePeekOther
    ? battingSide === "away"
      ? "home"
      : "away"
    : battingSide;
  const lineupForBattingTable =
    displayBattingSide === "away" ? lineupAway : lineupHome;
  const pasForBattingTable = useMemo(
    () =>
      allPAsForGame.filter((p) =>
        p.inning_half === (displayBattingSide === "away" ? "top" : "bottom")
      ),
    [allPAsForGame, displayBattingSide]
  );
  /** Same PAs as the pitching box (this team on the mound), not the batting half. */
  const pasForPitchMixUnderPitchingTable = useMemo(
    () => plateAppearancesForPitchingSide(allPAsForGame, displayBattingSide),
    [allPAsForGame, displayBattingSide]
  );
  const battingTableTeamName = selectedGame
    ? displayBattingSide === "home"
      ? selectedGame.home_team
      : selectedGame.away_team
    : "";

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

  /** Team pitching right now (defense). Top half → home pitches; bottom → away pitches. */
  const pitchingSide = battingSide === "away" ? "home" : "away";
  const pitchersForDropdown = useMemo(() => {
    if (!selectedGame) return [];
    return pitchersForGameTeamSide(selectedGame, pitchingSide, players);
  }, [selectedGame, pitchingSide, players]);

  const loadPAs = useCallback((options?: { resetBatter?: boolean }) => {
    if (!selectedGameId) return;
    const resetBatter = options?.resetBatter !== false;
    setAllPAsForGame([]);
    setLineupAway({ order: [], positionByPlayerId: {} });
    setLineupHome({ order: [], positionByPlayerId: {} });
    Promise.all([
      fetchPAsForGame(selectedGameId),
      fetchGameLineupOrder(selectedGameId),
      fetchBaserunningEventsForGame(selectedGameId),
    ]).then(([pas, lineups, events]) => {
      setAllPAsForGame(pas);
      setBaserunningEvents(events);
      setLineupAway(lineups.away);
      setLineupHome(lineups.home);
      if (resetBatter) {
        const firstAway = lineups.away.order[0];
        const firstHome = lineups.home.order[0];
        const firstBatterId =
          firstAway ?? firstHome ?? players[0]?.id ?? null;
        setBatterId(firstBatterId);
      }
    });
  }, [selectedGameId, fetchPAsForGame, fetchGameLineupOrder, fetchBaserunningEventsForGame, players]);

  useEffect(() => {
    loadPAs();
  }, [loadPAs]);

  useEffect(() => {
    setBattingTablePeekOther(false);
  }, [inningHalf]);

  useEffect(() => {
    if (!selectedGameId) return;
    setInning(1);
    setInningHalf("top");
    setOuts(0);
    setBaseState("000");
    setRunnerOn1bId(null);
    setRunnerOn2bId(null);
    setRunnerOn3bId(null);
    setBattingTablePeekOther(false);
    setPitcherId(null);
  }, [selectedGameId]);

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

  /** Keep pitcher on defensive roster; prefer game starting pitcher for this side, else first listed. */
  useEffect(() => {
    if (pitchersForDropdown.length === 0) {
      if (pitcherId) setPitcherId(null);
      return;
    }
    const starterId =
      pitchingSide === "home"
        ? selectedGame?.starting_pitcher_home_id
        : selectedGame?.starting_pitcher_away_id;
    const preferred =
      starterId && pitchersForDropdown.some((p) => p.id === starterId)
        ? starterId
        : pitchersForDropdown[0]!.id;
    if (!pitcherId || !pitchersForDropdown.some((p) => p.id === pitcherId)) {
      setPitcherId(preferred);
    }
  }, [
    pitchersForDropdown,
    pitcherId,
    pitchingSide,
    selectedGame?.starting_pitcher_home_id,
    selectedGame?.starting_pitcher_away_id,
  ]);

  // Auto-set RBI for HR: 1 (batter) + runners on base (e.g. loaded = 4)
  useEffect(() => {
    if (result === "hr") {
      const runners = (baseState.match(/1/g) || []).length;
      setRbi(1 + runners);
    }
  }, [result, baseState]);

  /** Fair ball in play only for 1B–HR; outs / walks / other PA types store null. */
  useEffect(() => {
    if (result !== null && !RESULT_IS_HIT.has(result)) {
      setHitDirection(null);
    }
  }, [result]);

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
            const next = nextHalfInningAfterThreeOuts(inning, inningHalf);
            setInning(Math.min(next.inning, MAX_SELECTABLE_INNING));
            setInningHalf(next.half);
            setOuts(0);
            setBaseState("000");
            setRunnerOn1bId(null);
            setRunnerOn2bId(null);
            setRunnerOn3bId(null);
            showMsg("success", "Caught stealing — 3rd out, side retired");
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
    if (pitchesSeen === "") {
      showMsg("error", "Pitches seen is required.");
      return;
    }
    const pitchCount = pitchesSeen as number;
    if (pitchCount > 0) {
      if (strikesThrown === "") {
        showMsg("error", "Strikes thrown is required when pitches ≥ 1.");
        return;
      }
      if (firstCountFromZero === null) {
        showMsg(
          "error",
          "From 0-0, tap + on Balls or Strikes once to record the first pitch (for FPS%)."
        );
        return;
      }
      const st = strikesThrown as number;
      if (st < 0 || st > pitchCount) {
        showMsg("error", "Strikes thrown must be between 0 and pitches seen.");
        return;
      }
    }
    if (RESULT_IS_HIT.has(result) && hitDirection === null) {
      showMsg("error", "Hit direction is required for base hits (1B–HR).");
      return;
    }
    if (result != null && requiresRunnerOnBaseForResult(result) && baseState === "000") {
      showMsg(
        "error",
        "GIDP, fielder's choice, and sacrifice plays require at least one runner on base."
      );
      return;
    }
    setSaving(true);
    try {
      const playFormatted =
        formatPlayWithDashes(playNote.trim()) ||
        (PLAY_ABBREVIATIONS[playNote.trim().toLowerCase()] ?? playNote.trim());
      const notesCombined = [playFormatted, notes.trim()].filter(Boolean).join(" — ") || null;
      const autoScored = getPlayersWhoScoredOnPlay(
        result,
        rbi,
        runnerOn1bId,
        runnerOn2bId,
        runnerOn3bId,
        batterId
      );
      const runsScoredIds =
        runsScoredPlayerIds === null
          ? autoScored.length > 0
            ? autoScored
            : undefined
          : runsScoredPlayerIds;
      const pa: Omit<PlateAppearance, "id" | "created_at"> = {
        game_id: selectedGameId,
        batter_id: batterId,
        inning,
        outs,
        base_state: baseState,
        score_diff: 0,
        count_balls: countBalls,
        count_strikes: countStrikes,
        result,
        contact_quality: null,
        chase: null,
        hit_direction: RESULT_IS_HIT.has(result) ? hitDirection : null,
        pitches_seen: pitchesSeen as number,
        strikes_thrown: pitchCount > 0 ? (strikesThrown as number) : 0,
        first_pitch_strike:
          pitchCount > 0 ? firstCountFromZero === "strike" : null,
        rbi,
        runs_scored_player_ids: runsScoredIds,
        pitcher_hand: pitcherHandFromThrows,
        pitcher_id: pitcherId,
        inning_half: inningHalf ?? "top",
        notes: notesCombined,
      };
      const { ok, error } = await savePlateAppearance(pa);
      if (!ok) {
        showMsg("error", error ?? "Failed to save PA");
        return;
      }
      const scorerIds = runsScoredIds ?? [];
      const scorerNames = scorerIds.map(
        (id) => players.find((p) => p.id === id)?.name ?? "?"
      );
      const resultLabel =
        RESULT_OPTIONS.find((o) => o.value === result)?.label ?? result;
      const batterName = players.find((p) => p.id === batterId)?.name ?? "?";
      setLastSavedPaSummary({
        inning,
        inningHalf: inningHalf ?? null,
        batterName,
        resultLabel,
        rbi,
        runsScoredNames: scorerNames,
      });
      showMsg(
        "success",
        scorerNames.length > 0
          ? `PA saved — Scored: ${scorerNames.join(", ")}`
          : "PA saved — No runs scored on this play"
      );
      setResult(null);
      setCountBalls(0);
      setCountStrikes(0);
      setRbi(0);
      setRunsScoredPlayerIds(null);
      setHitDirection(null);
      setPitchesSeen("");
      setStrikesThrown("");
      setPlayNote("");
      setNotes("");
      if (autoAdvanceBatter && battersForDropdown.length > 0) {
        const idx = battersForDropdown.findIndex((p) => p.id === batterId);
        const nextIdx = idx < 0 ? 0 : (idx + 1) % battersForDropdown.length;
        setBatterId(battersForDropdown[nextIdx].id);
      }
      const afterOpts: BaseStateAfterResultOpts = { rbi };
      const newBaseState = getBaseStateAfterResult(baseState, result, afterOpts);
      const [newR1, newR2, newR3] = getRunnerIdsAfterResult(
        runnerOn1bId,
        runnerOn2bId,
        runnerOn3bId,
        batterId,
        result,
        baseState,
        rbi
      );
      if (result === "gidp") {
        const newOuts = outs + 2;
        const gidpHadRunner2ndOr3rd =
          baseState[1] === "1" ||
          baseState[2] === "1" ||
          runnerOn2bId != null ||
          runnerOn3bId != null;
        if (newOuts >= 3) {
          const next = nextHalfInningAfterThreeOuts(inning, inningHalf);
          setInning(Math.min(next.inning, MAX_SELECTABLE_INNING));
          setInningHalf(next.half);
          setOuts(0);
          setBaseState("000");
          setRunnerOn1bId(null);
          setRunnerOn2bId(null);
          setRunnerOn3bId(null);
        } else {
          setOuts(newOuts);
          setBaseState(newBaseState);
          setRunnerOn1bId(newR1);
          setRunnerOn2bId(newR2);
          setRunnerOn3bId(newR3);
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
          const next = nextHalfInningAfterThreeOuts(inning, inningHalf);
          setInning(Math.min(next.inning, MAX_SELECTABLE_INNING));
          setInningHalf(next.half);
          setOuts(0);
          setBaseState("000");
          setRunnerOn1bId(null);
          setRunnerOn2bId(null);
          setRunnerOn3bId(null);
        } else {
          setOuts((o) => o + 1);
          setBaseState(newBaseState);
          setRunnerOn1bId(newR1);
          setRunnerOn2bId(newR2);
          setRunnerOn3bId(newR3);
        }
      } else {
        setBaseState(newBaseState);
        setRunnerOn1bId(newR1);
        setRunnerOn2bId(newR2);
        setRunnerOn3bId(newR3);
      }
      loadPAs({ resetBatter: false });
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

  const handleDestructiveConfirm = async () => {
    if (destructiveConfirm === "undoLastPa") {
      if (!lastPA || !selectedGameId) return;
      setDestructivePending(true);
      try {
        const { ok, error } = await deletePlateAppearance(lastPA.id);
        setDestructiveConfirm(null);
        if (ok) {
          setLastSavedPaSummary(null);
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
    setRunsScoredPlayerIds(null);
    setBaserunningEvents([]);
    setLastSavedPaSummary(null);
    setHitDirection(null);
    setPitcherId(null);
    setPitchesSeen("");
    setStrikesThrown("");
    setPlayNote("");
    setNotes("");
  };

  const selectedPitcher = pitcherId ? players.find((p) => p.id === pitcherId) : null;
  const showPitcherWarning =
    Boolean(batterId || result !== null) &&
    (pitchersForDropdown.length === 0 ||
      !pitcherId ||
      throwsToPitcherHand(selectedPitcher?.throws) === null);
  const showRbiHint =
    Boolean(result && RESULT_IS_HIT.has(result) && baseState !== "000" && rbi === 0);
  const showPitchesWarning =
    Boolean(batterId) && result !== null && pitchesSeen === "";
  const showHitDirectionWarning =
    Boolean(batterId) &&
    result !== null &&
    RESULT_IS_HIT.has(result) &&
    hitDirection === null;

  /** When RBI + result imply scorers; used for hint + chip highlight while `runsScoredPlayerIds === null`. */
  const autoScoredPreview = useMemo(() => {
    if (rbi <= 0 || result === null || !batterId) return [];
    return getPlayersWhoScoredOnPlay(
      result,
      rbi,
      runnerOn1bId,
      runnerOn2bId,
      runnerOn3bId,
      batterId
    );
  }, [rbi, result, batterId, runnerOn1bId, runnerOn2bId, runnerOn3bId]);

  /** Runners on base + batter — one tap each to mark scored (when auto inference does not apply). */
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

  const scoringCandidateIds = useMemo(
    () => new Set(scoringCandidates.map((c) => c.id)),
    [scoringCandidates]
  );

  const otherScorerIds = useMemo(
    () => (runsScoredPlayerIds ?? []).filter((id) => !scoringCandidateIds.has(id)),
    [runsScoredPlayerIds, scoringCandidateIds]
  );

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedGameId || !batterId) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.key === "Enter") {
        handleSaveRef.current();
        return;
      }
      if (e.key >= "0" && e.key <= "9") {
        const idx = Number(e.key);
        if (RESULT_OPTIONS[idx]) {
          setResult(RESULT_OPTIONS[idx].value);
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedGameId, batterId]);

  return (
    <div className="space-y-4 pb-8">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">
          Record PAs
        </h1>
      </header>

      {!selectedGameId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
          <p>No game selected. Open Record PAs from a game row (e.g. Analyst → Games → Record PAs).</p>
          <Link
            href="/analyst/games"
            className="mt-3 inline-block font-medium text-[var(--accent)] hover:underline"
          >
            Go to Games →
          </Link>
        </div>
      )}

      {selectedGameId && selectedGame && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-[var(--text)]">
              {formatDateMMDDYYYY(selectedGame.date)} — {selectedGame.away_team} @ {selectedGame.home_team}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={clearForm}
                className="rounded-md border border-[var(--border)] bg-transparent px-2.5 py-1 text-xs font-medium text-[var(--text-muted)] transition hover:border-[var(--danger)] hover:bg-[var(--danger-dim)]/25 hover:text-[var(--danger)]"
              >
                Clear form
              </button>
              {!isDemoId(selectedGameId) && (
                <button
                  type="button"
                  disabled={clearingPAs || destructivePending}
                  onClick={() => setDestructiveConfirm("clearGamePas")}
                  className="rounded-md border border-[var(--border)] bg-transparent px-2.5 py-1 text-xs font-medium text-[var(--text-muted)] transition hover:border-[var(--danger)] hover:bg-[var(--danger-dim)]/25 hover:text-[var(--danger)] disabled:opacity-50"
                >
                  {clearingPAs ? "Clearing…" : "Clear PAs for this game"}
                </button>
              )}
            </div>
          </div>

          <BoxScoreLine
            game={selectedGame}
            pas={allPAsForGame}
            liveInning={inning}
            liveInningHalf={inningHalf}
          />

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
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
            {/* Game state + At bat side-by-side on desktop */}
            <div className="grid gap-1.5 lg:grid-cols-2 lg:gap-2">
            {/* Game state */}
            <section className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5">
              <h4 className="font-display mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Game state</h4>
            <div className="grid grid-cols-[auto_auto_1fr] gap-x-2 gap-y-1 sm:grid-cols-[auto_auto_1fr]">
              <label className="w-fit">
                <span className="font-heading text-xs font-semibold text-[var(--text)]">Inning</span>
                <select
                  value={inning}
                  onChange={(e) => setInning(Number(e.target.value))}
                  className="input-tech mt-0.5 block min-h-[44px] w-16 px-2 py-2 text-sm touch-manipulation"
                >
                  {INNING_SELECT_VALUES.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <div>
                <span className="font-heading text-xs font-semibold text-[var(--text)]">Half</span>
                <div className="mt-0.5 flex gap-1">
                  {(["top", "bottom"] as const).map((half) => (
                    <button
                      key={half}
                      type="button"
                      onClick={() => setInningHalf(half)}
                      className={`min-h-[44px] min-w-[52px] cursor-pointer rounded-lg border-2 px-2 py-2 text-sm font-medium capitalize transition duration-200 touch-manipulation ${
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
              <label className="flex flex-col items-center">
                <span className="font-heading text-xs font-semibold text-[var(--text)]">Outs</span>
                <div className="mt-0.5 flex w-fit gap-1">
                  {[0, 1, 2].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setOuts(n)}
                      className={`min-h-[44px] min-w-[44px] cursor-pointer rounded-lg border-2 px-2 py-2 text-base font-semibold transition duration-200 touch-manipulation ${
                        outs === n
                          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)] hover:opacity-90"
                          : "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-[var(--accent)]/60"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </label>
            </div>
            <label className="mt-2 block">
              <span className="font-heading text-xs font-semibold text-[var(--text)]">
                Pitcher (
                {pitchingSide === "home" ? selectedGame.home_team : selectedGame.away_team})
              </span>
              <select
                value={pitcherId ?? ""}
                onChange={(e) => setPitcherId(e.target.value || null)}
                disabled={pitchersForDropdown.length === 0}
                className="input-tech mt-0.5 block w-full min-h-[44px] max-w-md px-2 py-2 text-sm touch-manipulation"
                aria-label="Current pitcher"
              >
                {pitchersForDropdown.length === 0 ? (
                  <option value="">No pitchers on this roster (add P + throws)</option>
                ) : (
                  pitchersForDropdown.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.jersey ? ` #${p.jersey}` : ""}
                      {p.throws ? ` (${p.throws}HP)` : ""}
                    </option>
                  ))
                )}
              </select>
              {showPitcherWarning && (
                <p className="mt-1 text-[11px] leading-snug text-[var(--warning)]">
                  {pitchersForDropdown.length === 0
                    ? "Add at least one pitcher (position P, throwing hand) on the defensive team’s roster."
                    : !pitcherId
                      ? "Select a pitcher."
                      : "Selected pitcher needs a throwing hand (L/R) on their roster profile."}
                </p>
              )}
            </label>
            </section>

            {/* At bat */}
            <section className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5">
              <h4 className="font-display mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">At bat</h4>
            <div className="grid w-full grid-cols-1 items-start gap-x-4 gap-y-3 min-[400px]:grid-cols-2">
              <div className="min-w-0 max-w-full">
                <span className="font-heading text-xs font-semibold text-[var(--text)]">Count (B–S)</span>
                <div className="mt-0.5 flex w-fit max-w-full flex-nowrap items-end gap-1.5 sm:gap-2">
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="w-3.5 shrink-0 text-xs font-medium text-[var(--text-muted)]">B</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCountBalls((n) => Math.max(0, n - 1));
                        setPitchesSeen((p) =>
                          p === "" ? "" : Math.max(0, p - 1)
                        );
                      }}
                      disabled={countBalls <= 0}
                      className="record-pa-stepper-btn flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-[var(--accent)]/40 bg-[var(--accent-dim)] text-sm font-medium text-[var(--accent)] transition duration-200 hover:opacity-90 hover:border-[var(--accent)]/70 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
                      aria-label="Remove ball"
                    >
                      −
                    </button>
                    <div
                      className="input-tech flex h-8 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-1 text-center text-sm font-semibold tabular-nums text-[var(--text)]"
                      role="status"
                      aria-label="Balls"
                    >
                      {countBalls}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (countBalls === 0 && countStrikes === 0 && firstCountFromZero === null) {
                          setFirstCountFromZero("ball");
                        }
                        setCountBalls((n) => Math.min(3, n + 1));
                        setPitchesSeen((p) => (p === "" ? 1 : p + 1));
                        setStrikesThrown((s) => (s === "" ? 0 : s));
                      }}
                      disabled={countBalls >= 3}
                      className="record-pa-stepper-btn flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-[var(--accent)]/40 bg-[var(--accent-dim)] text-sm font-medium text-[var(--accent)] transition duration-200 hover:opacity-90 hover:border-[var(--accent)]/70 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
                      aria-label="Add ball"
                    >
                      +
                    </button>
                  </div>
                  <span className="shrink-0 self-end px-0.5 pb-[1px] text-[var(--text-muted)]" aria-hidden>
                    ·
                  </span>
                  <div className="flex min-w-0 shrink-0 flex-col items-start gap-1.75">
                    <p
                      className={`text-[13px] font-bold leading-tight ${
                        firstCountFromZero != null
                          ? "text-[var(--accent)]"
                          : "text-[var(--text-muted)]"
                      }`}
                      aria-live="polite"
                    >
                      First pitch:{" "}
                      {firstCountFromZero === "strike"
                        ? "Strike"
                        : firstCountFromZero === "ball"
                          ? "Ball"
                          : "—"}
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="w-3.5 shrink-0 text-xs font-medium text-[var(--text-muted)]">S</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCountStrikes((n) => Math.max(0, n - 1));
                          setPitchesSeen((p) =>
                            p === "" ? "" : Math.max(0, p - 1)
                          );
                          setStrikesThrown((s) => {
                            if (s === "") return "";
                            return Math.max(0, s - 1);
                          });
                        }}
                        disabled={countStrikes <= 0}
                        className="record-pa-stepper-btn flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-[var(--accent)]/40 bg-[var(--accent-dim)] text-sm font-medium text-[var(--accent)] transition duration-200 hover:opacity-90 hover:border-[var(--accent)]/70 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
                        aria-label="Remove strike"
                      >
                        −
                      </button>
                      <div
                        className="input-tech flex h-8 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-1 text-center text-sm font-semibold tabular-nums text-[var(--text)]"
                        role="status"
                        aria-label="Strikes"
                      >
                        {countStrikes}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (countBalls === 0 && countStrikes === 0 && firstCountFromZero === null) {
                            setFirstCountFromZero("strike");
                          }
                          setCountStrikes((n) => Math.min(2, n + 1));
                          const nextP =
                            pitchesSeen === "" ? 1 : pitchesSeen + 1;
                          setPitchesSeen(nextP);
                          setStrikesThrown((s) => {
                            const bumped = s === "" ? 1 : s + 1;
                            return Math.min(nextP, bumped);
                          });
                        }}
                        disabled={countStrikes >= 2}
                        className="record-pa-stepper-btn flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-[var(--accent)]/40 bg-[var(--accent-dim)] text-sm font-medium text-[var(--accent)] transition duration-200 hover:opacity-90 hover:border-[var(--accent)]/70 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
                        aria-label="Add strike"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex w-fit min-w-0 flex-col gap-0 justify-self-center">
                <span className="font-heading text-xs font-semibold text-[var(--text)]">Pitches</span>
                <div className="mt-0.5 flex w-fit max-w-full items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setPitchesSeen((p) => (p === "" ? 0 : Math.max(0, p - 1)))
                    }
                    className="record-pa-stepper-btn flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-[var(--accent)]/40 bg-[var(--accent-dim)] text-sm font-medium text-[var(--accent)] transition duration-200 hover:opacity-90 hover:border-[var(--accent)]/70 touch-manipulation"
                    aria-label="Decrease pitches"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={pitchesSeen}
                    onChange={(e) =>
                      setPitchesSeen(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="input-tech input-no-spinner h-8 w-10 shrink-0 px-1 py-1 text-center text-sm"
                    aria-label="Pitches seen"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPitchesSeen((p) => (p === "" ? 1 : p + 1))
                    }
                    className="record-pa-stepper-btn flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-[var(--accent)]/40 bg-[var(--accent-dim)] text-sm font-medium text-[var(--accent)] transition duration-200 hover:opacity-90 hover:border-[var(--accent)]/70 touch-manipulation"
                    aria-label="Increase pitches"
                  >
                    +
                  </button>
                </div>
                {showPitchesWarning && (
                  <p className="mt-1 text-[11px] leading-snug text-[var(--warning)]">
                    Pitches seen is required.
                  </p>
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-0">
                <span className="font-heading text-xs font-semibold text-[var(--text)]">Batter</span>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <select
                    value={batterId ?? ""}
                    onChange={(e) => setBatterId(e.target.value || null)}
                    className="input-tech min-h-[44px] min-w-0 max-w-[12rem] flex-1 px-2 py-2 text-sm touch-manipulation"
                    aria-label="Batter"
                  >
                    <option value="">Select</option>
                    {battersForDropdown.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.jersey ? `#${p.jersey}` : ""}
                      </option>
                    ))}
                  </select>
                  <label className="flex cursor-pointer items-center gap-1 text-[11px] text-[var(--text-muted)]">
                    <input
                      type="checkbox"
                      checked={autoAdvanceBatter}
                      onChange={(e) => setAutoAdvanceBatter(e.target.checked)}
                      className="rounded border-[var(--border)]"
                    />
                    Auto-advance
                  </label>
                </div>
              </div>
              <div className="flex w-fit min-w-0 flex-col gap-0 justify-self-center">
                <span className="font-heading text-xs font-semibold text-[var(--text)]">Strikes thrown</span>
                
                <div className="mt-0.5 flex w-fit items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setStrikesThrown((s) =>
                        s === "" ? 0 : Math.max(0, (s as number) - 1)
                      )
                    }
                    className="record-pa-stepper-btn flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-[var(--accent)]/40 bg-[var(--accent-dim)] text-sm font-medium text-[var(--accent)] transition duration-200 hover:opacity-90 hover:border-[var(--accent)]/70 touch-manipulation"
                    aria-label="Decrease strikes thrown"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={typeof pitchesSeen === "number" ? pitchesSeen : 0}
                    value={strikesThrown}
                    onChange={(e) =>
                      setStrikesThrown(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="input-tech input-no-spinner h-8 w-10 shrink-0 px-1 py-1 text-center text-sm"
                    aria-label="Strikes thrown"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setStrikesThrown((s) => {
                        const cap =
                          typeof pitchesSeen === "number" ? pitchesSeen : 0;
                        if (cap <= 0) return s === "" ? 0 : Math.min(cap, s as number);
                        if (s === "") return 1;
                        return Math.min(cap, (s as number) + 1);
                      })
                    }
                    className="record-pa-stepper-btn flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-[var(--accent)]/40 bg-[var(--accent-dim)] text-sm font-medium text-[var(--accent)] transition duration-200 hover:opacity-90 hover:border-[var(--accent)]/70 touch-manipulation"
                    aria-label="Increase strikes thrown"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            </section>
            </div>

            {/* Outcome */}
            <section className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5">
              <h4 className="font-display mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Outcome</h4>
              <div className="space-y-1">
                <div>
                  <span className="font-heading text-xs font-semibold text-[var(--text)]">Result</span>
                  <div className="mt-0.5 grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-x-4 lg:items-start">
                    {/* Column 1 — Hits, Reach, Hit direction */}
                    <div className="flex min-w-0 flex-col gap-2">
                      {(["Hits", "Reach"] as const).map((label) => {
                        const group = RESULT_GROUPS.find((g) => g.label === label);
                        if (!group) return null;
                        return (
                          <div key={group.label} className="flex items-center gap-2">
                            <span className="font-heading w-12 shrink-0 text-xs font-semibold text-[var(--text)]">{group.label}</span>
                            <div className="flex min-w-0 flex-wrap gap-2">
                              {group.options.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setResult(opt.value)}
                                  className={`min-h-[44px] min-w-[44px] cursor-pointer rounded-lg border-2 px-3 py-2 text-sm font-semibold transition duration-200 touch-manipulation ${
                                    result === opt.value
                                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)] hover:opacity-90"
                                      : "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--bg-elevated)]"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      <div>
                        <span className="font-heading text-xs font-semibold text-[var(--text)]">Hit direction</span>
                        <div className="mt-0.5 flex flex-wrap gap-2">
                          {(
                            [
                              { value: "pulled" as const, label: "Pulled" },
                              { value: "up_the_middle" as const, label: "Up the middle" },
                              { value: "opposite_field" as const, label: "Opposite field" },
                            ] as const
                          ).map(({ value, label }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setHitDirection(value)}
                              className={`min-h-[44px] min-w-[44px] cursor-pointer rounded-lg border-2 px-3 py-2 text-sm font-semibold transition duration-200 touch-manipulation ${
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
                          <p className="mt-1 text-[11px] leading-snug text-[var(--warning)]">
                            Choose pull, middle, or oppo for this base hit.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Column 2 — Outs & Other */}
                    <div className="flex min-w-0 flex-col gap-2">
                      {(["Outs", "Other"] as const).map((label) => {
                        const group = RESULT_GROUPS.find((g) => g.label === label);
                        if (!group) return null;
                        return (
                          <div key={group.label} className="flex items-center gap-2">
                            <span className="font-heading w-12 shrink-0 text-xs font-semibold text-[var(--text)]">{group.label}</span>
                            <div className="flex min-w-0 flex-wrap gap-2">
                              {group.options.map((opt) => {
                                const runnerRequiredBlocked =
                                  requiresRunnerOnBaseForResult(opt.value) && baseState === "000";
                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    title={
                                      runnerRequiredBlocked
                                        ? "Put at least one runner on base before recording GIDP, fielder's choice, or a sacrifice."
                                        : undefined
                                    }
                                    disabled={runnerRequiredBlocked}
                                    onClick={() => setResult(opt.value)}
                                    className={`min-h-[44px] min-w-[44px] rounded-lg border-2 px-3 py-2 text-sm font-semibold transition duration-200 touch-manipulation ${
                                      runnerRequiredBlocked
                                        ? "cursor-not-allowed border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] opacity-60"
                                        : result === opt.value
                                          ? "cursor-pointer border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)] hover:opacity-90"
                                          : "cursor-pointer border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--bg-elevated)]"
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Column 3 — Who scored, RBI, roster chips, Other dropdown */}
                    <div className="flex min-w-0 flex-col gap-2">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-heading text-xs font-semibold text-[var(--text)]">Who scored</span>
                        <div className="flex min-w-0 flex-col gap-1.5">
                          {autoScoredPreview.length > 0 ? (
                            <p className="text-xs leading-snug text-[var(--text-muted)]">
                              <span className="font-medium text-[var(--text)]">Inferred from play:</span>{" "}
                              {autoScoredPreview
                                .map((id) => players.find((x) => x.id === id)?.name ?? "?")
                                .join(", ")}
                            </p>
                          ) : null}
                          {scoringCandidates.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mark who scored">
                              {scoringCandidates.map(({ id, label }) => {
                                const manual = runsScoredPlayerIds !== null;
                                const selected = manual
                                  ? runsScoredPlayerIds.includes(id)
                                  : autoScoredPreview.includes(id);
                                const p = players.find((x) => x.id === id);
                                const shortName =
                                  p?.name?.split(/\s+/).slice(-1)[0] ?? p?.name ?? "?";
                                return (
                                  <button
                                    key={id}
                                    type="button"
                                    aria-label={`${label} ${shortName}: ${selected ? "scored — tap to unmark" : "not scored — tap to mark"}`}
                                    onClick={() => {
                                      const adding = !selected;
                                      setRunsScoredPlayerIds((prev) => {
                                        const baseline =
                                          prev === null
                                            ? autoScoredPreview.length > 0
                                              ? [...autoScoredPreview]
                                              : []
                                            : [...prev];
                                        return baseline.includes(id)
                                          ? baseline.filter((i) => i !== id)
                                          : [...baseline, id];
                                      });
                                      setRbi((r) =>
                                        adding ? Math.min(4, r + 1) : Math.max(0, r - 1)
                                      );
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
                                      className={`block max-w-[9rem] truncate ${
                                        selected ? "text-[var(--bg-base)]" : "text-[var(--text)]"
                                      }`}
                                    >
                                      {shortName}
                                    </span>
                                  </button>
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
                      <div className="flex items-center gap-1">
                        <span className="font-heading text-xs font-semibold text-[var(--text)]">RBI</span>
                        <button
                          type="button"
                          onClick={() => setRbi((n: number) => Math.max(0, n - 1))}
                          className="record-pa-stepper-btn flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-[var(--accent)]/40 bg-[var(--accent-dim)] text-sm font-medium text-[var(--accent)] transition duration-200 hover:opacity-90 hover:border-[var(--accent)]/70 touch-manipulation"
                          aria-label="Decrease RBI"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={4}
                          value={rbi}
                          onChange={(e) => setRbi(Math.min(4, Math.max(0, Number(e.target.value) || 0)))}
                          className="input-tech input-no-spinner w-12 px-1 py-2 text-center text-sm"
                          aria-label="RBI"
                        />
                        <button
                          type="button"
                          onClick={() => setRbi((n: number) => Math.min(4, n + 1))}
                          className="record-pa-stepper-btn flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-[var(--accent)]/40 bg-[var(--accent-dim)] text-sm font-medium text-[var(--accent)] transition duration-200 hover:opacity-90 hover:border-[var(--accent)]/70 touch-manipulation"
                          aria-label="Increase RBI"
                        >
                          +
                        </button>
                      </div>
                      {showRbiHint && (
                        <p className="text-[11px] leading-snug text-[var(--warning)]">
                          Runners on base but RBI = 0.
                        </p>
                      )}
                      {otherScorerIds.length > 0 ? (
                        <div className="flex flex-wrap gap-0.5">
                          {otherScorerIds.map((id) => {
                            const p = players.find((x) => x.id === id);
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => {
                                  setRunsScoredPlayerIds((ids) =>
                                    (ids ?? []).filter((i) => i !== id)
                                  );
                                  setRbi((r) => Math.max(0, r - 1));
                                }}
                                className="inline-flex cursor-pointer items-center gap-0.5 rounded-full border border-[var(--accent)]/50 bg-[var(--accent)]/10 px-1.5 py-0.5 text-[11px] font-medium text-[var(--text)] transition hover:bg-[var(--accent)]/20"
                                aria-label={`Remove ${p?.name ?? "scorer"}`}
                              >
                                {p?.name ?? "?"}×
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                      {(runsScoredPlayerIds !== null || autoScoredPreview.length === 0) &&
                      battersForDropdown.some((p) => !scoringCandidateIds.has(p.id)) ? (
                        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-1.5">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                            Other
                          </span>
                          <select
                            value=""
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v && !(runsScoredPlayerIds ?? []).includes(v)) {
                                setRunsScoredPlayerIds((prev) => {
                                  const base =
                                    prev === null
                                      ? autoScoredPreview.length > 0
                                        ? [...autoScoredPreview]
                                        : []
                                      : [...prev];
                                  return base.includes(v) ? base : [...base, v];
                                });
                                setRbi((r) => Math.min(4, r + 1));
                              }
                              e.target.value = "";
                            }}
                            className="input-tech min-h-[40px] w-full min-w-0 max-w-full px-2 py-1.5 text-sm touch-manipulation sm:max-w-[14rem]"
                            aria-label="Add scorer not on base"
                          >
                            <option value="">Add from roster…</option>
                            {battersForDropdown
                              .filter((p) => !scoringCandidateIds.has(p.id))
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                  {p.jersey ? ` #${p.jersey}` : ""}
                                </option>
                              ))}
                          </select>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </section>

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
              {lastPA && (
                <button
                  type="button"
                  onClick={requestUndoLastPA}
                  disabled={destructivePending}
                  className="min-h-[44px] cursor-pointer rounded-lg border-2 border-[var(--border)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)] touch-manipulation disabled:opacity-50"
                >
                  Undo last PA
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
                    (strikesThrown === "" || firstCountFromZero === null)) ||
                  (RESULT_IS_HIT.has(result) && hitDirection === null) ||
                  (result != null && requiresRunnerOnBaseForResult(result) && baseState === "000") ||
                  saving
                }
                className="min-h-[48px] min-w-[8rem] flex-1 cursor-pointer rounded-lg bg-[var(--accent)] py-3 text-base font-semibold text-[var(--bg-base)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none touch-manipulation"
              >
                {saving ? "Saving…" : "Save PA"}
              </button>
            </div>
              </div>
              <div className="w-full max-w-[280px] shrink-0 self-start lg:w-[220px]">
                <section className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5">
                  <h4 className="font-display mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Runners</h4>
                  <div className="mt-0.5 lg:scale-[0.94] lg:origin-top-left">
                    <BaseStateSelector
                      value={baseState}
                      onChange={setBaseState}
                      runnerIds={[runnerOn1bId, runnerOn2bId, runnerOn3bId]}
                      onRunnerChange={(idx, id) => {
                        if (idx === 0) setRunnerOn1bId(id);
                        else if (idx === 1) setRunnerOn2bId(id);
                        else setRunnerOn3bId(id);
                      }}
                      runnerOptions={battersForDropdown.map((p) => ({ id: p.id, name: p.name, jersey: p.jersey ?? null }))}
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

          {lastSavedPaSummary && (
            <section
              className="rounded-lg border border-[var(--accent)]/35 bg-[var(--accent-dim)]/25 px-3 py-2.5"
              aria-label="Last saved plate appearance — who scored"
            >
              <p className="font-display text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Last PA saved — verify
              </p>
              <p className="mt-1 text-sm text-[var(--text)]">
                <span className="font-semibold">{lastSavedPaSummary.batterName}</span>
                <span className="text-[var(--text-muted)]"> · </span>
                {lastSavedPaSummary.resultLabel}
                <span className="text-[var(--text-muted)]"> · </span>
                {lastSavedPaSummary.inningHalf
                  ? `${lastSavedPaSummary.inningHalf} ${lastSavedPaSummary.inning}`
                  : `Inning ${lastSavedPaSummary.inning}`}
                {lastSavedPaSummary.rbi > 0 && (
                  <>
                    <span className="text-[var(--text-muted)]"> · </span>
                    {lastSavedPaSummary.rbi} RBI
                  </>
                )}
              </p>
              <p className="mt-1.5 text-sm">
                <span className="font-semibold text-[var(--accent)]">Scored:</span>{" "}
                {lastSavedPaSummary.runsScoredNames.length > 0 ? (
                  <span className="text-[var(--text)]">
                    {lastSavedPaSummary.runsScoredNames.join(", ")}
                  </span>
                ) : (
                  <span className="text-[var(--text-muted)]">None</span>
                )}
              </p>
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
                    Pitchers – {battingTableTeamName}
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
                      side={displayBattingSide}
                      pas={allPAsForGame}
                      players={players}
                      compact
                      hideHeading
                    />
                    <BattingPitchMixCard pas={pasForPitchMixUnderPitchingTable} players={players} compact />
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
                      side={displayBattingSide}
                      pas={allPAsForGame}
                      players={players}
                      compact
                    />
                    <BattingPitchMixCard pas={pasForPitchMixUnderPitchingTable} players={players} compact />
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <ConfirmDeleteDialog
        open={destructiveConfirm !== null}
        onClose={() => !destructivePending && setDestructiveConfirm(null)}
        title={
          destructiveConfirm === "undoLastPa"
            ? "Remove last plate appearance?"
            : "Clear all plate appearances for this game?"
        }
        description={
          destructiveConfirm === "undoLastPa"
            ? "The most recently recorded plate appearance will be permanently removed."
            : "This cannot be undone. All PAs recorded for this game will be deleted."
        }
        confirmLabel={destructiveConfirm === "undoLastPa" ? "Remove" : "Clear plate appearances"}
        pendingLabel={destructiveConfirm === "undoLastPa" ? "Removing…" : "Clearing…"}
        pending={destructivePending}
        onConfirm={handleDestructiveConfirm}
      />
    </div>
  );
}
