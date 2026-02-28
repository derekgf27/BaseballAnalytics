"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { BaseStateSelector } from "@/components/shared/BaseStateSelector";
import { GameBattingTable } from "@/components/analyst/GameBattingTable";
import { formatDateMMDDYYYY } from "@/lib/format";
import { clearPAsForGameAction } from "@/app/analyst/games/actions";
import { isDemoId } from "@/lib/db/mockData";
import { getBaseStateAfterResult } from "@/lib/compute/runExpectancy";
import type {
  Game,
  Player,
  PlateAppearance,
  PAResult,
  BaseState,
  HitDirection,
} from "@/lib/types";

const RESULT_OPTIONS: { value: PAResult; label: string }[] = [
  { value: "single", label: "1B" },
  { value: "double", label: "2B" },
  { value: "triple", label: "3B" },
  { value: "hr", label: "HR" },
  { value: "out", label: "Out" },
  { value: "so", label: "SO" },
  { value: "bb", label: "BB" },
  { value: "ibb", label: "IBB" },
  { value: "hbp", label: "HBP" },
  { value: "sac_fly", label: "Sacrifice Fly" },
  { value: "sac_bunt", label: "Sacrifice Bunt" },
  { value: "other", label: "Reached on Error" },
];

/** Result options grouped for Outcome section (Hits, Outs, Reach, Other). */
const RESULT_GROUPS: { label: string; options: { value: PAResult; label: string }[] }[] = [
  { label: "Hits", options: RESULT_OPTIONS.filter((o) => ["single", "double", "triple", "hr"].includes(o.value)) },
  { label: "Outs", options: RESULT_OPTIONS.filter((o) => ["out", "so"].includes(o.value)) },
  { label: "Reach", options: RESULT_OPTIONS.filter((o) => ["bb", "ibb", "hbp"].includes(o.value)) },
  { label: "Other", options: RESULT_OPTIONS.filter((o) => ["sac_fly", "sac_bunt", "other"].includes(o.value)) },
];

const RESULT_IS_OUT = new Set<PAResult>(["out", "so", "so_looking"]);
/** Results that add one out (used to advance outs/inning after save). */
const RESULT_ADDS_ONE_OUT = new Set<PAResult>(["out", "so", "so_looking", "sac_fly", "sac_bunt", "sac"]);

/** Compute new runner IDs after a play (for 1st, 2nd, 3rd). Used to advance state after save. */
function getRunnerIdsAfterResult(
  runner1b: string | null,
  runner2b: string | null,
  runner3b: string | null,
  batterId: string,
  result: PAResult
): [string | null, string | null, string | null] {
  if (result === "hr") return [null, null, null];
  if (result === "triple") return [null, null, batterId];
  if (result === "double") return [runner1b, batterId, runner2b];
  if (result === "single" || result === "bb" || result === "ibb" || result === "hbp" || result === "other") {
    return [batterId, runner1b, runner2b]; // batter to 1st; other runners advance (user can adjust manually for ROE)
  }
  if (result === "sac_fly" || result === "sac") {
    return [runner1b, runner2b, null]; // runner from 3rd scores
  }
  if (result === "sac_bunt") {
    return [batterId, runner1b, runner2b ?? runner3b]; // advance, 3rd might score
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
  if (result === "double" || result === "single" || result === "bb" || result === "ibb" || result === "hbp") {
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

const PLAY_PRESETS = [
  "4-3",
  "6-3",
  "5-3",
  "3-1",
  "1-3",
  "6-4-3",
  "4-6-3",
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
  /** When set (e.g. from ?gameId=...), open with this game pre-selected. */
  initialGameId?: string;
  fetchPAsForGame: (gameId: string) => Promise<PlateAppearance[]>;
  fetchGameLineupOrder: (
    gameId: string
  ) => Promise<{ order: string[]; positionByPlayerId: Record<string, string> }>;
  savePlateAppearance: (
    pa: Omit<PlateAppearance, "id" | "created_at">
  ) => Promise<{ ok: boolean; error?: string }>;
  deletePlateAppearance: (paId: string) => Promise<{ ok: boolean; error?: string }>;
}

const RESULT_IS_HIT = new Set<PAResult>(["single", "double", "triple", "hr"]);

export default function RecordPageClient({
  games,
  players,
  initialGameId,
  fetchPAsForGame,
  fetchGameLineupOrder,
  savePlateAppearance,
  deletePlateAppearance,
}: RecordPageClientProps) {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(initialGameId ?? null);
  const [inning, setInning] = useState(1);
  const [inningHalf, setInningHalf] = useState<"top" | "bottom" | null>(null);
  const [outs, setOuts] = useState(0);
  const [baseState, setBaseState] = useState<BaseState>("000");
  const [runnerOn1bId, setRunnerOn1bId] = useState<string | null>(null);
  const [runnerOn2bId, setRunnerOn2bId] = useState<string | null>(null);
  const [runnerOn3bId, setRunnerOn3bId] = useState<string | null>(null);
  const [batterId, setBatterId] = useState<string | null>(players[0]?.id ?? null);
  const [result, setResult] = useState<PAResult | null>(null);
  const [showDetails, setShowDetails] = useState(true);
  const [countBalls, setCountBalls] = useState(0);
  const [countStrikes, setCountStrikes] = useState(0);
  const [rbi, setRbi] = useState(0);
  const [runsScoredPlayerIds, setRunsScoredPlayerIds] = useState<string[]>([]);
  const [runsScoredAddId, setRunsScoredAddId] = useState<string | null>(null);
  const [stolenBasePlayerIds, setStolenBasePlayerIds] = useState<string[]>([]);
  const [stolenBaseAddId, setStolenBaseAddId] = useState<string | null>(null);
  const [hitDirection, setHitDirection] = useState<HitDirection | null>(null);
  const [pitcherHand, setPitcherHand] = useState<"L" | "R" | null>(null);
  const [pitchesSeen, setPitchesSeen] = useState<number | "">("");
  const [playNote, setPlayNote] = useState("");
  const [notes, setNotes] = useState("");
  const [autoAdvanceBatter, setAutoAdvanceBatter] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearingPAs, setClearingPAs] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [allPAsForGame, setAllPAsForGame] = useState<PlateAppearance[]>([]);
  const [lineupOrder, setLineupOrder] = useState<string[] | null>(null);
  const [lineupPositionByPlayerId, setLineupPositionByPlayerId] = useState<
    Record<string, string>
  >({});

  const selectedGame = games.find((g) => g.id === selectedGameId);
  const selectedBatter = players.find((p) => p.id === batterId);

  const battersForDropdown =
    lineupOrder && lineupOrder.length > 0
      ? [
          ...lineupOrder
            .map((id) => players.find((p) => p.id === id))
            .filter((p): p is Player => p != null),
          ...players.filter((p) => !lineupOrder.includes(p.id)),
        ]
      : players;

  const goToNextBatter = () => {
    if (battersForDropdown.length === 0) return;
    const idx = battersForDropdown.findIndex((p) => p.id === batterId);
    const nextIdx = idx < 0 ? 0 : (idx + 1) % battersForDropdown.length;
    setBatterId(battersForDropdown[nextIdx].id);
  };

  const loadPAs = useCallback((options?: { resetBatter?: boolean }) => {
    if (!selectedGameId) return;
    const resetBatter = options?.resetBatter !== false;
    setAllPAsForGame([]);
    setLineupOrder(null);
    setLineupPositionByPlayerId({});
    Promise.all([
      fetchPAsForGame(selectedGameId),
      fetchGameLineupOrder(selectedGameId),
    ]).then(([pas, { order, positionByPlayerId }]) => {
      setAllPAsForGame(pas);
      setLineupOrder(order.length > 0 ? order : null);
      setLineupPositionByPlayerId(positionByPlayerId ?? {});
      if (resetBatter) {
        const firstBatterId =
          order.length > 0 ? order[0] : players[0]?.id ?? null;
        setBatterId(firstBatterId);
      }
    });
  }, [selectedGameId, fetchPAsForGame, fetchGameLineupOrder, players]);

  useEffect(() => {
    loadPAs();
  }, [loadPAs]);

  // Auto-set RBI for HR: 1 (batter) + runners on base (e.g. loaded = 4)
  useEffect(() => {
    if (result === "hr") {
      const runners = (baseState.match(/1/g) || []).length;
      setRbi(1 + runners);
    }
  }, [result, baseState]);

  const showMsg = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async () => {
    if (!selectedGameId || !batterId || result === null) return;
    if (pitcherHand === null) {
      showMsg("error", "Pitcher handedness is required.");
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
        autoScored.length > 0 ? autoScored : runsScoredPlayerIds.length > 0 ? runsScoredPlayerIds : undefined;
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
        hit_direction: hitDirection,
        pitches_seen: pitchesSeen === "" ? null : pitchesSeen,
        rbi,
        runs_scored_player_ids: runsScoredIds,
        stolen_bases: stolenBasePlayerIds.length > 0 ? stolenBasePlayerIds.length : undefined,
        pitcher_hand: pitcherHand,
        inning_half: inningHalf ?? undefined,
        notes: notesCombined,
      };
      const { ok, error } = await savePlateAppearance(pa);
      if (!ok) {
        showMsg("error", error ?? "Failed to save PA");
        return;
      }
      showMsg("success", "PA saved");
      setResult(null);
      setCountBalls(0);
      setCountStrikes(0);
      setRbi(0);
      setRunsScoredPlayerIds([]);
      setRunsScoredAddId(null);
      setStolenBasePlayerIds([]);
      setStolenBaseAddId(null);
      setHitDirection(null);
      setInningHalf(null);
      setPitchesSeen("");
      setPlayNote("");
      setNotes("");
      if (autoAdvanceBatter && battersForDropdown.length > 0) {
        const idx = battersForDropdown.findIndex((p) => p.id === batterId);
        const nextIdx = idx < 0 ? 0 : (idx + 1) % battersForDropdown.length;
        setBatterId(battersForDropdown[nextIdx].id);
      }
      const newBaseState = getBaseStateAfterResult(baseState, result);
      const [newR1, newR2, newR3] = getRunnerIdsAfterResult(
        runnerOn1bId,
        runnerOn2bId,
        runnerOn3bId,
        batterId,
        result
      );
      if (RESULT_ADDS_ONE_OUT.has(result)) {
        if (outs >= 2) {
          setInning((i) => Math.min(i + 1, 10));
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

  const handleUndoLastPA = async () => {
    if (!lastPA || !selectedGameId) return;
    if (!confirm("Remove the last recorded plate appearance?")) return;
    const { ok, error } = await deletePlateAppearance(lastPA.id);
    if (ok) {
      showMsg("success", "Last PA removed");
      loadPAs();
    } else {
      showMsg("error", error ?? "Failed to remove");
    }
  };

  const clearForm = () => {
    setInning(1);
    setInningHalf(null);
    setOuts(0);
    setBaseState("000");
    setRunnerOn1bId(null);
    setRunnerOn2bId(null);
    setRunnerOn3bId(null);
    setBatterId(lineupOrder?.[0] ?? players[0]?.id ?? null);
    setResult(null);
    setCountBalls(0);
    setCountStrikes(0);
    setRbi(0);
    setRunsScoredPlayerIds([]);
    setRunsScoredAddId(null);
    setStolenBasePlayerIds([]);
    setStolenBaseAddId(null);
    setHitDirection(null);
    setPitcherHand(null);
    setPitchesSeen("");
    setPlayNote("");
    setNotes("");
  };

  const validationHints: string[] = [];
  if (pitcherHand === null && (result !== null || batterId)) {
    validationHints.push("Pitcher handedness is required.");
  }
  if (result && RESULT_IS_HIT.has(result) && baseState !== "000" && rbi === 0) {
    validationHints.push("Runners on base but RBI = 0.");
  }

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
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          Record PAs
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Select a game, then log each plate appearance. Game state (inning, outs, bases) persists between PAs.
        </p>
      </header>

      <div className="card-tech rounded-lg border p-2.5">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Game
          </span>
          <select
            value={selectedGameId ?? ""}
            onChange={(e) => setSelectedGameId(e.target.value || null)}
            className="input-tech mt-0.5 block w-full max-w-md px-2 py-1.5 text-sm"
          >
            <option value="">Select a game…</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {formatDateMMDDYYYY(g.date)} — {g.away_team} @ {g.home_team}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!selectedGameId && (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
          Select a game above to start recording plate appearances.
        </p>
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
                className="rounded border border-[var(--danger)] px-3 py-1.5 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger-dim)]"
              >
                Clear form
              </button>
              {!isDemoId(selectedGameId) && (
                <button
                  type="button"
                  disabled={clearingPAs}
                  onClick={async () => {
                    if (!confirm("Clear all plate appearances for this game? This cannot be undone.")) return;
                    setClearingPAs(true);
                    const result = await clearPAsForGameAction(selectedGameId);
                    setClearingPAs(false);
                    if (result.ok) {
                      showMsg("success", result.count > 0 ? `Cleared ${result.count} PA(s).` : "No PAs to clear.");
                      loadPAs();
                    } else {
                      showMsg("error", result.error ?? "Failed to clear PAs.");
                    }
                  }}
                  className="rounded border border-[var(--danger)] px-3 py-1.5 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger-dim)] disabled:opacity-50"
                >
                  {clearingPAs ? "Clearing…" : "Clear PAs for this game"}
                </button>
              )}
            </div>
          </div>

          {message && (
            <div
              className={`rounded-lg border px-4 py-2 text-sm ${
                message.type === "success"
                  ? "border-[var(--success)] bg-[var(--success-dim)] text-[var(--success)]"
                  : "border-[var(--warning)] bg-[var(--warning-dim)] text-[var(--warning)]"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="card-tech rounded-lg border p-2">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
              <div className="min-w-0 flex-1 space-y-2">
            {/* Game state + At bat side-by-side on desktop */}
            <div className="grid gap-2 lg:grid-cols-2">
            {/* Game state */}
            <section className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5">
              <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Game state</h4>
            <div className="grid grid-cols-[auto_auto_1fr] gap-x-2 gap-y-1 sm:grid-cols-[auto_auto_1fr]">
              <label className="w-fit">
                <span className="font-heading text-xs font-semibold text-[var(--text)]">Inning</span>
                <select
                  value={inning}
                  onChange={(e) => setInning(Number(e.target.value))}
                  className="input-tech mt-0.5 block min-h-[44px] w-16 px-2 py-2 text-sm touch-manipulation"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
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
                      onClick={() => setInningHalf(inningHalf === half ? null : half)}
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
            </section>

            {/* At bat */}
            <section className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5">
              <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">At bat</h4>
            <div className="space-y-1">
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <span className="font-heading text-xs font-semibold text-[var(--text)]">Pitcher</span>
                <div className="mt-0.5 flex gap-2">
                  {(["L", "R"] as const).map((hand) => (
                    <button
                      key={hand}
                      type="button"
                      onClick={() => setPitcherHand(hand)}
                      className={`min-h-[44px] min-w-[56px] cursor-pointer rounded-lg border-2 px-3 py-2 text-sm font-semibold transition duration-200 touch-manipulation ${
                      pitcherHand === hand
                        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)]"
                        : "border-[var(--border)] bg-transparent text-[var(--text-muted)]"
                    }`}
                  >
                    {hand}HP
                  </button>
                ))}
                </div>
              </div>
              <div>
                <span className="font-heading text-xs font-semibold text-[var(--text)]">Count (B–S)</span>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <label className="flex items-center gap-0.5 text-xs">
                    <span className="text-[var(--text-muted)]">B</span>
                    <select
                      value={countBalls}
                      onChange={(e) => setCountBalls(Number(e.target.value))}
                      className="input-tech min-h-[44px] w-14 px-1 py-2 text-sm touch-manipulation"
                      aria-label="Balls"
                    >
                      {[0, 1, 2, 3].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setCountBalls((n) => Math.min(3, n + 1))}
                      disabled={countBalls >= 3}
                      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-[var(--accent)]/40 bg-[var(--accent-dim)] text-sm font-bold text-[var(--accent)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
                      aria-label="Add ball"
                    >
                      +
                    </button>
                  </label>
                  <span className="text-[var(--text-muted)]">–</span>
                  <label className="flex items-center gap-0.5 text-xs">
                    <span className="text-[var(--text-muted)]">S</span>
                    <select
                      value={countStrikes}
                      onChange={(e) => setCountStrikes(Number(e.target.value))}
                      className="input-tech min-h-[44px] w-14 px-1 py-2 text-sm touch-manipulation"
                      aria-label="Strikes"
                    >
                      {[0, 1, 2].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setCountStrikes((n) => Math.min(2, n + 1))}
                      disabled={countStrikes >= 2}
                      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-[var(--accent)]/40 bg-[var(--accent-dim)] text-sm font-bold text-[var(--accent)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
                      aria-label="Add strike"
                    >
                      +
                    </button>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
              <div className="flex flex-col gap-0">
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
                <button
                  type="button"
                  onClick={goToNextBatter}
                  disabled={battersForDropdown.length === 0}
                  className="min-h-[44px] cursor-pointer shrink-0 rounded-lg border-2 border-[var(--accent)]/40 bg-[var(--accent-dim)] px-4 py-2 text-sm font-medium text-[var(--accent)] transition duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
                  title="Next batter in lineup"
                >
                  Next
                </button>
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
              <div className="flex flex-col gap-0">
                <span className="font-heading text-xs font-semibold text-[var(--text)]">Pitches</span>
                <div className="mt-0.5 flex w-fit items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setPitchesSeen((p) => (p === "" ? 0 : Math.max(0, p - 1)))
                    }
                    className="record-pa-stepper-btn flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-[var(--accent)]/40 bg-[var(--accent-dim)] text-lg font-medium text-[var(--accent)] transition duration-200 hover:opacity-90 hover:border-[var(--accent)]/70 touch-manipulation"
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
                    className="input-tech input-no-spinner w-12 shrink-0 px-1 py-2 text-center text-sm"
                    aria-label="Pitches seen"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPitchesSeen((p) => (p === "" ? 1 : p + 1))
                    }
                    className="record-pa-stepper-btn flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-[var(--accent)]/40 bg-[var(--accent-dim)] text-lg font-medium text-[var(--accent)] transition duration-200 hover:opacity-90 hover:border-[var(--accent)]/70 touch-manipulation"
                    aria-label="Increase pitches"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            </div>
            </section>
            </div>

            {/* Outcome */}
            <section className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5">
              <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Outcome</h4>
              <div className="space-y-1">
                <div>
                  <span className="font-heading text-xs font-semibold text-[var(--text)]">Result</span>
                  <div className="mt-0.5 grid grid-cols-2 gap-x-4 gap-y-2">
                    {RESULT_GROUPS.map((group) => (
                      <div key={group.label} className="flex items-center gap-2">
                        <span className="w-12 shrink-0 text-xs font-medium text-[var(--text-muted)]">{group.label}</span>
                        <div className="flex flex-wrap gap-2 min-w-0">
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
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 gap-y-2">
                  <div className="flex items-center gap-1">
                    <span className="font-heading text-xs font-semibold text-[var(--text)]">RBI</span>
                    <button
                      type="button"
                      onClick={() => setRbi((n: number) => Math.max(0, n - 1))}
                      className="record-pa-stepper-btn flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-[var(--accent)]/40 bg-[var(--accent-dim)] text-lg font-medium text-[var(--accent)] transition duration-200 hover:opacity-90 hover:border-[var(--accent)]/70 touch-manipulation"
                      aria-label="Decrease RBI"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={rbi}
                      onChange={(e) => setRbi(Number(e.target.value))}
                      className="input-tech input-no-spinner w-12 px-1 py-2 text-center text-sm"
                      aria-label="RBI"
                    />
                    <button
                      type="button"
                      onClick={() => setRbi((n: number) => n + 1)}
                      className="record-pa-stepper-btn flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-[var(--accent)]/40 bg-[var(--accent-dim)] text-lg font-medium text-[var(--accent)] transition duration-200 hover:opacity-90 hover:border-[var(--accent)]/70 touch-manipulation"
                      aria-label="Increase RBI"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="font-heading text-xs font-semibold text-[var(--text)]">Who scored</span>
                    <select
                      value={runsScoredAddId ?? ""}
                      onChange={(e) => setRunsScoredAddId(e.target.value || null)}
                      className="input-tech min-h-[44px] min-w-[8rem] px-2 py-2 text-sm touch-manipulation"
                      aria-label="Select runner who scored"
                    >
                      <option value="">Select</option>
                      {battersForDropdown.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.jersey ? `#${p.jersey}` : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (runsScoredAddId && !runsScoredPlayerIds.includes(runsScoredAddId)) {
                          setRunsScoredPlayerIds((ids) => [...ids, runsScoredAddId]);
                          setRunsScoredAddId(null);
                        }
                      }}
                      disabled={!runsScoredAddId || runsScoredPlayerIds.includes(runsScoredAddId ?? "")}
                      className="min-h-[44px] cursor-pointer rounded-lg border-2 border-[var(--accent)]/40 bg-[var(--accent-dim)] px-4 py-2 text-sm font-medium text-[var(--accent)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
                    >
                      Add
                    </button>
                    {runsScoredPlayerIds.length > 0 && (
                      <span className="flex flex-wrap gap-0.5">
                        {runsScoredPlayerIds.map((id) => {
                          const p = players.find((x) => x.id === id);
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setRunsScoredPlayerIds((ids) => ids.filter((i) => i !== id))}
                              className="inline-flex cursor-pointer items-center gap-0.5 rounded-full border border-[var(--accent)]/50 bg-[var(--accent)]/10 px-1.5 py-0.5 text-[11px] font-medium text-[var(--text)] transition hover:bg-[var(--accent)]/20"
                              aria-label={`Remove ${p?.name ?? "scorer"}`}
                            >
                              {p?.name ?? "?"}×
                            </button>
                          );
                        })}
                      </span>
                    )}
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
                {showDetails ? "− Hide details" : "+ Add details (Stolen bases, hit direction, notes)"}
              </button>
              {showDetails && (
                <div className="mt-1 grid grid-cols-1 gap-1 rounded border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-heading text-xs font-semibold text-[var(--text)]">Stolen bases</span>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <select
                        value={stolenBaseAddId ?? ""}
                        onChange={(e) => setStolenBaseAddId(e.target.value || null)}
                        className="input-tech min-w-0 flex-1 px-1.5 py-0.5 text-xs"
                        aria-label="Select runner who stole"
                      >
                          <option value="">Select runner who stole</option>
                          {battersForDropdown.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.jersey ? `#${p.jersey}` : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            if (stolenBaseAddId) {
                              setStolenBasePlayerIds((ids) => [...ids, stolenBaseAddId]);
                              setStolenBaseAddId(null);
                            }
                          }}
                          disabled={!stolenBaseAddId}
                          className="cursor-pointer rounded border border-[var(--accent)]/40 bg-[var(--accent-dim)] px-2 py-0.5 text-xs font-medium text-[var(--accent)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                      {stolenBasePlayerIds.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-0.5">
                          {stolenBasePlayerIds.map((id, idx) => {
                            const p = players.find((x) => x.id === id);
                            return (
                              <button
                                key={`${id}-${idx}`}
                                type="button"
                                onClick={() =>
                                  setStolenBasePlayerIds((ids) => {
                                    const i = ids.indexOf(id);
                                    if (i < 0) return ids;
                                    return [...ids.slice(0, i), ...ids.slice(i + 1)];
                                  })
                                }
                                className="inline-flex cursor-pointer items-center gap-0.5 rounded-full border border-[var(--accent)]/50 bg-[var(--accent)]/10 px-1.5 py-0.5 text-[11px] font-medium text-[var(--text)] transition hover:bg-[var(--accent)]/20"
                                aria-label={`Remove ${p?.name ?? "runner"} stolen base`}
                              >
                                {p?.name ?? "?"}×
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
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
                            onClick={() => setHitDirection(hitDirection === value ? null : value)}
                            className={`min-h-[44px] min-w-[44px] cursor-pointer rounded-lg border-2 px-3 py-2 text-sm font-medium transition duration-200 touch-manipulation ${
                              hitDirection === value
                                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)] hover:opacity-90"
                                : "border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-1 space-y-0.5">
                    <span className="font-heading text-xs font-semibold text-[var(--text)]">Play</span>
                    <div className="mt-0.5 flex flex-wrap gap-2">
                      {PLAY_PRESETS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPlayNote(playNote === p ? "" : p)}
                          className={`min-h-[44px] min-w-[44px] cursor-pointer rounded-lg border-2 px-3 py-2 text-sm font-medium transition duration-200 touch-manipulation ${
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
                  <label className="sm:col-span-2 lg:col-span-1">
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

            {validationHints.length > 0 && (
              <p className="text-[11px] text-[var(--warning)]">
                {validationHints.join(" ")}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {lastPA && (
                <button
                  type="button"
                  onClick={handleUndoLastPA}
                  className="min-h-[44px] cursor-pointer rounded-lg border-2 border-[var(--border)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)] touch-manipulation"
                >
                  Undo last PA
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={!batterId || result === null || pitcherHand === null || saving}
                className="min-h-[48px] min-w-[8rem] flex-1 cursor-pointer rounded-lg bg-[var(--accent)] py-3 text-base font-semibold text-[var(--bg-base)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none touch-manipulation"
              >
                {saving ? "Saving…" : "Save PA"}
              </button>
            </div>
              </div>
              <div className="w-[240px] shrink-0">
                <section className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5">
                  <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Runners</h4>
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
                      runnerOptions={battersForDropdown.map((p) => ({ id: p.id, name: p.name, jersey: p.jersey ?? null }))}
                      currentBatterId={batterId}
                    />
                  </div>
                </section>
              </div>
            </div>
          </div>

          <GameBattingTable
            game={selectedGame}
            pas={allPAsForGame}
            players={players}
            lineupOrder={lineupOrder ?? undefined}
            lineupPositionByPlayerId={lineupPositionByPlayerId}
            highlightedBatterId={batterId}
            pendingStolenBasesByBatterId={
              stolenBasePlayerIds.length > 0 && batterId
                ? { [batterId]: stolenBasePlayerIds.length }
                : undefined
            }
          />
        </>
      )}
    </div>
  );
}
