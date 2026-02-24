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
  ContactQuality,
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
  { value: "sac_fly", label: "SF" },
  { value: "sac_bunt", label: "SH" },
  { value: "other", label: "Reached on Error" },
];

const RESULT_IS_OUT = new Set<PAResult>(["out", "so"]);
/** Results that add one out (used to advance outs/inning after save). */
const RESULT_ADDS_ONE_OUT = new Set<PAResult>(["out", "so", "sac_fly", "sac_bunt", "sac"]);

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
  "6-4-3",
  "4-6-3",
  "4-3",
  "6-3",
  "5-3",
  "3-1",
  "F7",
  "F8",
  "F9",
  "P3",
  "K",
  "1-3",
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
  p3: "P3",
  k: "K",
  "1-3": "1-3",
  ipo: "4-3",
  go: "4-3",
};

interface RecordPageClientProps {
  games: Game[];
  players: Player[];
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
  fetchPAsForGame,
  fetchGameLineupOrder,
  savePlateAppearance,
  deletePlateAppearance,
}: RecordPageClientProps) {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
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
  const [contactQuality, setContactQuality] = useState<ContactQuality | null>(null);
  const [chase, setChase] = useState<boolean | null>(null);
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

  const recentPlays = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (let i = allPAsForGame.length - 1; i >= 0 && out.length < 8; i--) {
      const part = (allPAsForGame[i].notes ?? "").split(" — ")[0].trim();
      if (part && !seen.has(part)) {
        seen.add(part);
        out.push(part);
      }
    }
    return out.reverse();
  })();

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
        contact_quality: contactQuality,
        chase,
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
      setContactQuality(null);
      setChase(null);
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

  const validationHints: string[] = [];
  if (pitcherHand === null && (result !== null || batterId)) {
    validationHints.push("Pitcher handedness is required.");
  }
  if (result && RESULT_IS_HIT.has(result) && baseState !== "000" && rbi === 0) {
    validationHints.push("Runners on base but RBI = 0.");
  }
  if (result && RESULT_IS_HIT.has(result) && contactQuality == null) {
    validationHints.push("Hit recorded — consider adding Contact.");
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
    <div className="space-y-6 pb-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          Record PAs
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Select a game, then log each plate appearance. Game state (inning, outs, bases) persists between PAs.
        </p>
      </header>

      <div className="card-tech rounded-lg border p-4">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Game
          </span>
          <select
            value={selectedGameId ?? ""}
            onChange={(e) => setSelectedGameId(e.target.value || null)}
            className="input-tech mt-1 block w-full max-w-md px-3 py-2"
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

          <div className="card-tech space-y-3 rounded-lg border p-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label>
                <span className="font-heading text-sm font-semibold text-[var(--text)]">Inning</span>
                <select
                  value={inning}
                  onChange={(e) => setInning(Number(e.target.value))}
                  className="input-tech mt-0.5 block w-full px-2 py-1.5 text-sm"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <div>
                <span className="font-heading text-sm font-semibold text-[var(--text)]">Half</span>
                <div className="mt-0.5 flex gap-1">
                  {(["top", "bottom"] as const).map((half) => (
                    <button
                      key={half}
                      type="button"
                      onClick={() => setInningHalf(inningHalf === half ? null : half)}
                      className={`cursor-pointer rounded border-2 px-2 py-1.5 text-xs font-medium capitalize transition duration-200 ${
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
              <label>
                <span className="font-heading text-sm font-semibold text-[var(--text)]">Outs</span>
                <div className="mt-0.5 flex gap-0.5">
                  {[0, 1, 2].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setOuts(n)}
                      className={`flex-1 cursor-pointer rounded border-2 py-1.5 text-sm font-semibold transition duration-200 ${
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
              <div>
                <span className="font-heading text-sm font-semibold text-[var(--text)]">Runners</span>
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
              </div>
            </div>
            <div>
              <span className="font-heading text-sm font-semibold text-[var(--text)]">Pitcher (required)</span>
              <div className="mt-0.5 flex gap-2">
                {(["L", "R"] as const).map((hand) => (
                  <button
                    key={hand}
                    type="button"
                    onClick={() => setPitcherHand(hand)}
                    className={`cursor-pointer rounded-full border-2 px-5 py-2.5 text-sm font-semibold transition duration-200 ${
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
              <div>
                <span className="font-heading text-sm font-semibold text-[var(--text)]">Count (B–S)</span>
                <div className="mt-0.5 flex items-center gap-2">
                  <label className="flex items-center gap-1 text-sm">
                    <span className="text-[var(--text-muted)]">B</span>
                    <select
                      value={countBalls}
                      onChange={(e) => setCountBalls(Number(e.target.value))}
                      className="input-tech w-14 px-1 py-1 text-sm"
                      aria-label="Balls"
                    >
                      {[0, 1, 2, 3].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <span className="text-[var(--text-muted)]">–</span>
                  <label className="flex items-center gap-1 text-sm">
                    <span className="text-[var(--text-muted)]">S</span>
                    <select
                      value={countStrikes}
                      onChange={(e) => setCountStrikes(Number(e.target.value))}
                      className="input-tech w-14 px-1 py-1 text-sm"
                      aria-label="Strikes"
                    >
                      {[0, 1, 2].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-heading text-sm font-semibold text-[var(--text)]">Batter</span>
                <div className="mt-0.5 flex gap-2">
                  <select
                    value={batterId ?? ""}
                    onChange={(e) => setBatterId(e.target.value || null)}
                    className="input-tech block w-full max-w-[16rem] px-2 py-1.5 text-sm"
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
                    className="cursor-pointer shrink-0 rounded border border-[var(--accent)]/40 bg-[var(--accent-dim)] px-3 py-1.5 text-sm font-medium text-[var(--accent)] transition duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Next batter in lineup"
                  >
                    Next
                  </button>
                </div>
                <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-[var(--text-muted)]">
                  <input
                    type="checkbox"
                    checked={autoAdvanceBatter}
                    onChange={(e) => setAutoAdvanceBatter(e.target.checked)}
                    className="rounded border-[var(--border)]"
                  />
                  Auto-advance to next batter after save
                </label>
              </div>
              <div>
                <span className="block font-heading text-sm font-semibold text-[var(--text)]">Result</span>
                <div className="mt-0.5 grid grid-cols-4 gap-1 sm:grid-cols-6">
                  {RESULT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setResult(opt.value)}
                      className={`cursor-pointer rounded-lg border-2 px-2 py-1.5 text-xs font-semibold transition duration-200 ${
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
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="cursor-pointer text-xs font-medium text-[var(--accent)] hover:underline"
              >
                {showDetails ? "− Hide details" : "+ Add details (RBI, contact, chase, notes)"}
              </button>
              {showDetails && (
                <div className="mt-2 grid gap-2 rounded border border-[var(--border)] bg-[var(--bg-elevated)] p-2 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <div>
                      <span className="font-heading text-sm font-semibold text-[var(--text)]">RBI</span>
                      <div className="mt-0.5 flex w-fit items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setRbi((n) => Math.max(0, n - 1))}
                          className="record-pa-stepper-btn flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded border border-[var(--accent)]/40 bg-[var(--accent-dim)] text-sm font-medium text-[var(--accent)] transition duration-200 hover:opacity-90 hover:border-[var(--accent)]/70"
                          aria-label="Decrease RBI"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={rbi}
                          onChange={(e) => setRbi(Number(e.target.value))}
                          className="input-tech input-no-spinner w-11 px-1 py-1.5 text-center text-sm"
                          aria-label="RBI"
                        />
                        <button
                          type="button"
                          onClick={() => setRbi((n) => n + 1)}
                          className="record-pa-stepper-btn flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded border border-[var(--accent)]/40 bg-[var(--accent-dim)] text-sm font-medium text-[var(--accent)] transition duration-200 hover:opacity-90 hover:border-[var(--accent)]/70"
                          aria-label="Increase RBI"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="font-heading text-sm font-semibold text-[var(--text)]">Pitches</span>
                      <div className="mt-0.5 flex w-fit items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setPitchesSeen((p) => (p === "" ? 0 : Math.max(0, p - 1)))
                          }
                          className="record-pa-stepper-btn flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded border border-[var(--accent)]/40 bg-[var(--accent-dim)] text-sm font-medium text-[var(--accent)] transition duration-200 hover:opacity-90 hover:border-[var(--accent)]/70"
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
                          className="input-tech input-no-spinner w-11 px-1 py-1.5 text-center text-sm"
                          aria-label="Pitches seen"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPitchesSeen((p) => (p === "" ? 1 : p + 1))
                          }
                          className="record-pa-stepper-btn flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded border border-[var(--accent)]/40 bg-[var(--accent-dim)] text-sm font-medium text-[var(--accent)] transition duration-200 hover:opacity-90 hover:border-[var(--accent)]/70"
                          aria-label="Increase pitches"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="font-heading text-sm font-semibold text-[var(--text)]">Stolen bases</span>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <select
                          value={stolenBaseAddId ?? ""}
                          onChange={(e) => setStolenBaseAddId(e.target.value || null)}
                          className="input-tech min-w-[10rem] px-2 py-1.5 text-sm"
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
                          className="cursor-pointer rounded border border-[var(--accent)]/40 bg-[var(--accent-dim)] px-3 py-1.5 text-sm font-medium text-[var(--accent)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                      {stolenBasePlayerIds.length > 0 && (
                        <>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
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
                                  className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[var(--accent)]/50 bg-[var(--accent)]/10 px-2.5 py-1 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--accent)]/20"
                                  aria-label={`Remove ${p?.name ?? "runner"} stolen base`}
                                >
                                  {p?.name ?? "?"}
                                  <span className="text-[var(--text-muted)]" aria-hidden>×</span>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div>
                      <span className="font-heading text-sm font-semibold text-[var(--text)]">Runs scored</span>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <select
                          value={runsScoredAddId ?? ""}
                          onChange={(e) => setRunsScoredAddId(e.target.value || null)}
                          className="input-tech min-w-[10rem] px-2 py-1.5 text-sm"
                          aria-label="Select runner who scored"
                        >
                          <option value="">Select runner who scored</option>
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
                          className="cursor-pointer rounded border border-[var(--accent)]/40 bg-[var(--accent-dim)] px-3 py-1.5 text-sm font-medium text-[var(--accent)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                      {runsScoredPlayerIds.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {runsScoredPlayerIds.map((id) => {
                            const p = players.find((x) => x.id === id);
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => setRunsScoredPlayerIds((ids) => ids.filter((i) => i !== id))}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[var(--accent)]/50 bg-[var(--accent)]/10 px-2.5 py-1 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--accent)]/20"
                                aria-label={`Remove ${p?.name ?? "scorer"}`}
                              >
                                {p?.name ?? "?"}
                                <span className="text-[var(--text-muted)]" aria-hidden>×</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="font-heading text-sm font-semibold text-[var(--text)]">Chase</span>
                      <div className="mt-0.5 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setChase(chase === true ? null : true)}
                          className={`cursor-pointer rounded-full border-2 px-3 py-1.5 text-xs font-medium transition duration-200 ${
                            chase === true
                              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)] hover:opacity-90"
                              : "border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
                          }`}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setChase(chase === false ? null : false)}
                          className={`cursor-pointer rounded-full border-2 px-3 py-1.5 text-xs font-medium transition duration-200 ${
                            chase === false
                              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)] hover:opacity-90"
                              : "border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
                          }`}
                        >
                          No
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="font-heading text-sm font-semibold text-[var(--text)]">Hit direction</span>
                      <div className="mt-0.5 flex flex-wrap gap-1.5">
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
                            className={`cursor-pointer rounded-full border-2 px-3 py-1.5 text-xs font-medium transition duration-200 ${
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
                    <div>
                      <span className="font-heading text-sm font-semibold text-[var(--text)]">Contact</span>
                      <div className="mt-0.5 flex flex-wrap gap-1.5">
                        {(["soft", "medium", "hard"] as const).map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setContactQuality(contactQuality === q ? null : q)}
                            className={`cursor-pointer rounded-full border-2 px-3 py-1.5 text-xs font-medium transition duration-200 ${
                              contactQuality === q
                                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)] hover:opacity-90"
                                : "border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
                            }`}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <span className="font-heading text-sm font-semibold text-[var(--text)]">Play</span>
                    <div className="flex flex-wrap gap-1">
                      {PLAY_PRESETS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPlayNote(playNote === p ? "" : p)}
                          className={`cursor-pointer rounded-full border-2 px-2.5 py-1 text-xs font-medium transition duration-200 ${
                            playNote === p
                              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)]"
                              : "border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:border-[var(--accent)]/50"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    {recentPlays.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-xs text-[var(--text-muted)]">Recent:</span>
                        {recentPlays.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPlayNote(playNote === p ? "" : p)}
                            className="cursor-pointer rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-0.5 text-xs text-[var(--text)] transition hover:border-[var(--accent)]/50"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
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
                      className="input-tech mt-0.5 block w-full px-2 py-1 text-sm"
                      placeholder="e.g. 6-4-3, F8 or type dp, f8, k…"
                      aria-label="Play description"
                    />
                  </div>
                  <label className="sm:col-span-2">
                    <span className="font-heading text-sm font-semibold text-[var(--text)]">Notes</span>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="input-tech mt-0.5 block w-full px-2 py-1 text-sm"
                      placeholder="Optional"
                    />
                  </label>
                </div>
              )}
            </div>

            {validationHints.length > 0 && (
              <p className="text-xs text-[var(--warning)]">
                {validationHints.join(" ")}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {lastPA && (
                <button
                  type="button"
                  onClick={handleUndoLastPA}
                  className="cursor-pointer rounded border border-[var(--border)] bg-transparent px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
                >
                  Undo last PA
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={!batterId || result === null || pitcherHand === null || saving}
                className="min-w-[8rem] flex-1 cursor-pointer rounded-lg bg-[var(--accent)] py-2 text-sm font-semibold text-[var(--bg-base)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none"
              >
                {saving ? "Saving…" : "Save PA"}
              </button>
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
