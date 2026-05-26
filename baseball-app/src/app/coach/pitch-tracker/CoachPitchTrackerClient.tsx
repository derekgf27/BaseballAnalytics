"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  COACH_LIVE_AB_PA_ID,
  displayCountFromPitchTrackerRows,
  pitchEventsFromCoachTrackerRows,
  pitchTypeMixEventsFromCoachTrackerRows,
} from "@/lib/compute/pitchTrackerCount";
import {
  coachPitchPadBlocksNewPitchRow,
  countAfterPitch,
  replayCountAtEndOfSequence,
} from "@/lib/compute/pitchSequence";
import type { PitchSequenceEntry } from "@/lib/compute/pitchSequence";
import { pitchMixFromPlateAppearancesOrPitchLog } from "@/lib/compute/battingStats";
import { groupPitchEventsByPaId } from "@/lib/compute/contactProfileFromPas";
import { pitchingStatsFromPAs } from "@/lib/compute/pitchingStats";
import { isDemoId } from "@/lib/db/mockData";
import { formatDateMMDDYYYY } from "@/lib/format";
import { isGameFinalized } from "@/lib/gameRecord";
import { matchupLabelUsFirst } from "@/lib/opponentUtils";
import {
  PITCH_TRACKER_TYPES,
  pitchTrackerAbbrev,
  pitchTrackerCoachButtonClass,
  pitchTrackerLogResultShortLabel,
  pitchTrackerTypeChipClass,
  pitchTrackerTypeLabel,
} from "@/lib/pitchTrackerUi";
import {
  CurrentBatterPitchDataCard,
  lobByPitcherFromPas,
  MatchupPitchMixStrip,
} from "@/components/analyst/BattingPitchMixCard";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  Bats,
  Game,
  PitchEvent,
  PitchOutcome,
  PitchTrackerLogResult,
  PitchTrackerPitch,
  PitchTrackerPitchType,
  PlateAppearance,
} from "@/lib/types";

function coachLiveAbSyntheticPa(
  gameId: string,
  batterId: string,
  pitcherId: string | null
): PlateAppearance {
  return {
    id: COACH_LIVE_AB_PA_ID,
    game_id: gameId,
    batter_id: batterId,
    inning: 1,
    outs: 0,
    base_state: "000",
    score_diff: 0,
    count_balls: 0,
    count_strikes: 0,
    result: "other",
    contact_quality: null,
    hit_direction: null,
    batted_ball_type: null,
    pitches_seen: null,
    strikes_thrown: null,
    first_pitch_strike: null,
    rbi: 0,
    pitcher_hand: null,
    pitcher_id: pitcherId,
    notes: null,
    inning_half: "top",
  };
}

type CoachLineupBatterEntry = {
  slot: number;
  name: string;
  jersey: string | null;
  bats: Bats | null;
};

type CoachOpposingLineupRow = CoachLineupBatterEntry & { playerId: string };

type CoachBatterProfile = {
  name: string;
  jersey: string | null;
  bats: Bats | null;
};

function coerceBats(raw: unknown): Bats | null {
  if (raw === "L" || raw === "R" || raw === "S") return raw;
  return null;
}

function normalizeJersey(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  return t.length > 0 ? t : null;
}

function batsHandLabel(b: Bats | null): string {
  if (b === "L") return "L";
  if (b === "R") return "R";
  if (b === "S") return "S";
  return "—";
}

/** Bold, color-coded L/R/S so coaches spot platoon side quickly (letter only, no box). */
function batsHandChipClass(
  b: Bats | null,
  variant: "compact" | "prominent" = "prominent"
): string {
  const size =
    variant === "compact"
      ? "shrink-0 text-xs font-extrabold tabular-nums tracking-tight sm:text-[13px]"
      : "shrink-0 text-sm font-extrabold tabular-nums tracking-tight sm:text-base";
  if (b === "L") return `${size} text-rose-400`;
  if (b === "R") return `${size} text-sky-400`;
  if (b === "S") return `${size} text-violet-400`;
  return `${size} text-zinc-500`;
}

/** Lineup spot as ordinal so it reads differently from jersey `#n` (e.g. 2nd vs #2). */
function battingOrderOrdinal(spot: number): string {
  const n = Math.trunc(spot);
  if (!Number.isFinite(n) || n < 1) return String(spot);
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

/** Scale batter name down in the narrow lineup column so the full name stays visible (no ellipsis). */
function lineupBatterNameClass(name: string): string {
  const n = name.trim().length;
  const base = "min-w-0 font-semibold text-zinc-100";
  if (n <= 10) return `${base} text-sm leading-tight md:text-base`;
  if (n <= 14) return `${base} text-xs leading-tight md:text-sm`;
  if (n <= 18) return `${base} text-[11px] leading-tight md:text-xs`;
  if (n <= 22) return `${base} text-[10px] leading-tight md:text-[11px]`;
  if (n <= 28) return `${base} text-[9px] leading-tight md:text-[10px]`;
  return `${base} text-[9px] leading-snug break-words md:text-[10px]`;
}

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
  /** Batting-order 1–9 from Record lineup (`games.pitch_tracker_batter_slot`). */
  batterSlot: number | null;
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

function clampPitchTrackerBatterSlot(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const s = Math.trunc(raw);
  if (s < 1 || s > 9) return null;
  return s;
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
  trackerGroupId: string | null;
  batterId: string | null;
  batterSlot: number | null;
  outs: number;
  pitcherId: string | null;
  countBalls: number;
  countStrikes: number;
}> {
  const { data, error } = await supabase
    .from("games")
    .select(
      "pitch_tracker_group_id, pitch_tracker_batter_id, pitch_tracker_batter_slot, pitch_tracker_outs, pitch_tracker_pitcher_id, pitch_tracker_balls, pitch_tracker_strikes"
    )
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as
    | {
        pitch_tracker_group_id?: string | null;
        pitch_tracker_batter_id?: string | null;
        pitch_tracker_batter_slot?: number | null;
        pitch_tracker_outs?: number | null;
        pitch_tracker_pitcher_id?: string | null;
        pitch_tracker_balls?: number | null;
        pitch_tracker_strikes?: number | null;
      }
    | null;
  const gidRaw = row?.pitch_tracker_group_id;
  const trackerGroupId =
    gidRaw && typeof gidRaw === "string" && gidRaw.length > 0 ? gidRaw : null;
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
  const batterSlot = clampPitchTrackerBatterSlot(row?.pitch_tracker_batter_slot ?? null);
  return { trackerGroupId, batterId, batterSlot, outs, pitcherId, countBalls, countStrikes };
}

type CoachPitcherSnapshotUi = {
  name: string;
  jersey: string | null;
  line1: string;
};

const COACH_LANDSCAPE_TIP_KEY = "coach_pitch_pad_landscape_tip_v1";
/** Brief pause after a saved pitch so panic-tapping does not log multiple pitches. */
const COACH_PITCH_TYPE_COOLDOWN_MS = 400;

function isDuplicatePitchNumberError(message: string): boolean {
  return (
    message.includes("pitches_tracker_group_id_pitch_number_key") ||
    message.includes("duplicate key value violates unique constraint")
  );
}

function formatCoachPitchSaveError(message: string, offline: boolean): string {
  if (isDuplicatePitchNumberError(message)) {
    return "That pitch is already logged for this at-bat — check This AB. Wait a moment before tapping again.";
  }
  return message + (offline ? " You appear offline — reconnect and try again." : "");
}

/** Next pitch # in this tracker session (all rows in the group, not per batter). */
function nextOpenPitchNumber(rows: PitchTrackerPitch[]): number {
  const occupied = new Set(rows.map((r) => r.pitch_number));
  let n = 1;
  while (occupied.has(n)) n += 1;
  return n;
}

/** Count before → after this pitch (muted → amber), one-row sidebar. */
function CoachPitchCountTransition({
  beforeBalls,
  beforeStrikes,
  after,
}: {
  beforeBalls: number;
  beforeStrikes: number;
  after: { balls: number; strikes: number } | null;
}) {
  const tail = after == null ? "—" : `${after.balls}-${after.strikes}`;
  return (
    <span className="inline-flex shrink-0 items-center gap-x-1.5 rounded-md border border-amber-500/40 bg-zinc-950/80 px-2 py-1 tabular-nums leading-none md:gap-x-2 md:px-2.5 md:py-1.5">
      <span className="text-xs text-zinc-500 sm:text-sm">{beforeBalls}-{beforeStrikes}</span>
      <span className="text-xs text-zinc-500 sm:text-sm" aria-hidden>
        →
      </span>
      <span className="text-xs font-bold text-amber-400 sm:text-sm">{tail}</span>
    </span>
  );
}

function CoachPitchPad({
  gameId,
  groupId,
  batterId,
  batterSlot,
  pitcherId,
  outs,
  countBalls,
  countStrikes,
}: TrackerSession) {
  const [rows, setRows] = useState<PitchTrackerPitch[]>([]);
  const sequenceListRef = useRef<HTMLOListElement>(null);
  const [flashType, setFlashType] = useState<PitchTrackerPitchType | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pitchSnap, setPitchSnap] = useState<CoachPitcherSnapshotUi | null>(null);
  const [pitchSnapLoading, setPitchSnapLoading] = useState(false);
  const [batterProfile, setBatterProfile] = useState<CoachBatterProfile | null>(null);
  const [batterProfileLoading, setBatterProfileLoading] = useState(false);
  const [opponentLineupByPlayerId, setOpponentLineupByPlayerId] = useState<
    Record<string, CoachLineupBatterEntry>
  >({});
  /** `game_lineups.slot` (1–9) for both teams — batting order for anyone in the game lineup. */
  const [lineupBattingOrderByPlayerId, setLineupBattingOrderByPlayerId] = useState<
    Record<string, number>
  >({});
  const [opponentLineupLoading, setOpponentLineupLoading] = useState(false);
  /** Player ids on our lineup for this game; `null` while resolving (block pitch types until known). */
  const [ourLineupPlayerIds, setOurLineupPlayerIds] = useState<Set<string> | null>(null);
  /** Completed PAs in this game: this batter vs current mound pitcher (Record). */
  const [batterIntelPas, setBatterIntelPas] = useState<PlateAppearance[]>([]);
  const [batterIntelEvents, setBatterIntelEvents] = useState<PitchEvent[]>([]);
  const [batterIntelLoading, setBatterIntelLoading] = useState(false);
  /** All completed PAs in this game vs current mound pitcher (every opponent batter). */
  const [pitcherGamePas, setPitcherGamePas] = useState<PlateAppearance[]>([]);
  const [pitcherGameEvents, setPitcherGameEvents] = useState<PitchEvent[]>([]);
  const [pitcherGameIntelLoading, setPitcherGameIntelLoading] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(true);
  /** Pitches table realtime subscription — false while reconnecting / error. */
  const [pitchesRealtimeOk, setPitchesRealtimeOk] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [showLandscapeTip, setShowLandscapeTip] = useState(false);
  const [pitchLogBusy, setPitchLogBusy] = useState(false);
  const [pitchTypeCooldown, setPitchTypeCooldown] = useState(false);
  const pitchLogInFlightRef = useRef(false);
  const pitchCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supabase = getSupabaseBrowserClient();
  const canLogPitch = !!(supabase && gameId && groupId && batterId);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const sync = () => setNetworkOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(COACH_LANDSCAPE_TIP_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    const mq = window.matchMedia("(orientation: portrait)");
    const sync = () => {
      try {
        if (window.localStorage.getItem(COACH_LANDSCAPE_TIP_KEY) === "1") {
          setShowLandscapeTip(false);
          return;
        }
      } catch {
        /* ignore */
      }
      setShowLandscapeTip(mq.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /** Opponent = other dugout: `home` lineup if we are `away`, and vice versa. */
  const loadOpponentLineup = useCallback(async () => {
    if (!supabase || !gameId || isDemoId(gameId)) {
      setOpponentLineupByPlayerId({});
      setLineupBattingOrderByPlayerId({});
      setOurLineupPlayerIds(new Set());
      setOpponentLineupLoading(false);
      return;
    }
    setOpponentLineupLoading(true);
    setOurLineupPlayerIds(null);
    try {
      const { data: allLineupRows, error: allErr } = await supabase
        .from("game_lineups")
        .select("slot, player_id, side")
        .eq("game_id", gameId);
      const orderByPlayer: Record<string, number> = {};
      if (!allErr && allLineupRows?.length) {
        for (const r of allLineupRows as {
          slot: number | string;
          player_id: string;
          side?: string;
        }[]) {
          const slotNum = Number(r.slot);
          if (Number.isFinite(slotNum) && r.player_id) {
            orderByPlayer[r.player_id] = Math.trunc(slotNum);
          }
        }
      }
      setLineupBattingOrderByPlayerId(orderByPlayer);

      const { data: gameRow, error: gErr } = await supabase
        .from("games")
        .select("our_side")
        .eq("id", gameId)
        .maybeSingle();
      if (gErr || !gameRow) {
        setOpponentLineupByPlayerId({});
        setOurLineupPlayerIds(new Set());
        return;
      }
      const our = (gameRow as { our_side?: string }).our_side;
      if (our !== "home" && our !== "away") {
        setOpponentLineupByPlayerId({});
        setOurLineupPlayerIds(new Set());
        return;
      }
      const ourIds = new Set<string>();
      if (!allErr && allLineupRows?.length) {
        for (const r of allLineupRows as { player_id?: string; side?: string }[]) {
          if (r.side === our && r.player_id) ourIds.add(r.player_id);
        }
      }
      setOurLineupPlayerIds(ourIds);

      const oppSide = our === "home" ? "away" : "home";
      const { data: slots, error: sErr } = await supabase
        .from("game_lineups")
        .select("slot, player_id")
        .eq("game_id", gameId)
        .eq("side", oppSide)
        .order("slot", { ascending: true });
      if (sErr || !slots?.length) {
        setOpponentLineupByPlayerId({});
        return;
      }
      const list = slots as { slot: number; player_id: string }[];
      const ids = [...new Set(list.map((s) => s.player_id))];
      const { data: prows } = await supabase
        .from("players")
        .select("id, name, jersey, bats")
        .in("id", ids);
      const byPlayer: Record<string, CoachLineupBatterEntry> = {};
      for (const p of (prows ?? []) as {
        id: string;
        name: string;
        jersey?: string | null;
        bats?: unknown;
      }[]) {
        if (!p.name) continue;
        byPlayer[p.id] = {
          slot: 0,
          name: p.name,
          jersey: normalizeJersey(p.jersey ?? null),
          bats: coerceBats(p.bats),
        };
      }
      const byId: Record<string, CoachLineupBatterEntry> = {};
      for (const s of list) {
        const row = byPlayer[s.player_id];
        if (row && !byId[s.player_id]) {
          byId[s.player_id] = {
            slot: s.slot,
            name: row.name,
            jersey: row.jersey,
            bats: row.bats,
          };
        }
      }
      setOpponentLineupByPlayerId(byId);
    } finally {
      setOpponentLineupLoading(false);
    }
  }, [supabase, gameId]);

  useEffect(() => {
    void loadOpponentLineup();
  }, [loadOpponentLineup]);

  useEffect(() => {
    if (!supabase || !gameId || isDemoId(gameId)) return;
    const channel = supabase
      .channel(`coach-opp-lineup-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_lineups",
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          void loadOpponentLineup();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, gameId, loadOpponentLineup]);

  const loadBatterVsPitcherIntel = useCallback(async () => {
    if (!supabase || !gameId || isDemoId(gameId) || !batterId || !pitcherId) {
      setBatterIntelPas([]);
      setBatterIntelEvents([]);
      setBatterIntelLoading(false);
      return;
    }
    setBatterIntelLoading(true);
    try {
      const { data: pasRaw, error: pasErr } = await supabase
        .from("plate_appearances")
        .select("*")
        .eq("game_id", gameId)
        .eq("batter_id", batterId)
        .eq("pitcher_id", pitcherId)
        .order("inning", { ascending: true })
        .order("created_at", { ascending: true });
      if (pasErr) {
        setBatterIntelPas([]);
        setBatterIntelEvents([]);
        return;
      }
      const pas = (pasRaw ?? []) as PlateAppearance[];
      setBatterIntelPas(pas);
      const paIds = pas.map((p) => p.id).filter(Boolean);
      if (paIds.length === 0) {
        setBatterIntelEvents([]);
        return;
      }
      const chunk = 200;
      const allEvents: PitchEvent[] = [];
      for (let i = 0; i < paIds.length; i += chunk) {
        const ids = paIds.slice(i, i + chunk);
        const { data: evRows, error: evErr } = await supabase
          .from("pitch_events")
          .select("*")
          .in("pa_id", ids);
        if (evErr) {
          setBatterIntelEvents([]);
          return;
        }
        allEvents.push(...((evRows ?? []) as PitchEvent[]));
      }
      const order = new Map(paIds.map((id, idx) => [id, idx]));
      allEvents.sort((a, b) => {
        const oa = order.get(a.pa_id) ?? 0;
        const ob = order.get(b.pa_id) ?? 0;
        if (oa !== ob) return oa - ob;
        return a.pitch_index - b.pitch_index;
      });
      setBatterIntelEvents(allEvents);
    } finally {
      setBatterIntelLoading(false);
    }
  }, [supabase, gameId, batterId, pitcherId]);

  const loadPitcherGameIntel = useCallback(async () => {
    if (!supabase || !gameId || isDemoId(gameId) || !pitcherId) {
      setPitcherGamePas([]);
      setPitcherGameEvents([]);
      setPitcherGameIntelLoading(false);
      return;
    }
    setPitcherGameIntelLoading(true);
    try {
      const { data: pasRaw, error: pasErr } = await supabase
        .from("plate_appearances")
        .select("*")
        .eq("game_id", gameId)
        .eq("pitcher_id", pitcherId)
        .order("inning", { ascending: true })
        .order("created_at", { ascending: true });
      if (pasErr) {
        setPitcherGamePas([]);
        setPitcherGameEvents([]);
        return;
      }
      const pas = (pasRaw ?? []) as PlateAppearance[];
      setPitcherGamePas(pas);
      const paIds = pas.map((p) => p.id).filter(Boolean);
      if (paIds.length === 0) {
        setPitcherGameEvents([]);
        return;
      }
      const chunk = 200;
      const allEvents: PitchEvent[] = [];
      for (let i = 0; i < paIds.length; i += chunk) {
        const ids = paIds.slice(i, i + chunk);
        const { data: evRows, error: evErr } = await supabase
          .from("pitch_events")
          .select("*")
          .in("pa_id", ids);
        if (evErr) {
          setPitcherGameEvents([]);
          return;
        }
        allEvents.push(...((evRows ?? []) as PitchEvent[]));
      }
      const order = new Map(paIds.map((id, idx) => [id, idx]));
      allEvents.sort((a, b) => {
        const oa = order.get(a.pa_id) ?? 0;
        const ob = order.get(b.pa_id) ?? 0;
        if (oa !== ob) return oa - ob;
        return a.pitch_index - b.pitch_index;
      });
      setPitcherGameEvents(allEvents);
    } finally {
      setPitcherGameIntelLoading(false);
    }
  }, [supabase, gameId, pitcherId]);

  useEffect(() => {
    void loadBatterVsPitcherIntel();
  }, [loadBatterVsPitcherIntel]);

  useEffect(() => {
    void loadPitcherGameIntel();
  }, [loadPitcherGameIntel]);

  useEffect(() => {
    if (!supabase || !gameId || isDemoId(gameId)) return;
    const channel = supabase
      .channel(`coach-batter-intel-pas-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "plate_appearances",
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          void loadBatterVsPitcherIntel();
          void loadPitcherGameIntel();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, gameId, loadBatterVsPitcherIntel, loadPitcherGameIntel]);

  useEffect(() => {
    if (!supabase || !batterId) {
      setBatterProfile(null);
      setBatterProfileLoading(false);
      return;
    }
    let cancelled = false;
    setBatterProfileLoading(true);
    void supabase
      .from("players")
      .select("name, jersey, bats")
      .eq("id", batterId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setBatterProfileLoading(false);
        if (error || !data) {
          setBatterProfile(null);
          return;
        }
        const row = data as { name?: string; jersey?: string | null; bats?: unknown };
        const n = row.name;
        if (typeof n !== "string" || n.length === 0) {
          setBatterProfile(null);
          return;
        }
        setBatterProfile({
          name: n,
          jersey: normalizeJersey(row.jersey ?? null),
          bats: coerceBats(row.bats),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, batterId]);

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
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setPitchesRealtimeOk(true);
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setPitchesRealtimeOk(false);
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, groupId, refresh]);

  /** Record undo / pitch log updates `games.pitch_tracker_*` — refetch pitches when count changes. */
  const prevTrackerCountRef = useRef({ balls: countBalls, strikes: countStrikes });
  useEffect(() => {
    const prev = prevTrackerCountRef.current;
    if (prev.balls === countBalls && prev.strikes === countStrikes) return;
    prevTrackerCountRef.current = { balls: countBalls, strikes: countStrikes };
    void refresh();
  }, [countBalls, countStrikes, refresh]);

  useEffect(() => {
    void refresh();
  }, [batterId, refresh]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  useEffect(() => {
    if (!groupId || pitchesRealtimeOk) return;
    const id = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(id);
  }, [groupId, pitchesRealtimeOk, refresh]);

  useEffect(() => {
    if (!flashType) return;
    const ms = prefersReducedMotion ? 40 : 220;
    const t = window.setTimeout(() => setFlashType(null), ms);
    return () => clearTimeout(t);
  }, [flashType, prefersReducedMotion]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const sequenceRows = useMemo(
    () => [...rows].sort((a, b) => a.pitch_number - b.pitch_number),
    [rows]
  );

  const sequenceRowsThisBatter = useMemo(() => {
    if (!batterId) return [];
    return sequenceRows.filter((r) => r.batter_id === batterId);
  }, [sequenceRows, batterId]);

  const lastPitchRowId =
    sequenceRowsThisBatter.length > 0
      ? (sequenceRowsThisBatter[sequenceRowsThisBatter.length - 1]?.id ?? null)
      : null;

  useEffect(() => {
    const list = sequenceListRef.current;
    if (!list || !lastPitchRowId) return;
    const scrollToLatest = () => {
      list.scrollTop = list.scrollHeight;
    };
    scrollToLatest();
    requestAnimationFrame(scrollToLatest);
  }, [lastPitchRowId, sequenceRowsThisBatter.length]);

  const batterMissingFromOpposingLineup = useMemo(() => {
    if (!batterId || opponentLineupLoading) return false;
    if (Object.keys(opponentLineupByPlayerId).length === 0) return false;
    return opponentLineupByPlayerId[batterId] == null;
  }, [batterId, opponentLineupLoading, opponentLineupByPlayerId]);

  const logDerivedCount = useMemo(
    () => displayCountFromPitchTrackerRows(sequenceRowsThisBatter),
    [sequenceRowsThisBatter]
  );
  const hasResolvedPitchThisAb = useMemo(
    () => sequenceRowsThisBatter.some((r) => r.result != null),
    [sequenceRowsThisBatter]
  );
  const headerCountBalls = hasResolvedPitchThisAb ? logDerivedCount.balls : countBalls;
  const headerCountStrikes = hasResolvedPitchThisAb ? logDerivedCount.strikes : countStrikes;

  const livePitchEventsForCard = useMemo(
    () => pitchEventsFromCoachTrackerRows(COACH_LIVE_AB_PA_ID, sequenceRowsThisBatter),
    [sequenceRowsThisBatter]
  );
  /** Coach rows with `pitch_type` before `result` (mix / header distribution). */
  const livePitchTypeMixEvents = useMemo(
    () => pitchTypeMixEventsFromCoachTrackerRows(COACH_LIVE_AB_PA_ID, sequenceRowsThisBatter),
    [sequenceRowsThisBatter]
  );
  const liveSyntheticPaForCard = useMemo((): PlateAppearance | null => {
    if (!gameId || !batterId) return null;
    const hasTrackerActivity =
      livePitchEventsForCard.length > 0 ||
      sequenceRowsThisBatter.some((r) => r.pitch_type != null);
    if (!hasTrackerActivity) return null;
    return coachLiveAbSyntheticPa(gameId, batterId, pitcherId);
  }, [gameId, batterId, pitcherId, livePitchEventsForCard.length, sequenceRowsThisBatter]);

  const matchupPasMerged = useMemo(() => {
    if (!liveSyntheticPaForCard) return batterIntelPas;
    return [...batterIntelPas, liveSyntheticPaForCard];
  }, [batterIntelPas, liveSyntheticPaForCard]);
  const matchupEventsMerged = useMemo(
    () => [...batterIntelEvents, ...livePitchEventsForCard],
    [batterIntelEvents, livePitchEventsForCard]
  );
  /** Batter card “Mix”: include coach-typed pitches before Record sets `result`. */
  const matchupDistributionEventsMerged = useMemo(
    () => [...batterIntelEvents, ...livePitchTypeMixEvents],
    [batterIntelEvents, livePitchTypeMixEvents]
  );

  /** Header RATES / CONTACT / 2-strike strip: full game vs this pitcher + in-progress AB. */
  const gamePitchMixPasMerged = useMemo(() => {
    if (!liveSyntheticPaForCard) return pitcherGamePas;
    return [...pitcherGamePas, liveSyntheticPaForCard];
  }, [pitcherGamePas, liveSyntheticPaForCard]);
  const gamePitchMixEventsMerged = useMemo(
    () => [...pitcherGameEvents, ...livePitchEventsForCard],
    [pitcherGameEvents, livePitchEventsForCard]
  );

  const gamePitchMixDistributionEventsMerged = useMemo(
    () => [...pitcherGameEvents, ...livePitchTypeMixEvents],
    [pitcherGameEvents, livePitchTypeMixEvents]
  );

  const pitcherFullGameMix = useMemo(() => {
    if (!pitcherId) return null;
    const pitcherPas = gamePitchMixPasMerged.filter((p) => p.pitcher_id === pitcherId);
    if (pitcherPas.length === 0) return null;
    const eventsByPaId = groupPitchEventsByPaId(gamePitchMixEventsMerged);
    return pitchMixFromPlateAppearancesOrPitchLog(pitcherPas, eventsByPaId);
  }, [pitcherId, gamePitchMixPasMerged, gamePitchMixEventsMerged]);

  const lineupGuardLoading = ourLineupPlayerIds === null;
  const isOurTeamBatting = !!(batterId && ourLineupPlayerIds && ourLineupPlayerIds.has(batterId));

  const opposingLineupBoard = useMemo(() => {
    const ordered: CoachOpposingLineupRow[] = Object.entries(opponentLineupByPlayerId)
      .map(([playerId, e]) => ({ ...e, playerId }))
      .sort((a, b) => a.slot - b.slot);
    let onDeckPlayerId: string | null = null;
    if (ordered.length > 0) {
      if (batterId) {
        const atIdx = ordered.findIndex((r) => r.playerId === batterId);
        if (atIdx >= 0) {
          onDeckPlayerId = ordered[(atIdx + 1) % ordered.length]?.playerId ?? null;
        }
      }
      if (onDeckPlayerId == null && batterSlot != null) {
        const atIdx = ordered.findIndex((r) => r.slot === batterSlot);
        if (atIdx >= 0) {
          onDeckPlayerId = ordered[(atIdx + 1) % ordered.length]?.playerId ?? null;
        }
      }
    }
    return { ordered, onDeckPlayerId };
  }, [opponentLineupByPlayerId, batterId, batterSlot]);

  const batterIntelDisplayName = useMemo(() => {
    if (!batterId) return "Batter";
    return (
      batterProfile?.name ??
      opponentLineupByPlayerId[batterId]?.name ??
      "Batter"
    );
  }, [batterId, batterProfile, opponentLineupByPlayerId]);

  const pitchTypeBlockReason = useMemo(
    () => coachPitchPadBlocksNewPitchRow(sequenceRowsThisBatter),
    [sequenceRowsThisBatter]
  );
  const pitchTypesLocked = pitchTypeBlockReason != null;
  /** Pitch-type pad is only for when we're on defense (opponent batting). */
  const pitchDefenseOnlyBlocked = lineupGuardLoading || isOurTeamBatting;
  const canLogPitchType = canLogPitch && !pitchTypesLocked && !pitchDefenseOnlyBlocked;
  const pitchDockLocked = pitchLogBusy || pitchTypeCooldown;

  useEffect(() => {
    return () => {
      if (pitchCooldownTimerRef.current != null) clearTimeout(pitchCooldownTimerRef.current);
    };
  }, []);

  const startPitchTypeCooldown = useCallback(() => {
    if (prefersReducedMotion) return;
    setPitchTypeCooldown(true);
    if (pitchCooldownTimerRef.current != null) clearTimeout(pitchCooldownTimerRef.current);
    pitchCooldownTimerRef.current = setTimeout(() => {
      setPitchTypeCooldown(false);
      pitchCooldownTimerRef.current = null;
    }, COACH_PITCH_TYPE_COOLDOWN_MS);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (pitchTypesLocked) return;
    setError((e) => (e != null && e.startsWith("This AB already") ? null : e));
  }, [pitchTypesLocked]);

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
        supabase.from("players").select("name, jersey").eq("id", pitcherId).maybeSingle(),
        supabase.from("plate_appearances").select("*").eq("game_id", gameId).eq("pitcher_id", pitcherId),
      ]);
      const row = playerRow as { name?: string; jersey?: string | null } | null;
      const name = row && typeof row.name === "string" ? row.name : "Pitcher";
      const jersey = normalizeJersey(row?.jersey ?? null);
      const pas = (pasRows ?? []) as PlateAppearance[];
      if (pas.length === 0) {
        setPitchSnap({
          name,
          jersey,
          line1: "No plate appearances logged to this pitcher in this game yet.",
        });
        return;
      }
      const split = pitchingStatsFromPAs(pas, new Set(), new Map(), new Map(), {
        allPasForRunCharges: pas,
      });
      const s = split?.overall;
      if (!s) {
        setPitchSnap({ name, jersey, line1: "—" });
        return;
      }
      const lob = lobByPitcherFromPas(pas).get(pitcherId) ?? 0;
      const line1 = `${s.ipDisplay} IP · ${s.h} H · ${s.r} R · ${s.er} ER · ${s.bb} BB · ${s.so} K · ERA ${
        s.ip > 0 ? s.era.toFixed(2) : "—"
      } · WHIP ${s.ip > 0 ? s.whip.toFixed(2) : "—"} · LOB ${lob}`;
      setPitchSnap({ name, jersey, line1 });
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

  /** Pitch type only — ball/strike outcomes live on the analyst PA form. Fills first typeless row if Record created it. */
  const logPitch = async (pitch_type: PitchTrackerPitchType) => {
    if (!supabase || !gameId || !groupId || !batterId) return;
    if (pitchDefenseOnlyBlocked || pitchLogInFlightRef.current || pitchDockLocked) return;

    pitchLogInFlightRef.current = true;
    setPitchLogBusy(true);

    const offline =
      typeof navigator !== "undefined" && !navigator.onLine;
    const batterRows = rows.filter((r) => r.batter_id === batterId);
    const sortedBatterRows = [...batterRows].sort((a, b) => a.pitch_number - b.pitch_number);
    const awaitingType = sortedBatterRows.filter((r) => r.pitch_type == null)[0] ?? null;

    try {
      if (!awaitingType) {
        const block = coachPitchPadBlocksNewPitchRow(sortedBatterRows);
        if (block === "strikes") {
          setError("This AB already has 3 strikes — finish the PA in Record, or Undo / Reset AB.");
          return;
        }
        if (block === "balls") {
          setError("This AB already has 4 balls — finish the PA in Record, or Undo / Reset AB.");
          return;
        }
      }

      setError(null);
      try {
        if (
          typeof navigator !== "undefined" &&
          typeof navigator.vibrate === "function" &&
          !prefersReducedMotion
        ) {
          navigator.vibrate(12);
        }
      } catch {
        /* ignore */
      }

      const applyTypeToRow = async (rowId: string) => {
        const { error: upErr } = await supabase
          .from("pitches")
          .update({ pitch_type, pitcher_id: pitcherId })
          .eq("id", rowId);
        if (upErr) {
          setError(formatCoachPitchSaveError(upErr.message, offline));
          return false;
        }
        return true;
      };

      if (awaitingType) {
        const ok = await applyTypeToRow(awaitingType.id);
        if (!ok) return;
      } else {
        const pitch_number = nextOpenPitchNumber(sequenceRows);
        const localSlot = sequenceRows.find((r) => r.pitch_number === pitch_number);

        if (localSlot != null && localSlot.pitch_type == null) {
          const ok = await applyTypeToRow(localSlot.id);
          if (!ok) return;
        } else if (localSlot == null) {
          const { error: insErr } = await supabase.from("pitches").insert({
            game_id: gameId,
            at_bat_id: null,
            tracker_group_id: groupId,
            pitch_number,
            pitch_type,
            result: null,
            batter_id: batterId,
            pitcher_id: pitcherId,
          });

          if (insErr) {
            if (isDuplicatePitchNumberError(insErr.message)) {
              const { data: existing, error: readErr } = await supabase
                .from("pitches")
                .select("id, pitch_type, batter_id")
                .eq("tracker_group_id", groupId)
                .eq("pitch_number", pitch_number)
                .maybeSingle();

              if (readErr) {
                setError(formatCoachPitchSaveError(readErr.message, offline));
                return;
              }

              const row = existing as {
                id: string;
                pitch_type: PitchTrackerPitchType | null;
                batter_id: string;
              } | null;

              if (row && row.batter_id === batterId) {
                if (row.pitch_type == null) {
                  const ok = await applyTypeToRow(row.id);
                  if (!ok) return;
                } else {
                  setError(
                    "That pitch already has a type — check This AB or use Undo if it was a mistake."
                  );
                  return;
                }
              } else {
                setError(formatCoachPitchSaveError(insErr.message, offline));
                await refresh();
                return;
              }
            } else {
              setError(formatCoachPitchSaveError(insErr.message, offline));
              return;
            }
          }
        } else {
          setError(
            "That pitch already has a type — check This AB or use Undo if it was a mistake."
          );
          return;
        }
      }

      setFlashType(pitch_type);
      await refresh();
      startPitchTypeCooldown();
    } finally {
      pitchLogInFlightRef.current = false;
      setPitchLogBusy(false);
    }
  };

  const undoLast = async () => {
    if (pitchLogInFlightRef.current || pitchLogBusy) return;
    const pool = batterId ? rows.filter((r) => r.batter_id === batterId) : rows;
    if (!supabase || !groupId || pool.length === 0) return;

    pitchLogInFlightRef.current = true;
    setPitchLogBusy(true);
    try {
      const last = pool.reduce((a, b) => (a.pitch_number >= b.pitch_number ? a : b));
      const removedLabel =
        last.pitch_type != null ? pitchTrackerTypeLabel(last.pitch_type) : "last pitch";
      const { error: delErr } = await supabase.from("pitches").delete().eq("id", last.id);
      if (delErr) setError(delErr.message);
      else {
        setToast(`Removed · ${removedLabel}`);
        await refresh();
      }
    } finally {
      pitchLogInFlightRef.current = false;
      setPitchLogBusy(false);
    }
  };

  const resetAtBat = async () => {
    if (pitchLogInFlightRef.current || pitchLogBusy) return;
    if (!supabase || !groupId) return;
    if (
      !window.confirm(
        "Clear all pitches logged for this batter in this at-bat? This cannot be undone."
      )
    ) {
      return;
    }

    pitchLogInFlightRef.current = true;
    setPitchLogBusy(true);
    try {
      let q = supabase.from("pitches").delete().eq("tracker_group_id", groupId);
      if (batterId) q = q.eq("batter_id", batterId);
      const { error: delErr } = await q;
      if (delErr) setError(delErr.message);
      else {
        setToast("At-bat sequence cleared");
        await refresh();
      }
    } finally {
      pitchLogInFlightRef.current = false;
      setPitchLogBusy(false);
    }
  };

  const renderPitchTypeButton = (t: PitchTrackerPitchType) => {
    const flashed = flashType === t;
    const label = pitchTrackerTypeLabel(t);
    const motionSafe = prefersReducedMotion;
    const disabled = !canLogPitchType || pitchDockLocked;
    return (
      <button
        key={t}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-busy={pitchLogBusy ? true : undefined}
        title={
          pitchLogBusy
            ? "Saving…"
            : pitchTypeCooldown
              ? "Wait a moment before the next pitch"
              : label
        }
        onClick={() => void logPitch(t)}
        className={`touch-manipulation flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-full border-2 shadow transition-none active:scale-100 sm:h-14 sm:w-14 sm:transition sm:active:scale-[0.98] disabled:opacity-40 md:h-[3.75rem] md:w-[3.75rem] ${pitchTrackerCoachButtonClass(t)} ${
          flashed && !motionSafe
            ? "ring-2 ring-white/80 ring-offset-2 ring-offset-zinc-950 sm:ring-offset-2"
            : flashed && motionSafe
              ? "brightness-110"
              : ""
        }`}
      >
        <span className="text-xs font-bold leading-none tracking-tight sm:text-sm">
          {pitchTrackerAbbrev(t)}
        </span>
      </button>
    );
  };

  if (!supabase) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 px-4 text-center text-lg text-zinc-300">
        Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
      </div>
    );
  }

  return (
    <div className="coach-pitch-pad flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      {toast ? (
        <p
          className="shrink-0 border-b border-emerald-900/50 bg-emerald-950/90 px-3 py-2 text-center text-sm font-medium text-emerald-200"
          role="status"
        >
          {toast}
        </p>
      ) : null}

      {error ? (
        <p className="shrink-0 bg-red-950/80 px-4 py-2 text-center text-sm text-red-200">{error}</p>
      ) : null}

      {!networkOnline ? (
        <p className="shrink-0 border-b border-amber-900/40 bg-amber-950/95 px-4 py-2 text-center text-sm font-medium text-amber-100" role="status">
          Offline — logging may fail until you&apos;re back on Wi‑Fi or cellular. What you tap might not save.
        </p>
      ) : null}

      {networkOnline && !pitchesRealtimeOk ? (
        <p className="shrink-0 border-b border-zinc-700 bg-zinc-800/95 px-4 py-2 text-center text-sm leading-snug text-zinc-200" role="status">
          Live pitch sync paused — check connectivity or keep Record open; this pad will retry every few seconds. You can still use Undo / Reset on this device.
        </p>
      ) : null}

      {batterMissingFromOpposingLineup ? (
        <p
          className="shrink-0 border-b border-sky-800 bg-sky-950/80 px-4 py-2 text-center text-sm leading-snug text-sky-100"
          role="status"
        >
          Sync note — Record&apos;s batter isn&apos;t on the opposing lineup card. Confirm the correct dugout / lineup on Record before trusting OD markers here.
        </p>
      ) : null}

      {showLandscapeTip ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-emerald-900/50 bg-emerald-950/85 px-3 py-2 text-emerald-50">
          <p className="min-w-0 flex-1 text-xs leading-snug sm:text-sm">
            This pitch pad is laid out for <strong className="font-semibold">iPad landscape</strong> — rotate for the widest matchup + sequence columns.
          </p>
          <button
            type="button"
            className="touch-manipulation shrink-0 rounded-md border border-emerald-600/60 bg-emerald-900/50 px-3 py-1.5 text-xs font-semibold text-emerald-100 active:bg-emerald-900/80"
            onClick={() => {
              try {
                window.localStorage.setItem(COACH_LANDSCAPE_TIP_KEY, "1");
              } catch {
                /* ignore */
              }
              setShowLandscapeTip(false);
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row md:gap-3 md:p-3">
        {/* Line-up: first = easy to scan; fixed width on tablet landscape */}
        <section
          className="flex max-h-[38vh] min-h-0 shrink-0 flex-col overflow-hidden border-b border-zinc-800 px-2 py-2 md:max-h-none md:w-[min(15.25rem,27vw)] md:shrink-0 md:self-stretch md:rounded-xl md:border md:border-zinc-700/80 md:bg-zinc-900/50 md:px-2 md:py-2"
          aria-label="Opposing lineup"
        >
          <div className="mb-1.5 flex items-baseline justify-between gap-1">
            <h2 className="text-[10px] font-bold uppercase tracking-wide text-amber-400/90 sm:text-xs">
              Opposing lineup
            </h2>
            <span className="shrink-0 text-[9px] text-zinc-500 sm:text-[10px]">AB / OD</span>
          </div>
          {opponentLineupLoading ? (
            <p className="text-xs text-zinc-500">Loading…</p>
          ) : opposingLineupBoard.ordered.length === 0 ? (
            <p className="text-xs text-zinc-500">Set the lineup on Record.</p>
          ) : (
            <ul className="grid min-h-0 flex-1 grid-cols-2 gap-x-1 gap-y-1.5 overflow-y-auto overscroll-contain sm:gap-x-1.5 sm:gap-y-2 md:flex md:flex-col md:gap-1.5">
              {opposingLineupBoard.ordered.map((row) => {
                const atBat = !!(batterId && row.playerId === batterId);
                const onDeck =
                  !atBat &&
                  opposingLineupBoard.onDeckPlayerId != null &&
                  row.playerId === opposingLineupBoard.onDeckPlayerId;
                const jerseyStr = row.jersey != null ? `#${row.jersey}` : "—";
                return (
                  <li
                    key={row.playerId}
                    className={`flex min-h-0 min-w-0 items-center gap-2 rounded-lg border px-1.5 py-1.5 text-sm md:flex-1 md:gap-2.5 md:px-2.5 md:py-2 md:text-base ${
                      atBat
                        ? "border-amber-500/60 bg-amber-950/55 ring-1 ring-amber-500/30"
                        : onDeck
                          ? "border-zinc-500/50 bg-zinc-800/90"
                          : "border-zinc-700/50 bg-zinc-900/70"
                    }`}
                  >
                    <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-amber-400 md:w-8 md:text-base">
                      {battingOrderOrdinal(row.slot)}
                    </span>
                    <div className="min-w-0 flex-1 leading-snug md:leading-normal">
                      <p className={lineupBatterNameClass(row.name)} title={row.name}>
                        {row.name}
                      </p>
                      <p className="truncate text-xs text-zinc-400 md:text-sm">
                        {jerseyStr}{" "}
                        <span className={batsHandChipClass(row.bats, "compact")}>{batsHandLabel(row.bats)}</span>
                      </p>
                    </div>
                    <div className="shrink-0">
                      {atBat ? (
                        <span className="rounded-md bg-amber-600/40 px-1 py-0.5 text-[10px] font-bold uppercase leading-none text-amber-100 md:px-1.5 md:py-1 md:text-xs">
                          AB
                        </span>
                      ) : onDeck ? (
                        <span className="rounded-md bg-zinc-600 px-1 py-0.5 text-[10px] font-bold uppercase leading-none text-zinc-200 md:px-1.5 md:py-1 md:text-xs">
                          OD
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Center: primary coaching focus */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden p-2 pb-1 md:p-0 md:pb-0">
          {lineupGuardLoading ? (
            <p
              className="shrink-0 rounded-lg border border-sky-700/50 bg-sky-950/30 px-3 py-2 text-center text-sm leading-snug text-sky-100/95"
              role="status"
            >
              Loading lineups… Pitch-type buttons stay off until we know who is at bat.
            </p>
          ) : null}
          {!lineupGuardLoading && isOurTeamBatting ? (
            <p
              className="shrink-0 rounded-lg border border-zinc-600/60 bg-zinc-900/80 px-3 py-2 text-center text-sm leading-snug text-zinc-200"
              role="status"
            >
              We&apos;re hitting — pitch-type tracking is only when we&apos;re on defense. Log balls and strikes on
              Record for this PA.
            </p>
          ) : null}
          {pitchTypesLocked && !pitchDefenseOnlyBlocked ? (
            <p
              className="shrink-0 rounded-lg border border-amber-600/50 bg-amber-950/35 px-3 py-2 text-center text-sm leading-snug text-amber-100/95"
              role="status"
            >
              {pitchTypeBlockReason === "strikes"
                ? "Full count at 3 strikes — finish this PA in Record (out / reached base). Undo last pitch or Reset AB here only if you need to adjust coaching pitches."
                : "Four balls — finish this PA in Record (walk or strike ’em out elsewhere). Undo last pitch or Reset AB here only if you need to adjust coaching pitches."}
            </p>
          ) : null}

          {pitcherId ? (
            <section
              className="flex min-h-[min(36dvh,20rem)] min-w-0 flex-[1.35] flex-col overflow-hidden md:min-h-[14rem] lg:min-h-[12.5rem]"
              aria-label="Full game pitch data for this pitcher"
            >
              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden md:gap-2">
                <div
                  className="shrink-0 border-b border-zinc-800/80 pb-2"
                  aria-label="Pitcher game line from Record"
                >
                  {pitchSnapLoading ? (
                    <p className="text-center text-sm text-zinc-500 md:text-left">Loading pitcher…</p>
                  ) : pitchSnap ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 md:gap-4">
                      <div className="flex shrink-0 flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 sm:justify-start">
                        <p className="text-base font-bold leading-tight text-zinc-100 sm:text-lg">
                          {pitchSnap.name}
                        </p>
                        <span className="text-sm font-semibold tabular-nums text-zinc-400 sm:text-base">
                          {pitchSnap.jersey != null ? `#${pitchSnap.jersey}` : "—"}
                        </span>
                        <span
                          className="text-sm font-semibold tabular-nums text-zinc-300 sm:text-base"
                          title="Pitches thrown this game"
                        >
                          {pitcherGameIntelLoading
                            ? "…"
                            : pitcherFullGameMix != null &&
                                pitcherFullGameMix.plateAppearancesWithPitchCount > 0
                              ? `${pitcherFullGameMix.pitchesTotal} pitches`
                              : "— pitches"}
                        </span>
                      </div>
                      {pitchSnap.line1 ? (
                        <p className="min-w-0 flex-1 text-center text-sm font-semibold leading-snug text-zinc-200 sm:text-left sm:text-base">
                          {pitchSnap.line1}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {pitcherGameIntelLoading ? (
                  <p className="text-xs text-zinc-500">Loading pitch mix…</p>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <MatchupPitchMixStrip
                      pas={gamePitchMixPasMerged}
                      pitchEvents={gamePitchMixEventsMerged}
                      distributionPitchEvents={gamePitchMixDistributionEventsMerged}
                      currentPitcherId={pitcherId}
                      compact
                      coachPad
                      coachPadExpanded
                      hidePitchesInRates
                      hideLobInRates
                      coachPadFullGame
                    />
                  </div>
                )}
              </div>
            </section>
          ) : null}

          <div className="flex min-h-0 min-w-0 flex-col gap-1.5 overflow-hidden pt-1.5 md:max-h-[18dvh] md:flex-row md:gap-2 lg:max-h-[20dvh] xl:max-h-none xl:gap-3 xl:pt-2">
            <section
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border-2 border-amber-600/35 bg-gradient-to-b from-zinc-900/90 to-zinc-950/95 p-1.5 shadow-[0_0_0_1px_rgba(251,191,36,0.12)] md:min-h-0 md:min-w-0 md:flex-1 md:p-1.5 xl:p-2.5"
              aria-label="This game: batter vs current pitcher"
            >
              <div className="shrink-0 border-b border-amber-600/25 pb-1 md:pb-1 xl:pb-2">
                <h3 className="text-center text-xs font-bold uppercase tracking-wide text-amber-200/95 sm:text-sm">
                  Matchup · vs {pitchSnapLoading ? "…" : (pitchSnap?.name ?? "pitcher")}
                </h3>
              </div>
              {!batterId ? (
                <p className="mt-3 text-center text-sm text-zinc-500">
                  Set the batter on Record to see how this hitter has done against your pitcher today.
                </p>
              ) : !pitcherId ? (
                <p className="mt-3 text-center text-sm text-zinc-500">
                  Set the pitcher on Record (mound pitcher on the PA form).
                </p>
              ) : isOurTeamBatting ? (
                <p className="mt-3 text-center text-sm text-zinc-500">
                  Pitch mix is hidden while we hit.
                </p>
              ) : batterIntelLoading ? (
                <p className="mt-3 text-center text-sm text-zinc-500">Loading matchup…</p>
              ) : (
                <div className="mt-1 flex min-h-0 flex-1 flex-col overflow-hidden md:mt-1.5 xl:mt-3">
                  <CurrentBatterPitchDataCard
                    batterName={batterIntelDisplayName}
                    pas={matchupPasMerged}
                    pitchEvents={matchupEventsMerged}
                    distributionPitchEvents={matchupDistributionEventsMerged}
                    compact
                    coachPad
                    coachPadExpanded
                  />
                </div>
              )}
            </section>

            <aside
              className="flex max-h-[min(24dvh,13rem)] min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900/70 md:max-h-full md:min-h-0 md:w-[min(22rem,36vw)] md:shrink-0 xl:max-h-none xl:self-stretch"
              aria-label="This at-bat pitch sequence"
            >
              <div className="shrink-0 border-b border-zinc-700 px-2 py-1 sm:px-2.5 md:py-1.5 xl:py-2.5">
                <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                  <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-400 sm:text-sm">
                    This AB
                  </h2>
                  <div
                    className="flex shrink-0 items-baseline gap-3 sm:gap-4"
                    aria-label={`Count ${headerCountBalls} and ${headerCountStrikes}, ${outs} out${outs === 1 ? "" : "s"}`}
                  >
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500 sm:text-[10px]">
                        Count
                      </span>
                      <span className="font-mono text-3xl font-bold tabular-nums leading-none text-white sm:text-4xl">
                        {headerCountBalls}-{headerCountStrikes}
                      </span>
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-zinc-400 sm:text-sm">
                      {outs} out{outs === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </div>
              {sequenceRowsThisBatter.length === 0 ? (
                <p className="px-3 py-3 text-center text-sm leading-snug text-zinc-500">
                  {pitchDefenseOnlyBlocked
                    ? lineupGuardLoading
                      ? "…"
                      : "No pitches while we bat."
                    : "No pitches yet — tap a type below."}
                </p>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <ol
                    ref={sequenceListRef}
                    className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-2 py-1.5 sm:px-2.5 md:gap-2 md:py-2 xl:px-3"
                  >
                    {sequenceRowsThisBatter.map((r) => {
                      const fullIdx = sequenceRowsThisBatter.findIndex((x) => x.id === r.id);
                      const resultLabel = pitchTrackerLogResultShortLabel(r.result);
                      const priorEntries: PitchSequenceEntry[] = sequenceRowsThisBatter
                        .slice(0, fullIdx >= 0 ? fullIdx : 0)
                        .filter((p): p is typeof p & { result: PitchTrackerLogResult } => p.result != null)
                        .map((p) => ({
                          balls_before: 0,
                          strikes_before: 0,
                          outcome: p.result as PitchOutcome,
                        }));
                      const countBefore = replayCountAtEndOfSequence(priorEntries);
                      const countAfter =
                        r.result != null
                          ? countAfterPitch(countBefore.balls, countBefore.strikes, r.result as PitchOutcome)
                          : null;
                      const isLatest = lastPitchRowId != null && r.id === lastPitchRowId;
                      return (
                        <li
                          key={r.id}
                          className={`rounded-lg border px-2.5 py-2 sm:px-3 ${
                            isLatest
                              ? "border-amber-400/70 bg-amber-950/40 shadow-[0_0_0_1px_rgba(251,191,36,0.35)] ring-1 ring-amber-400/25"
                              : "border-amber-500/25 bg-zinc-950/50"
                          }`}
                        >
                        <div className="flex items-center gap-2 sm:gap-2.5">
                          <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-zinc-500 sm:w-7 sm:text-sm">
                            #{r.pitch_number}
                          </span>
                          <span className="w-[3.75rem] shrink-0 whitespace-nowrap text-sm font-semibold text-zinc-100 sm:w-[4.25rem]">
                            {resultLabel}
                          </span>
                          <div className="min-w-0 flex-1">
                            <CoachPitchCountTransition
                              beforeBalls={countBefore.balls}
                              beforeStrikes={countBefore.strikes}
                              after={countAfter}
                            />
                          </div>
                          <span
                            className={`inline-flex h-7 min-w-[2.25rem] shrink-0 items-center justify-center rounded-md border px-1 text-xs font-bold ${pitchTrackerTypeChipClass(r.pitch_type)}`}
                            title={pitchTrackerTypeLabel(r.pitch_type)}
                          >
                            {pitchTrackerAbbrev(r.pitch_type)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                </div>
              )}
            </aside>
          </div>
        </div>
      </main>

      <footer className="relative z-20 shrink-0 border-t-2 border-zinc-700 bg-zinc-900 px-2 py-3 shadow-[0_-14px_48px_rgba(0,0,0,0.55)] sm:px-4 sm:py-3.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {pitchLogBusy ? (
          <p className="mb-2 text-center text-xs font-medium text-amber-200 sm:text-sm" role="status">
            Saving pitch…
          </p>
        ) : pitchTypeCooldown ? (
          <p className="mb-2 text-center text-xs text-zinc-500 sm:text-sm" role="status">
            Ready for next pitch
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Link
            href="/coach"
            className="touch-manipulation inline-flex h-11 shrink-0 items-center justify-center gap-1.5 self-center rounded-lg border border-zinc-600 bg-zinc-800 px-4 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700 active:bg-zinc-600 sm:min-h-[44px] sm:self-auto"
            aria-label="Back to coach home"
          >
            <span className="text-base leading-none" aria-hidden>
              ←
            </span>
            <span>Back</span>
          </Link>
          <div
            className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-4 sm:gap-5"
            role="group"
            aria-label="Pitch type"
          >
            {PITCH_TRACKER_TYPES.map((t) => renderPitchTypeButton(t))}
          </div>
          <div className="flex shrink-0 items-center justify-center gap-3">
            <button
              type="button"
              disabled={
                pitchLogBusy || !supabase || !groupId || sequenceRowsThisBatter.length === 0
              }
              onClick={() => void undoLast()}
              className="touch-manipulation min-h-[44px] min-w-[5.75rem] rounded-lg border border-zinc-600 bg-zinc-800 px-4 text-sm font-semibold text-zinc-100 active:bg-zinc-700 disabled:opacity-35"
            >
              Undo
            </button>
            <button
              type="button"
              disabled={
                pitchLogBusy || !supabase || !groupId || sequenceRowsThisBatter.length === 0
              }
              onClick={() => void resetAtBat()}
              className="touch-manipulation min-h-[44px] min-w-[5.75rem] rounded-lg border border-amber-600/70 bg-amber-950/50 px-4 text-sm font-semibold text-amber-100 active:bg-amber-950/80 disabled:opacity-35"
            >
              Reset
            </button>
          </div>
        </div>
      </footer>
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
  const router = useRouter();

  const applySyncFromGameRow = useCallback(async () => {
    if (!supabase) return;
    const gid = session.gameId;
    try {
      const sync = await fetchPitchTrackerSyncFromGame(supabase, gid);
      let replaceUrl: string | null = null;
      setSession((prev) => {
        if (!prev || prev.gameId !== gid) return prev;
        const fromDb =
          sync.trackerGroupId && sync.trackerGroupId.length > 0 ? sync.trackerGroupId : null;
        const nextGroup = fromDb ?? prev.groupId;
        if (nextGroup && nextGroup !== prev.groupId) {
          replaceUrl = `/coach/pitch-tracker?${new URLSearchParams({ gameId: gid, groupId: nextGroup }).toString()}`;
        }
        return {
          ...prev,
          groupId: nextGroup,
          batterId: sync.batterId,
          batterSlot: sync.batterSlot,
          outs: sync.outs,
          pitcherId: sync.pitcherId,
          countBalls: sync.countBalls,
          countStrikes: sync.countStrikes,
        };
      });
      if (replaceUrl) router.replace(replaceUrl);
    } catch {
      /* ignore */
    }
  }, [supabase, session.gameId, setSession, router]);

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
        () => {
          void applySyncFromGameRow();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, session.gameId, applySyncFromGameRow]);

  useEffect(() => {
    void applySyncFromGameRow();
  }, [applySyncFromGameRow]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void applySyncFromGameRow();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [applySyncFromGameRow]);

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

        const groupFromDb =
          sync.trackerGroupId && sync.trackerGroupId.length > 0 ? sync.trackerGroupId : null;
        let groupId: string | null = groupFromDb ?? groupIdProp ?? null;
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
            batterSlot: sync.batterSlot,
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
        const groupFromDb =
          sync.trackerGroupId && sync.trackerGroupId.length > 0 ? sync.trackerGroupId : null;
        const groupId = groupFromDb ?? (await ensurePitchTrackerGroupOnGame(supabase, gameId));
        setSession({
          gameId,
          groupId,
          batterId: sync.batterId,
          batterSlot: sync.batterSlot,
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
        <Link
          href="/coach"
          className="touch-manipulation inline-flex h-11 items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-800/90 px-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700 active:bg-zinc-600"
          aria-label="Back to coach home"
        >
          <span className="text-base leading-none" aria-hidden>
            ←
          </span>
          <span>Back</span>
        </Link>
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
                  {formatDateMMDDYYYY(g.date)} — {matchupLabelUsFirst(g, true)}
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
      </div>
    </div>
  );
}
