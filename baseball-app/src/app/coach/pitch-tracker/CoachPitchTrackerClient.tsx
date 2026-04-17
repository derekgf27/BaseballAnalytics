"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pitchTrackerRowsToSequenceEntries } from "@/lib/compute/pitchTrackerCount";
import { replayCountAtEndOfSequence } from "@/lib/compute/pitchSequence";
import { pitchingStatsFromPAs } from "@/lib/compute/pitchingStats";
import { isDemoId } from "@/lib/db/mockData";
import { formatDateMMDDYYYY, formatPPa } from "@/lib/format";
import { isGameFinalized } from "@/lib/gameRecord";
import {
  PITCH_TRACKER_TYPES,
  pitchTrackerAbbrev,
  pitchTrackerCoachButtonClass,
  pitchTrackerLogResultShortLabel,
  pitchTrackerTypeChipClass,
  pitchTrackerTypeLabel,
} from "@/lib/pitchTrackerUi";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  Game,
  PitchTrackerLogResult,
  PitchTrackerPitch,
  PitchTrackerPitchType,
  PlateAppearance,
} from "@/lib/types";

const COACH_PITCH_RESULT_OPTIONS: { value: PitchTrackerLogResult | null; label: string }[] = [
  { value: "ball", label: "Ball" },
  { value: "called_strike", label: "Called strike" },
  { value: "swinging_strike", label: "Whiff" },
  { value: "foul", label: "Foul" },
  { value: "in_play", label: "In play" },
  { value: null, label: "Later" },
];

type Props = {
  gameId?: string;
  groupId?: string;
  batterId?: string;
  pitcherId: string | null;
};

type TrackerSession = {
  gameId: string;
  groupId: string;
  /** Null until Record sets a batter; pitch buttons stay disabled until then. */
  batterId: string | null;
  pitcherId: string | null;
  outs: number;
  /** Mirrors Record PA count (0–3 each). */
  countBalls: number;
  countStrikes: number;
};

async function ensurePitchTrackerGroupOnGame(
  supabase: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,
  gameId: string
): Promise<string> {
  const { data: row, error: readErr } = await supabase
    .from("games")
    .select("pitch_tracker_group_id")
    .eq("id", gameId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  const existing = (row as { pitch_tracker_group_id?: string | null } | null)?.pitch_tracker_group_id;
  if (existing && existing.length > 0) return existing;
  const gid = crypto.randomUUID();
  const { error: upErr } = await supabase
    .from("games")
    .update({ pitch_tracker_group_id: gid })
    .eq("id", gameId);
  if (upErr) throw new Error(upErr.message);
  return gid;
}

function clampPitchTrackerOuts(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(2, Math.trunc(raw)));
}

function clampPitchTrackerCountHalf(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(3, Math.trunc(raw)));
}

/**
 * Same default as Analyst Record when there is no resume snapshot: away slot 1, else home slot 1.
 * Used when `games.pitch_tracker_batter_id` is still null (Record not open or batter not synced yet).
 */
async function fetchLeadoffBatterIdFromGameLineups(
  supabase: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,
  gameId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("game_lineups")
    .select("side, slot, player_id")
    .eq("game_id", gameId)
    .in("side", ["away", "home"]);
  if (error || !data?.length) return null;
  const rows = data as { side: string; slot: number; player_id: string }[];
  const slots: Record<"away" | "home", Map<number, string>> = {
    away: new Map(),
    home: new Map(),
  };
  for (const r of rows) {
    if (r.side !== "away" && r.side !== "home") continue;
    if (typeof r.slot !== "number" || r.slot < 1 || r.slot > 9) continue;
    if (!r.player_id || typeof r.player_id !== "string") continue;
    slots[r.side as "away" | "home"].set(r.slot, r.player_id);
  }
  const firstInSide = (side: "away" | "home") => {
    const m = slots[side];
    for (let s = 1; s <= 9; s++) {
      const id = m.get(s);
      if (id) return id;
    }
    return null;
  };
  return firstInSide("away") ?? firstInSide("home");
}

async function fetchPitchTrackerSyncFromGame(
  supabase: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,
  gameId: string
): Promise<{
  batterId: string | null;
  outs: number;
  pitcherId: string | null;
  countBalls: number;
  countStrikes: number;
}> {
  const { data, error } = await supabase
    .from("games")
    .select(
      "pitch_tracker_batter_id, pitch_tracker_outs, pitch_tracker_pitcher_id, pitch_tracker_balls, pitch_tracker_strikes"
    )
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as
    | {
        pitch_tracker_batter_id?: string | null;
        pitch_tracker_outs?: number | null;
        pitch_tracker_pitcher_id?: string | null;
        pitch_tracker_balls?: number | null;
        pitch_tracker_strikes?: number | null;
      }
    | null;
  const bid = row?.pitch_tracker_batter_id;
  let batterId = bid && typeof bid === "string" && bid.length > 0 ? bid : null;
  if (!batterId) {
    batterId = await fetchLeadoffBatterIdFromGameLineups(supabase, gameId);
  }
  const outs = clampPitchTrackerOuts(row?.pitch_tracker_outs ?? 0);
  const pidRaw = row?.pitch_tracker_pitcher_id;
  const pitcherId =
    pidRaw && typeof pidRaw === "string" && pidRaw.length > 0 ? pidRaw : null;
  const countBalls = clampPitchTrackerCountHalf(row?.pitch_tracker_balls ?? 0);
  const countStrikes = clampPitchTrackerCountHalf(row?.pitch_tracker_strikes ?? 0);
  return { batterId, outs, pitcherId, countBalls, countStrikes };
}

type CoachPitcherSnapshotUi = {
  name: string;
  line1: string;
  line2: string;
};

function CoachPitchPad({
  gameId,
  groupId,
  batterId,
  pitcherId,
  outs,
  countBalls,
  countStrikes,
}: TrackerSession) {
  const [rows, setRows] = useState<PitchTrackerPitch[]>([]);
  const [flashType, setFlashType] = useState<PitchTrackerPitchType | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pitchSnap, setPitchSnap] = useState<CoachPitcherSnapshotUi | null>(null);
  const [pitchSnapLoading, setPitchSnapLoading] = useState(false);
  const [pendingPitchType, setPendingPitchType] = useState<PitchTrackerPitchType | null>(null);

  const supabase = getSupabaseBrowserClient();
  const canLogPitch = !!(supabase && gameId && groupId && batterId);

  useEffect(() => {
    if (!canLogPitch) setPendingPitchType(null);
  }, [canLogPitch]);

  const refresh = useCallback(async () => {
    if (!supabase || !groupId) {
      setRows([]);
      return;
    }
    const { data, error: qErr } = await supabase
      .from("pitches")
      .select("*")
      .eq("tracker_group_id", groupId)
      .order("pitch_number", { ascending: true });
    if (qErr) {
      setError(qErr.message);
      setRows([]);
      return;
    }
    setError(null);
    setRows((data ?? []) as PitchTrackerPitch[]);
  }, [supabase, groupId]);

  const syncGameCountFromCoachPitches = useCallback(async () => {
    if (!supabase || !gameId || !groupId || isDemoId(gameId)) return;
    const { data: pitchRows, error: qErr } = await supabase
      .from("pitches")
      .select("pitch_number, result")
      .eq("tracker_group_id", groupId)
      .order("pitch_number", { ascending: true });
    if (qErr) return;
    const entries = pitchTrackerRowsToSequenceEntries(
      (pitchRows ?? []) as { pitch_number: number; result: PitchTrackerLogResult | null }[]
    );
    const end =
      entries.length === 0 ? { balls: 0, strikes: 0 } : replayCountAtEndOfSequence(entries);
    await supabase
      .from("games")
      .update({
        pitch_tracker_balls: clampPitchTrackerCountHalf(end.balls),
        pitch_tracker_strikes: clampPitchTrackerCountHalf(end.strikes),
      })
      .eq("id", gameId);
  }, [supabase, gameId, groupId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!supabase || !groupId) return;
    const channel = supabase
      .channel(`coach-pitches-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pitches",
          filter: `tracker_group_id=eq.${groupId}`,
        },
        () => {
          void refresh();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, groupId, refresh]);

  useEffect(() => {
    if (!flashType) return;
    const t = window.setTimeout(() => setFlashType(null), 220);
    return () => clearTimeout(t);
  }, [flashType]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const sequenceRows = useMemo(
    () => [...rows].sort((a, b) => a.pitch_number - b.pitch_number),
    [rows]
  );

  const loadPitcherSnapshot = useCallback(async () => {
    if (!supabase || !gameId) {
      setPitchSnap(null);
      return;
    }
    if (!pitcherId || isDemoId(gameId)) {
      setPitchSnap(null);
      return;
    }
    setPitchSnapLoading(true);
    try {
      const [{ data: playerRow }, { data: pasRows }] = await Promise.all([
        supabase.from("players").select("name").eq("id", pitcherId).maybeSingle(),
        supabase.from("plate_appearances").select("*").eq("game_id", gameId).eq("pitcher_id", pitcherId),
      ]);
      const name =
        playerRow && typeof (playerRow as { name?: string }).name === "string"
          ? (playerRow as { name: string }).name
          : "Pitcher";
      const pas = (pasRows ?? []) as PlateAppearance[];
      if (pas.length === 0) {
        setPitchSnap({
          name,
          line1: "No plate appearances logged to this pitcher in this game yet.",
          line2: "",
        });
        return;
      }
      const split = pitchingStatsFromPAs(pas, new Set(), new Map(), new Map(), {
        allPasForRunCharges: pas,
      });
      const s = split?.overall;
      if (!s) {
        setPitchSnap({ name, line1: "—", line2: "" });
        return;
      }
      const r = s.rates;
      const strikePctStr =
        r.strikePct != null ? `${Math.round(r.strikePct * 100)}% strikes` : "Strike% —";
      const pPaStr = r.pPa != null ? `${formatPPa(r.pPa)} P/PA` : "P/PA —";
      let pitchesTotal = 0;
      let paWithPitches = 0;
      for (const pa of pas) {
        const pv = pa.pitches_seen;
        if (pv != null && !Number.isNaN(pv) && pv >= 0) {
          pitchesTotal += pv;
          paWithPitches += 1;
        }
      }
      const pitchesStr =
        paWithPitches > 0
          ? `${pitchesTotal} pitches on ${paWithPitches} PA with counts`
          : "Pitch counts not on PAs yet — strike% / P/PA fill in when Record saves them.";
      const line1 = `${s.ipDisplay} IP · ${s.h} H · ${s.r} R · ${s.er} ER · ${s.bb} BB · ${s.so} K · ERA ${
        s.ip > 0 ? s.era.toFixed(2) : "—"
      } · WHIP ${s.ip > 0 ? s.whip.toFixed(2) : "—"}`;
      const line2 = `${pitchesStr} · ${strikePctStr} · ${pPaStr}`;
      setPitchSnap({ name, line1, line2 });
    } catch {
      setPitchSnap(null);
    } finally {
      setPitchSnapLoading(false);
    }
  }, [supabase, gameId, pitcherId]);

  useEffect(() => {
    void loadPitcherSnapshot();
  }, [loadPitcherSnapshot]);

  useEffect(() => {
    if (!supabase || !gameId || isDemoId(gameId)) return;
    const channel = supabase
      .channel(`coach-pitcher-pas-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "plate_appearances",
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          void loadPitcherSnapshot();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, gameId, loadPitcherSnapshot]);

  const commitPitch = async (pitch_type: PitchTrackerPitchType, result: PitchTrackerLogResult | null) => {
    if (!supabase || !gameId || !groupId || !batterId) return;
    setError(null);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(12);
      }
    } catch {
      /* ignore */
    }
    const maxNum = rows.length > 0 ? Math.max(...rows.map((r) => r.pitch_number)) : 0;
    const pitch_number = maxNum + 1;
    const { error: insErr } = await supabase.from("pitches").insert({
      game_id: gameId,
      at_bat_id: null,
      tracker_group_id: groupId,
      pitch_number,
      pitch_type,
      result,
      batter_id: batterId,
      pitcher_id: pitcherId,
    });
    if (insErr) {
      setError(insErr.message);
      return;
    }
    await syncGameCountFromCoachPitches();
    setPendingPitchType(null);
    setFlashType(pitch_type);
    const typeLabel = pitchTrackerTypeLabel(pitch_type);
    if (result == null) {
      setToast(`${typeLabel} — result later`);
    } else {
      setToast(`${typeLabel} · ${pitchTrackerLogResultShortLabel(result)}`);
    }
    void refresh();
  };

  const undoLast = async () => {
    if (!supabase || !groupId || rows.length === 0) return;
    const last = rows.reduce((a, b) => (a.pitch_number >= b.pitch_number ? a : b));
    const { error: delErr } = await supabase.from("pitches").delete().eq("id", last.id);
    if (delErr) setError(delErr.message);
    else {
      await syncGameCountFromCoachPitches();
      void refresh();
    }
  };

  const resetAtBat = async () => {
    if (!supabase || !groupId) return;
    setPendingPitchType(null);
    const { error: delErr } = await supabase.from("pitches").delete().eq("tracker_group_id", groupId);
    if (delErr) setError(delErr.message);
    else {
      await syncGameCountFromCoachPitches();
      void refresh();
    }
  };

  if (!supabase) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 px-4 text-center text-lg text-zinc-300">
        Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-zinc-950 text-zinc-100">
      <header className="shrink-0 border-b border-zinc-800 px-4 py-3 sm:px-6">
        <section className="min-w-0" aria-label="Pitcher this game">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Pitcher (this game)
          </p>
          {!pitcherId ? (
            <p className="mt-1 text-[11px] leading-snug text-zinc-500">
              Set the pitcher on Record (PA form mound pitcher).
            </p>
          ) : pitchSnapLoading ? (
            <p className="mt-1 text-xs text-zinc-500">Loading pitcher…</p>
          ) : pitchSnap ? (
            <div className="mt-1 min-w-0">
              <p className="truncate text-sm font-bold text-zinc-100 sm:text-base">{pitchSnap.name}</p>
              <p className="mt-1 text-[11px] leading-snug text-zinc-400">{pitchSnap.line1}</p>
              {pitchSnap.line2 ? (
                <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{pitchSnap.line2}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-zinc-500">Could not load pitcher stats.</p>
          )}
        </section>
        {toast ? (
          <p
            className="mt-2 shrink-0 rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-emerald-300 sm:mt-3"
            role="status"
          >
            {toast}
          </p>
        ) : null}
      </header>

      {error ? (
        <p className="shrink-0 bg-red-950/80 px-4 py-2 text-center text-sm text-red-200">{error}</p>
      ) : null}

      <main className="flex min-h-0 flex-1 flex-col gap-2 p-3 pb-[env(safe-area-inset-bottom)] sm:gap-3 sm:p-4 md:flex-row md:items-stretch">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 md:pr-1">
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5 auto-rows-fr sm:gap-2">
            {PITCH_TRACKER_TYPES.map((t) => {
              const flashed = flashType === t;
              const pendingHere = pendingPitchType === t;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={!canLogPitch}
                  onClick={() => setPendingPitchType(t)}
                  className={`flex min-h-[4.5rem] flex-col items-center justify-center rounded-lg border-2 py-2 text-xs font-bold uppercase tracking-wide shadow transition active:scale-[0.98] disabled:opacity-40 sm:min-h-[5rem] sm:text-sm ${pitchTrackerCoachButtonClass(t)} ${
                    flashed ? "ring-2 ring-white/80 ring-offset-1 ring-offset-zinc-950" : ""
                  } ${pendingHere ? "ring-2 ring-amber-300/90 ring-offset-1 ring-offset-zinc-950" : ""}`}
                >
                  <span className="px-1.5 text-center leading-tight">{pitchTrackerTypeLabel(t)}</span>
                </button>
              );
            })}
          </div>

          {pendingPitchType ? (
            <div className="shrink-0 rounded-lg border border-zinc-600 bg-zinc-900/90 p-2.5 sm:p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs leading-snug text-zinc-400">
                  Result for{" "}
                  <span className="font-semibold text-zinc-100">{pitchTrackerTypeLabel(pendingPitchType)}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setPendingPitchType(null)}
                  className="shrink-0 text-[11px] font-medium text-zinc-500 underline hover:text-zinc-300"
                >
                  Cancel
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {COACH_PITCH_RESULT_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => void commitPitch(pendingPitchType, opt.value)}
                    className="min-h-[42px] rounded-md border border-zinc-600 bg-zinc-800 px-2 py-2 text-[11px] font-semibold leading-tight text-zinc-100 active:bg-zinc-700 sm:text-xs"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex shrink-0 flex-wrap justify-center gap-2 pt-1">
            <button
              type="button"
              disabled={!supabase || !groupId || rows.length === 0}
              onClick={() => void undoLast()}
              className="min-h-[44px] min-w-[120px] rounded-lg border border-zinc-600 bg-zinc-900 px-4 text-sm font-semibold text-zinc-200 active:bg-zinc-800 disabled:opacity-35"
            >
              Undo last
            </button>
            <button
              type="button"
              disabled={!supabase || !groupId || rows.length === 0}
              onClick={() => void resetAtBat()}
              className="min-h-[44px] min-w-[120px] rounded-lg border border-amber-700/60 bg-amber-950/40 px-4 text-sm font-semibold text-amber-100 active:bg-amber-950/70 disabled:opacity-35"
            >
              Reset AB
            </button>
          </div>
        </div>

        <aside
          className="flex max-h-[min(52dvh,28rem)] min-h-0 w-full shrink-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 md:max-h-[calc(100dvh-8rem)] md:min-w-[13rem] md:w-[min(46vw,20rem)] md:max-w-[50%] md:self-stretch lg:min-w-[15rem] lg:w-[min(42vw,22rem)]"
          aria-label="This at-bat pitch sequence"
        >
          <div className="shrink-0 border-b border-zinc-800 px-3 py-2.5 sm:px-4 sm:py-3">
            <p className="text-sm text-zinc-400">
              Count{" "}
              <span className="font-mono text-lg font-bold text-white">
                {countBalls}-{countStrikes}
              </span>
              <span className="mx-2 text-zinc-600">·</span>
              <span className="text-zinc-300">{outs} out{outs === 1 ? "" : "s"}</span>
            </p>
          </div>
          <h2 className="shrink-0 border-b border-zinc-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:px-4 sm:py-2.5 sm:text-xs">
            This AB
          </h2>
          {sequenceRows.length === 0 ? (
            <p className="px-4 py-4 text-sm leading-snug text-zinc-500">
              No pitches yet — tap a pitch type, then Ball, Called strike, Whiff, or Foul (or Later).
            </p>
          ) : (
            <ol className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-3 py-3 sm:gap-2.5 sm:px-4 sm:py-4">
              {sequenceRows.map((r) => {
                const resultLabel = pitchTrackerLogResultShortLabel(r.result);
                return (
                  <li
                    key={r.id}
                    className="rounded-xl border border-zinc-700/80 bg-zinc-950/50 px-3 py-2.5 sm:px-3.5 sm:py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="tabular-nums text-xs font-semibold text-zinc-500 sm:text-sm">
                        #{r.pitch_number}
                      </span>
                      <span
                        className={`inline-flex min-w-[2.75rem] items-center justify-center rounded-md border px-2 py-1 text-sm font-bold sm:min-w-[3rem] sm:text-base ${pitchTrackerTypeChipClass(r.pitch_type)}`}
                        title={pitchTrackerTypeLabel(r.pitch_type)}
                      >
                        {pitchTrackerAbbrev(r.pitch_type)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold leading-tight text-zinc-200 sm:text-base">
                      {resultLabel}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </aside>
      </main>
    </div>
  );
}

function CoachPitchSessionLive({
  session,
  setSession,
}: {
  session: TrackerSession;
  setSession: Dispatch<SetStateAction<TrackerSession | null>>;
}) {
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!supabase) return;
    const gid = session.gameId;
    const channel = supabase
      .channel(`coach-game-batter-${gid}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${gid}`,
        },
        (payload) => {
          const row = payload.new as {
            pitch_tracker_batter_id?: string | null;
            pitch_tracker_outs?: number | null;
            pitch_tracker_pitcher_id?: string | null;
            pitch_tracker_balls?: number | null;
            pitch_tracker_strikes?: number | null;
          };
          const bid = row.pitch_tracker_batter_id;
          const po = row.pitch_tracker_outs;
          const pPitch = row.pitch_tracker_pitcher_id;
          const pb = row.pitch_tracker_balls;
          const ps = row.pitch_tracker_strikes;
          setSession((prev) => {
            if (!prev || prev.gameId !== gid) return prev;
            const next = { ...prev };
            if (Object.prototype.hasOwnProperty.call(row, "pitch_tracker_batter_id")) {
              next.batterId =
                bid && typeof bid === "string" && bid.length > 0 ? bid : null;
            }
            if (typeof po === "number" && Number.isFinite(po)) {
              next.outs = clampPitchTrackerOuts(po);
            }
            if (Object.prototype.hasOwnProperty.call(row, "pitch_tracker_pitcher_id")) {
              next.pitcherId =
                pPitch && typeof pPitch === "string" && pPitch.length > 0 ? pPitch : null;
            }
            if (typeof pb === "number" && Number.isFinite(pb)) {
              next.countBalls = clampPitchTrackerCountHalf(pb);
            }
            if (typeof ps === "number" && Number.isFinite(ps)) {
              next.countStrikes = clampPitchTrackerCountHalf(ps);
            }
            return next;
          });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, session.gameId, setSession]);

  return <CoachPitchPad {...session} />;
}

export default function CoachPitchTrackerClient({
  gameId: gameIdProp,
  groupId: groupIdProp,
  batterId: batterIdProp,
  pitcherId: pitcherIdProp,
}: Props) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [session, setSession] = useState<TrackerSession | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [pickGameId, setPickGameId] = useState("");

  useEffect(() => {
    if (!supabase) {
      setGames([]);
      setGamesLoading(false);
      return;
    }
    let cancelled = false;
    void supabase
      .from("games")
      .select("*")
      .order("date", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setGames([]);
          setGamesLoading(false);
          return;
        }
        const rows = (data ?? []) as Game[];
        setGames(rows.filter((g) => !isGameFinalized(g)));
        setGamesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (gameIdProp) setPickGameId(gameIdProp);
  }, [gameIdProp]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;

    async function resolve() {
      setResolveError(null);
      if (!gameIdProp) {
        if (!cancelled) setSession(null);
        return;
      }

      setResolving(true);
      try {
        const sync = await fetchPitchTrackerSyncFromGame(client, gameIdProp);
        const batterId: string | null = batterIdProp ?? sync.batterId;

        let groupId: string | null = groupIdProp ?? null;
        if (!groupId) {
          groupId = await ensurePitchTrackerGroupOnGame(client, gameIdProp);
        }

        const outs = sync.outs;
        const pitcherId = sync.pitcherId ?? pitcherIdProp;
        const countBalls = sync.countBalls;
        const countStrikes = sync.countStrikes;

        if (!cancelled) {
          setSession({
            gameId: gameIdProp,
            groupId,
            batterId,
            pitcherId,
            outs,
            countBalls,
            countStrikes,
          });
          const q = new URLSearchParams({
            gameId: gameIdProp,
            groupId,
          });
          router.replace(`/coach/pitch-tracker?${q.toString()}`);
        }
      } catch (e) {
        if (!cancelled) {
          setResolveError(e instanceof Error ? e.message : "Could not start session");
          setSession(null);
          setPickGameId(gameIdProp);
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [supabase, gameIdProp, groupIdProp, batterIdProp, pitcherIdProp, router]);

  const enterPitchPadForGame = useCallback(
    async (gameId: string) => {
      if (!supabase || !gameId) return;
      setResolveError(null);
      setResolving(true);
      try {
        const sync = await fetchPitchTrackerSyncFromGame(supabase, gameId);
        const groupId = await ensurePitchTrackerGroupOnGame(supabase, gameId);
        setSession({
          gameId,
          groupId,
          batterId: sync.batterId,
          pitcherId: sync.pitcherId,
          outs: sync.outs,
          countBalls: sync.countBalls,
          countStrikes: sync.countStrikes,
        });
        const q = new URLSearchParams({ gameId, groupId });
        router.replace(`/coach/pitch-tracker?${q.toString()}`);
      } catch (e) {
        setResolveError(e instanceof Error ? e.message : "Could not start session");
      } finally {
        setResolving(false);
      }
    },
    [supabase, router]
  );

  if (!supabase) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 px-4 text-center text-lg text-zinc-300">
        Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
      </div>
    );
  }

  if (resolving) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-zinc-950 px-4 text-center">
        <p className="text-zinc-300">Loading pitch pad…</p>
        {resolveError ? <p className="max-w-md text-sm text-red-300">{resolveError}</p> : null}
      </div>
    );
  }

  if (session) {
    return <CoachPitchSessionLive session={session} setSession={setSession} />;
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-zinc-950 px-4 py-8 text-zinc-100">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pitch pad</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Choose a game, then open the pad. Batter, count, and outs stay synced with the analyst Record screen on
            the pitch pad.
          </p>
        </div>

        {resolveError ? (
          <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {resolveError}
          </p>
        ) : null}

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Game
            </span>
            <select
              value={pickGameId}
              onChange={(e) => {
                const id = e.target.value;
                setPickGameId(id);
                if (id) void enterPitchPadForGame(id);
              }}
              disabled={gamesLoading}
              className="h-12 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-base text-zinc-100"
            >
              <option value="">{gamesLoading ? "Loading games…" : "Select game"}</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {formatDateMMDDYYYY(g.date)} — {g.away_team} @ {g.home_team}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={!pickGameId || resolving}
            onClick={() => pickGameId && void enterPitchPadForGame(pickGameId)}
            className="h-14 w-full rounded-xl bg-emerald-600 text-lg font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Open pitch pad
          </button>
        </div>

        <p className="text-center text-xs text-zinc-500">
          Short links only need <code className="text-zinc-400">gameId</code>.
        </p>

        <Link
          href="/coach"
          className="block text-center text-sm text-zinc-400 underline hover:text-zinc-200"
        >
          Back to coach home
        </Link>
      </div>
    </div>
  );
}
