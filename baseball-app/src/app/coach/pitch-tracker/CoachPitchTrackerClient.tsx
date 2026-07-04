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
import { ThemeToggle } from "@/components/theme/ThemeToggle";
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
import { pitchingStatsFromPAs } from "@/lib/compute/pitchingStats";
import { isDemoId } from "@/lib/db/mockData";
import { isDemoMode } from "@/lib/demoMode";
import { isGameFinalized } from "@/lib/gameRecord";
import { pickCoachDashboardGame, sortGamesForCoachSelect } from "@/lib/coachGamePick";
import { PitchPadGamePicker } from "./PitchPadGamePicker";
import { usePitchTrackerPadPresence } from "@/hooks/usePitchTrackerPadPresence";
import {
  PITCH_TRACKER_OFFENSE_TYPES,
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
  pitchesByInningForPitcher,
  pitchesThisInningForPitcher,
} from "@/components/analyst/BattingPitchMixCard";
import { MatchupGlanceModal } from "@/components/analyst/MatchupGlanceModal";
import { PitchesByInningModal } from "@/components/analyst/PitchesByInningModal";
import { pitchTypeGameDetailFromPas } from "@/lib/compute/pitchTypeGameDetail";
import { PitchTypeStatsModal } from "@/components/coach/PitchTypeStatsModal";
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
  Player,
  Throws,
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

function buildLineupBoard(
  lineupByPlayerId: Record<string, CoachLineupBatterEntry>,
  batterId: string | null,
  batterSlot: number | null
): { ordered: CoachOpposingLineupRow[]; onDeckPlayerId: string | null } {
  const ordered: CoachOpposingLineupRow[] = Object.entries(lineupByPlayerId)
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
}

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
  return `${size} text-[var(--text-faint)]`;
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
  const base = "min-w-0 font-semibold text-[var(--text)]";
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
  /** Our pitcher for full-game panel on defense (`pitch_tracker_pitcher_id`). */
  pitcherId: string | null;
  /** Mound pitcher from Record — opponent when we hit (`pitch_tracker_mound_pitcher_id`). */
  moundPitcherId?: string | null;
};

type TrackerSession = {
  gameId: string;
  groupId: string;
  /** Null until Record sets a batter; pitch buttons stay disabled until then. */
  batterId: string | null;
  /** Batting-order 1–9 from Record lineup (`games.pitch_tracker_batter_slot`). */
  batterSlot: number | null;
  /** Our pitcher for full-game panel on defense (`pitch_tracker_pitcher_id`). */
  pitcherId: string | null;
  /** Mound pitcher from Record — opponent when we hit (`pitch_tracker_mound_pitcher_id`). */
  moundPitcherId: string | null;
  outs: number;
  /** Mirrors Record PA count (0–3 each). */
  countBalls: number;
  countStrikes: number;
};

async function ensurePitchTrackerGroupOnGame(
  supabase: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,
  gameId: string
): Promise<string> {
  if (isDemoMode() || isDemoId(gameId)) {
    return crypto.randomUUID();
  }
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
  /** Our pitcher for full-game panel on defense (`pitch_tracker_pitcher_id`). */
  pitcherId: string | null;
  /** Mound pitcher from Record — opponent when we hit (`pitch_tracker_mound_pitcher_id`). */
  moundPitcherId: string | null;
  countBalls: number;
  countStrikes: number;
}> {
  const { data, error } = await supabase
    .from("games")
    .select(
      "pitch_tracker_group_id, pitch_tracker_batter_id, pitch_tracker_batter_slot, pitch_tracker_outs, pitch_tracker_pitcher_id, pitch_tracker_mound_pitcher_id, pitch_tracker_balls, pitch_tracker_strikes"
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
        pitch_tracker_mound_pitcher_id?: string | null;
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
  const moundRaw = row?.pitch_tracker_mound_pitcher_id;
  const moundPitcherId =
    moundRaw && typeof moundRaw === "string" && moundRaw.length > 0 ? moundRaw : null;
  const countBalls = clampPitchTrackerCountHalf(row?.pitch_tracker_balls ?? 0);
  const countStrikes = clampPitchTrackerCountHalf(row?.pitch_tracker_strikes ?? 0);
  const batterSlot = clampPitchTrackerBatterSlot(row?.pitch_tracker_batter_slot ?? null);
  return { trackerGroupId, batterId, batterSlot, outs, pitcherId, moundPitcherId, countBalls, countStrikes };
}

type CoachPitcherSnapshotUi = {
  name: string;
  jersey: string | null;
  throws: Throws | null;
  line1: string;
};

const COACH_LANDSCAPE_TIP_KEY = "coach_pitch_pad_landscape_tip_v1";
const COACH_LINEUP_COLLAPSED_KEY = "coach_pitch_pad_lineup_collapsed_v1";
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

function sortPitchRows(rows: PitchTrackerPitch[]): PitchTrackerPitch[] {
  return [...rows].sort((a, b) => a.pitch_number - b.pitch_number);
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
    <span className="pitch-pad-count-chip inline-flex shrink-0 items-center gap-x-1.5 rounded-md border px-2 py-1 tabular-nums leading-none md:gap-x-2 md:px-2.5 md:py-1.5">
      <span className="text-xs text-[var(--text)] sm:text-sm">{beforeBalls}-{beforeStrikes}</span>
      <span className="text-xs text-[var(--text-muted)] sm:text-sm" aria-hidden>
        →
      </span>
      <span className="pitch-pad-count-chip-after text-xs sm:text-sm">{tail}</span>
    </span>
  );
}

function CoachPitchPad({
  gameId,
  groupId,
  batterId,
  batterSlot,
  pitcherId,
  moundPitcherId,
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
  const [ourLineupByPlayerId, setOurLineupByPlayerId] = useState<
    Record<string, CoachLineupBatterEntry>
  >({});
  /** `game_lineups.slot` (1–9) for both teams — batting order for anyone in the game lineup. */
  const [lineupBattingOrderByPlayerId, setLineupBattingOrderByPlayerId] = useState<
    Record<string, number>
  >({});
  const [opponentLineupLoading, setOpponentLineupLoading] = useState(false);
  const [lineupCollapsed, setLineupCollapsed] = useState(false);
  /** Player ids on our lineup for this game; `null` while resolving (block pitch types until known). */
  const [ourLineupPlayerIds, setOurLineupPlayerIds] = useState<Set<string> | null>(null);
  /** Our starter — fallback for full-game pitcher panel while we hit (before a defensive half). */
  const [ourPitcherStarterId, setOurPitcherStarterId] = useState<string | null>(null);
  /** Opponent starter — fallback for offense pitcher panel before mound sync. */
  const [opponentStarterId, setOpponentStarterId] = useState<string | null>(null);
  const ourPitcherIdRef = useRef<string | null>(null);
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
  /** Skip redundant realtime refetch right after a local save (optimistic UI already updated). */
  const skipRemoteRefreshUntilRef = useRef(0);

  const supabase = getSupabaseBrowserClient();
  const canLogPitch = !!(supabase && gameId && groupId && batterId);

  usePitchTrackerPadPresence(groupId, "track");

  const lineupGuardLoading = ourLineupPlayerIds === null;
  const isOurTeamBatting = !!(batterId && ourLineupPlayerIds && ourLineupPlayerIds.has(batterId));

  useEffect(() => {
    if (!isOurTeamBatting && pitcherId) ourPitcherIdRef.current = pitcherId;
  }, [isOurTeamBatting, pitcherId]);

  /** Full-game pitcher panel on defense — our arm from Record sync. */
  const ourPitcherId = useMemo(() => {
    if (!isOurTeamBatting && pitcherId) return pitcherId;
    return ourPitcherIdRef.current ?? ourPitcherStarterId;
  }, [isOurTeamBatting, pitcherId, ourPitcherStarterId]);

  /** Pitcher shown in the header / mix panel (opponent when we hit). */
  const panelPitcherId = useMemo(() => {
    if (isOurTeamBatting) return moundPitcherId ?? opponentStarterId;
    return ourPitcherId;
  }, [isOurTeamBatting, moundPitcherId, opponentStarterId, ourPitcherId]);

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
      setLineupCollapsed(window.localStorage.getItem(COACH_LINEUP_COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const setLineupPanelCollapsed = useCallback((collapsed: boolean) => {
    setLineupCollapsed(collapsed);
    try {
      window.localStorage.setItem(COACH_LINEUP_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
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
      setOurLineupByPlayerId({});
      setLineupBattingOrderByPlayerId({});
      setOurLineupPlayerIds(new Set());
      setOurPitcherStarterId(null);
      setOpponentStarterId(null);
      setOpponentLineupLoading(false);
      return;
    }
    setOpponentLineupLoading(true);
    setOurLineupPlayerIds(null);
    setOurPitcherStarterId(null);
    setOpponentStarterId(null);

    async function lineupMapForSide(side: "home" | "away"): Promise<Record<string, CoachLineupBatterEntry>> {
      const { data: slots, error: sErr } = await supabase!
        .from("game_lineups")
        .select("slot, player_id")
        .eq("game_id", gameId!)
        .eq("side", side)
        .order("slot", { ascending: true });
      if (sErr || !slots?.length) return {};
      const list = slots as { slot: number; player_id: string }[];
      const ids = [...new Set(list.map((s) => s.player_id))];
      const { data: prows } = await supabase!
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
      return byId;
    }

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
        .select("our_side, starting_pitcher_home_id, starting_pitcher_away_id")
        .eq("id", gameId)
        .maybeSingle();
      if (gErr || !gameRow) {
        setOpponentLineupByPlayerId({});
        setOurLineupByPlayerId({});
        setOurLineupPlayerIds(new Set());
        setOurPitcherStarterId(null);
        setOpponentStarterId(null);
        return;
      }
      const row = gameRow as {
        our_side?: string;
        starting_pitcher_home_id?: string | null;
        starting_pitcher_away_id?: string | null;
      };
      const our = row.our_side;
      if (our !== "home" && our !== "away") {
        setOpponentLineupByPlayerId({});
        setOurLineupByPlayerId({});
        setOurLineupPlayerIds(new Set());
        setOurPitcherStarterId(null);
        setOpponentStarterId(null);
        return;
      }
      const starterId =
        our === "home" ? row.starting_pitcher_home_id : row.starting_pitcher_away_id;
      setOurPitcherStarterId(
        starterId && typeof starterId === "string" && starterId.length > 0 ? starterId : null
      );
      const oppStarterRaw =
        our === "home" ? row.starting_pitcher_away_id : row.starting_pitcher_home_id;
      setOpponentStarterId(
        oppStarterRaw && typeof oppStarterRaw === "string" && oppStarterRaw.length > 0
          ? oppStarterRaw
          : null
      );
      const ourIds = new Set<string>();
      if (!allErr && allLineupRows?.length) {
        for (const r of allLineupRows as { player_id?: string; side?: string }[]) {
          if (r.side === our && r.player_id) ourIds.add(r.player_id);
        }
      }
      setOurLineupPlayerIds(ourIds);

      const oppSide = our === "home" ? "away" : "home";
      const [oppMap, ourMap] = await Promise.all([
        lineupMapForSide(oppSide),
        lineupMapForSide(our),
      ]);
      setOpponentLineupByPlayerId(oppMap);
      setOurLineupByPlayerId(ourMap);
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
    if (!supabase || !gameId || isDemoId(gameId) || !batterId) {
      setBatterIntelPas([]);
      setBatterIntelEvents([]);
      setBatterIntelLoading(false);
      return;
    }
    if (!isOurTeamBatting && !pitcherId) {
      setBatterIntelPas([]);
      setBatterIntelEvents([]);
      setBatterIntelLoading(false);
      return;
    }
    setBatterIntelLoading(true);
    try {
      let pasQuery = supabase
        .from("plate_appearances")
        .select("*")
        .eq("game_id", gameId)
        .eq("batter_id", batterId);
      if (isOurTeamBatting && panelPitcherId) {
        pasQuery = pasQuery.eq("pitcher_id", panelPitcherId);
      } else if (!isOurTeamBatting && pitcherId) {
        pasQuery = pasQuery.eq("pitcher_id", pitcherId);
      }
      const { data: pasRaw, error: pasErr } = await pasQuery
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
  }, [supabase, gameId, batterId, pitcherId, isOurTeamBatting, panelPitcherId]);

  const loadPitcherGameIntel = useCallback(async () => {
    const intelPitcherId = panelPitcherId;
    if (!supabase || !gameId || isDemoId(gameId) || !intelPitcherId) {
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
        .eq("pitcher_id", intelPitcherId)
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
  }, [supabase, gameId, panelPitcherId]);

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

  /** Record pitch log writes — keep modal Results / Swings / 2-strike stats live while open. */
  useEffect(() => {
    if (!supabase || !gameId || isDemoId(gameId)) return;
    const channel = supabase
      .channel(`coach-pitch-events-intel-${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pitch_events" },
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
          if (Date.now() < skipRemoteRefreshUntilRef.current) return;
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

  const batterMissingFromActiveLineup = useMemo(() => {
    if (!batterId || opponentLineupLoading) return false;
    const board = isOurTeamBatting ? ourLineupByPlayerId : opponentLineupByPlayerId;
    if (Object.keys(board).length === 0) return false;
    return board[batterId] == null;
  }, [batterId, opponentLineupLoading, isOurTeamBatting, ourLineupByPlayerId, opponentLineupByPlayerId]);

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
    return coachLiveAbSyntheticPa(gameId, batterId, panelPitcherId);
  }, [gameId, batterId, panelPitcherId, livePitchEventsForCard.length, sequenceRowsThisBatter]);

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

  /** Header RATES / CONTACT / 2-strike strip: full game vs panel pitcher + live AB. */
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

  /**
   * Pitches this half-inning: saved PAs of the latest half-inning Record has
   * for this pitcher, plus the live (unsaved) AB from the coach pitch log.
   * The synthetic live PA hardcodes inning 1, so it is excluded and the live
   * sequence is added separately.
   */
  const pitcherPitchesThisInning = useMemo(() => {
    if (!panelPitcherId) return null;
    const savedPas = gamePitchMixPasMerged.filter((p) => p.id !== COACH_LIVE_AB_PA_ID);
    let latest: PlateAppearance | null = null;
    for (const pa of savedPas) {
      if (latest == null) {
        latest = pa;
        continue;
      }
      const halfRank = (p: PlateAppearance) => (p.inning_half === "bottom" ? 1 : 0);
      const ts = (p: PlateAppearance) => (p.created_at ? new Date(p.created_at).getTime() : 0);
      if (
        pa.inning > latest.inning ||
        (pa.inning === latest.inning &&
          (halfRank(pa) > halfRank(latest) ||
            (halfRank(pa) === halfRank(latest) && ts(pa) >= ts(latest))))
      ) {
        latest = pa;
      }
    }
    const liveCount = sequenceRowsThisBatter.length;
    if (!latest || latest.pitcher_id !== panelPitcherId) return liveCount;
    return (
      pitchesThisInningForPitcher(
        savedPas,
        gamePitchMixEventsMerged,
        panelPitcherId,
        latest.inning,
        latest.inning_half === "bottom" ? "bottom" : "top"
      ) + liveCount
    );
  }, [
    panelPitcherId,
    gamePitchMixPasMerged,
    gamePitchMixEventsMerged,
    sequenceRowsThisBatter,
  ]);

  /** Tap a pitch-type chip (Mix cards / sequence) → in-game stats modal for that type. */
  const [statPitchType, setStatPitchType] = useState<PitchTrackerPitchType | null>(null);
  const [matchupGlanceOpen, setMatchupGlanceOpen] = useState(false);
  const [pitchesByInningModalOpen, setPitchesByInningModalOpen] = useState(false);

  const statPitchTypeDetail = useMemo(() => {
    if (!statPitchType || !panelPitcherId) return null;
    const pitcherPas = gamePitchMixPasMerged.filter((p) => p.pitcher_id === panelPitcherId);
    return pitchTypeGameDetailFromPas(
      pitcherPas,
      gamePitchMixEventsMerged,
      statPitchType,
      gamePitchMixDistributionEventsMerged
    );
  }, [
    statPitchType,
    panelPitcherId,
    gamePitchMixPasMerged,
    gamePitchMixEventsMerged,
    gamePitchMixDistributionEventsMerged,
    sequenceRowsThisBatter,
  ]);

  const openPitchTypeStats = useCallback((t: PitchTrackerPitchType) => {
    setStatPitchType(t);
  }, []);

  const openMatchupGlance = useCallback(() => {
    if (!batterId || !panelPitcherId) return;
    setMatchupGlanceOpen(true);
  }, [batterId, panelPitcherId]);

  const ourLineupBoard = useMemo(
    () => buildLineupBoard(ourLineupByPlayerId, batterId, batterSlot),
    [ourLineupByPlayerId, batterId, batterSlot]
  );
  const opposingLineupBoard = useMemo(
    () => buildLineupBoard(opponentLineupByPlayerId, batterId, batterSlot),
    [opponentLineupByPlayerId, batterId, batterSlot]
  );
  const activeLineupBoard = isOurTeamBatting ? ourLineupBoard : opposingLineupBoard;
  const activeLineupLabel = isOurTeamBatting ? "Our lineup" : "Opposing lineup";

  const batterIntelDisplayName = useMemo(() => {
    if (!batterId) return "Batter";
    return (
      batterProfile?.name ??
      (isOurTeamBatting ? ourLineupByPlayerId[batterId]?.name : opponentLineupByPlayerId[batterId]?.name) ??
      "Batter"
    );
  }, [batterId, batterProfile, isOurTeamBatting, ourLineupByPlayerId, opponentLineupByPlayerId]);

  const matchupBatterPlayer = useMemo((): Player | null => {
    if (!batterId) return null;
    return {
      id: batterId,
      name: batterIntelDisplayName,
      jersey: batterProfile?.jersey ?? null,
      positions: [],
      bats: batterProfile?.bats ?? null,
    };
  }, [batterId, batterIntelDisplayName, batterProfile]);

  const matchupPitcherPlayer = useMemo((): Player | null => {
    if (!panelPitcherId) return null;
    return {
      id: panelPitcherId,
      name: pitchSnap?.name ?? "Pitcher",
      jersey: pitchSnap?.jersey ?? null,
      positions: [],
      throws: pitchSnap?.throws ?? null,
    };
  }, [panelPitcherId, pitchSnap]);

  const pitchesByInningRows = useMemo(() => {
    if (!panelPitcherId) return [];
    return pitchesByInningForPitcher(
      gamePitchMixPasMerged,
      gamePitchMixEventsMerged,
      panelPitcherId
    );
  }, [panelPitcherId, gamePitchMixPasMerged, gamePitchMixEventsMerged]);

  const pitchesByInningTotal = useMemo(
    () => pitchesByInningRows.reduce((sum, row) => sum + row.pitches, 0),
    [pitchesByInningRows]
  );

  const pitchTypeBlockReason = useMemo(
    () => coachPitchPadBlocksNewPitchRow(sequenceRowsThisBatter),
    [sequenceRowsThisBatter]
  );
  const pitchTypesLocked = pitchTypeBlockReason != null;
  const pitchButtonsBlocked = lineupGuardLoading;
  const activePitchTypes = isOurTeamBatting ? PITCH_TRACKER_OFFENSE_TYPES : PITCH_TRACKER_TYPES;
  const canLogPitchType = canLogPitch && !pitchTypesLocked && !pitchButtonsBlocked;
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
    const snapPitcherId = panelPitcherId;
    if (!supabase || !gameId) {
      setPitchSnap(null);
      return;
    }
    if (!snapPitcherId || isDemoId(gameId)) {
      setPitchSnap(null);
      return;
    }
    setPitchSnapLoading(true);
    try {
      const [{ data: playerRow }, { data: pasRows }] = await Promise.all([
        supabase.from("players").select("name, jersey, throws").eq("id", snapPitcherId).maybeSingle(),
        supabase
          .from("plate_appearances")
          .select("*")
          .eq("game_id", gameId)
          .eq("pitcher_id", snapPitcherId),
      ]);
      const row = playerRow as { name?: string; jersey?: string | null; throws?: unknown } | null;
      const name = row && typeof row.name === "string" ? row.name : "Pitcher";
      const jersey = normalizeJersey(row?.jersey ?? null);
      const throws: Throws | null =
        row?.throws === "L" || row?.throws === "R" ? row.throws : null;
      const pas = (pasRows ?? []) as PlateAppearance[];
      if (pas.length === 0) {
        setPitchSnap({
          name,
          jersey,
          throws,
          line1: "No plate appearances logged to this pitcher in this game yet.",
        });
        return;
      }
      const split = pitchingStatsFromPAs(pas, new Set(), new Map(), new Map(), {
        allPasForRunCharges: pas,
      });
      const s = split?.overall;
      if (!s) {
        setPitchSnap({ name, jersey, throws, line1: "—" });
        return;
      }
      const lob = lobByPitcherFromPas(pas).get(snapPitcherId) ?? 0;
      const line1 = `${s.ipDisplay} IP · ${s.h} H · ${s.r} R · ${s.er} ER · ${s.bb} BB · ${s.so} K · ERA ${
        s.ip > 0 ? s.era.toFixed(2) : "—"
      } · WHIP ${s.ip > 0 ? s.whip.toFixed(2) : "—"} · LOB ${lob}`;
      setPitchSnap({ name, jersey, throws, line1 });
    } catch {
      setPitchSnap(null);
    } finally {
      setPitchSnapLoading(false);
    }
  }, [supabase, gameId, panelPitcherId]);

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
    if (isDemoMode()) {
      setError("Portfolio demo is read-only.");
      return;
    }
    if (pitchButtonsBlocked || pitchLogInFlightRef.current || pitchDockLocked) return;

    pitchLogInFlightRef.current = true;
    setPitchLogBusy(true);

    const offline =
      typeof navigator !== "undefined" && !navigator.onLine;
    const batterRows = rows.filter((r) => r.batter_id === batterId);
    const sortedBatterRows = [...batterRows].sort((a, b) => a.pitch_number - b.pitch_number);
    const awaitingType = sortedBatterRows.filter((r) => r.pitch_type == null)[0] ?? null;
    /** Mound pitcher on the row — synced id when known; null is OK on offense. */
    const pitcherIdForRow = isOurTeamBatting ? (moundPitcherId ?? null) : pitcherId;

    const markSavedLocally = () => {
      skipRemoteRefreshUntilRef.current = Date.now() + 900;
    };

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
          .update({ pitch_type, pitcher_id: pitcherIdForRow })
          .eq("id", rowId);
        if (upErr) {
          setError(formatCoachPitchSaveError(upErr.message, offline));
          return false;
        }
        setRows((prev) =>
          sortPitchRows(
            prev.map((r) =>
              r.id === rowId ? { ...r, pitch_type, pitcher_id: pitcherIdForRow } : r
            )
          )
        );
        markSavedLocally();
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
          const { data: inserted, error: insErr } = await supabase
            .from("pitches")
            .insert({
              game_id: gameId,
              at_bat_id: null,
              tracker_group_id: groupId,
              pitch_number,
              pitch_type,
              result: null,
              batter_id: batterId,
              pitcher_id: pitcherIdForRow,
            })
            .select("*")
            .single();

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
                void refresh();
                return;
              }
            } else {
              setError(formatCoachPitchSaveError(insErr.message, offline));
              return;
            }
          } else if (inserted) {
            setRows((prev) => sortPitchRows([...prev, inserted as PitchTrackerPitch]));
            markSavedLocally();
          }
        } else {
          setError(
            "That pitch already has a type — check This AB or use Undo if it was a mistake."
          );
          return;
        }
      }

      setFlashType(pitch_type);
      startPitchTypeCooldown();
      void refresh();
    } finally {
      pitchLogInFlightRef.current = false;
      setPitchLogBusy(false);
    }
  };

  const undoLast = async () => {
    if (pitchLogInFlightRef.current || pitchLogBusy) return;
    if (isDemoMode()) {
      setError("Portfolio demo is read-only.");
      return;
    }
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
    if (isDemoMode()) {
      setError("Portfolio demo is read-only.");
      return;
    }
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
    const offensePad = isOurTeamBatting;
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
        className={`touch-manipulation flex shrink-0 items-center justify-center rounded-xl border-2 px-2 py-2 shadow transition-none active:scale-100 sm:transition sm:active:scale-[0.98] disabled:opacity-40 ${pitchTrackerCoachButtonClass(t)} ${
          offensePad
            ? "min-h-[3.5rem] min-w-[6.5rem] sm:min-h-[4rem] sm:min-w-[7.5rem] md:min-h-[4.25rem] md:min-w-[8.5rem]"
            : "min-h-[3.25rem] min-w-[4.5rem] sm:min-h-[3.5rem] sm:min-w-[5rem] md:min-h-[3.75rem] md:min-w-[5.5rem]"
        } sm:px-2.5 sm:py-2.5 ${
          flashed && !motionSafe
            ? "ring-2 ring-[var(--accent)]/80 ring-offset-2 ring-offset-[var(--bg-base)] sm:ring-offset-2"
            : flashed && motionSafe
              ? "brightness-110"
              : ""
        }`}
      >
        <span className="max-w-full text-center text-[10px] font-bold leading-tight sm:text-xs md:text-sm">
          {label}
        </span>
      </button>
    );
  };

  if (!supabase) {
    return (
      <div className="coach-pitch-pad flex min-h-[100dvh] items-center justify-center bg-[var(--bg-base)] px-4 text-center text-lg text-[var(--text-muted)]">
        Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
      </div>
    );
  }

  return (
    <div className="coach-pitch-pad flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[var(--bg-base)] text-[var(--text)]">
      {toast ? (
        <p
          className="pitch-pad-banner-success shrink-0 border-b px-3 py-2 text-center text-sm font-medium"
          role="status"
        >
          {toast}
        </p>
      ) : null}

      {error ? (
        <p className="pitch-pad-banner-error shrink-0 px-4 py-2 text-center text-sm">{error}</p>
      ) : null}

      {!networkOnline ? (
        <p className="pitch-pad-banner-warning shrink-0 border-b px-4 py-2 text-center text-sm font-medium" role="status">
          Offline — logging may fail until you&apos;re back on Wi‑Fi or cellular. What you tap might not save.
        </p>
      ) : null}

      {networkOnline && !pitchesRealtimeOk ? (
        <p className="pitch-pad-surface shrink-0 border-b px-4 py-2 text-center text-sm leading-snug text-[var(--text)]" role="status">
          Live pitch sync paused — check connectivity or keep Record open; this pad will retry every few seconds. You can still use Undo / Reset on this device.
        </p>
      ) : null}

      {batterMissingFromActiveLineup ? (
        <p
          className="pitch-pad-banner-info shrink-0 border-b px-4 py-2 text-center text-sm leading-snug"
          role="status"
        >
          Sync note — Record&apos;s batter isn&apos;t on the {isOurTeamBatting ? "our" : "opposing"} lineup card.
          Confirm the correct dugout / lineup on Record before trusting OD markers here.
        </p>
      ) : null}

      {showLandscapeTip ? (
        <div className="pitch-pad-banner-success flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <p className="min-w-0 flex-1 text-xs leading-snug sm:text-sm">
            This pitch pad is laid out for <strong className="font-semibold">iPad landscape</strong> — rotate for the widest matchup + sequence columns.
          </p>
          <button
            type="button"
            className="pitch-pad-btn-secondary touch-manipulation shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold active:opacity-90"
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

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row md:gap-2 md:p-3">
        {/* Opposing lineup — collapsible side panel on tablet landscape */}
        <div
          className={`flex min-h-0 shrink-0 md:self-stretch md:transition-[width] md:duration-200 md:ease-out ${
            lineupCollapsed
              ? "max-h-0 overflow-hidden border-b-0 md:max-h-none md:w-11 md:overflow-visible"
              : "max-h-[38vh] md:max-h-none md:w-[min(15.25rem,27vw)]"
          }`}
        >
          {lineupCollapsed ? (
            <button
              type="button"
              className="pitch-pad-surface touch-manipulation hidden h-full min-h-0 w-11 flex-col items-center justify-center gap-2 self-stretch rounded-xl border py-3 active:opacity-90 md:flex"
              onClick={() => setLineupPanelCollapsed(false)}
              aria-label={isOurTeamBatting ? "Show our lineup" : "Show opposing lineup"}
              title="Show lineup"
            >
              <span className="pitch-pad-accent text-lg font-bold leading-none" aria-hidden>
                ›
              </span>
              <span
                className="pitch-pad-accent text-[10px] font-bold uppercase tracking-wide [writing-mode:vertical-rl]"
                aria-hidden
              >
                Lineup
              </span>
              {batterId && activeLineupBoard.ordered.some((r) => r.playerId === batterId) ? (
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]"
                  title="Batter at plate"
                  aria-hidden
                />
              ) : null}
            </button>
          ) : (
            <section
              className="pitch-pad-surface flex min-h-0 flex-1 flex-col overflow-hidden border-b px-2 py-2 md:max-h-none md:self-stretch md:rounded-xl md:border md:px-2 md:py-2"
              aria-label={activeLineupLabel}
            >
              <div className="mb-1.5 flex items-center justify-between gap-1">
                <h2 className="pitch-pad-accent text-[10px] font-bold uppercase tracking-wide sm:text-xs">
                  {activeLineupLabel}
                </h2>
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    className="pitch-pad-btn-secondary touch-manipulation inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm font-bold leading-none active:opacity-90 md:h-8 md:w-8"
                    onClick={() => setLineupPanelCollapsed(true)}
                    aria-label="Hide lineup"
                    title="Hide lineup"
                  >
                    <span className="md:hidden" aria-hidden>
                      ▲
                    </span>
                    <span className="hidden md:inline" aria-hidden>
                      ‹
                    </span>
                  </button>
                </div>
              </div>
              {opponentLineupLoading ? (
                <p className="text-xs text-[var(--text-faint)]">Loading…</p>
              ) : activeLineupBoard.ordered.length === 0 ? (
                <p className="text-xs text-[var(--text-faint)]">Set the lineup on Record.</p>
              ) : (
                <ul className="grid min-h-0 flex-1 grid-cols-2 gap-x-1 gap-y-1.5 overflow-y-auto overscroll-contain sm:gap-x-1.5 sm:gap-y-2 md:flex md:flex-col md:gap-1.5">
                  {activeLineupBoard.ordered.map((row) => {
                    const atBat = !!(batterId && row.playerId === batterId);
                    const onDeck =
                      !atBat &&
                      activeLineupBoard.onDeckPlayerId != null &&
                      row.playerId === activeLineupBoard.onDeckPlayerId;
                    const jerseyStr = row.jersey != null ? `#${row.jersey}` : "—";
                    return (
                      <li
                        key={row.playerId}
                        className={`flex min-h-0 min-w-0 items-center gap-2 rounded-lg border px-1.5 py-1.5 text-sm md:flex-1 md:gap-2.5 md:px-2.5 md:py-2 md:text-base ${
                          atBat
                            ? "pitch-pad-at-bat"
                            : onDeck
                              ? "pitch-pad-on-deck"
                              : "pitch-pad-lineup-idle"
                        }`}
                      >
                        <span className="pitch-pad-accent w-6 shrink-0 text-center text-sm font-bold tabular-nums md:w-8 md:text-base">
                          {battingOrderOrdinal(row.slot)}
                        </span>
                        <div className="min-w-0 flex-1 leading-snug md:leading-normal">
                          <p className={lineupBatterNameClass(row.name)} title={row.name}>
                            {row.name}
                          </p>
                          <p className="truncate text-xs text-[var(--text)] md:text-sm">
                            {jerseyStr}{" "}
                            <span className={batsHandChipClass(row.bats, "compact")}>{batsHandLabel(row.bats)}</span>
                          </p>
                        </div>
                        <div className="shrink-0">
                          {atBat ? (
                            <span className="pitch-pad-ab-badge rounded-md px-1 py-0.5 text-[10px] font-bold uppercase leading-none md:px-1.5 md:py-1 md:text-xs">
                              AB
                            </span>
                          ) : onDeck ? (
                            <span className="pitch-pad-od-badge rounded-md px-1 py-0.5 text-[10px] font-bold uppercase leading-none md:px-1.5 md:py-1 md:text-xs">
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
          )}
        </div>

        {lineupCollapsed ? (
          <button
            type="button"
            className="pitch-pad-surface touch-manipulation flex shrink-0 items-center justify-center gap-2 border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide pitch-pad-accent active:opacity-90 md:hidden"
            onClick={() => setLineupPanelCollapsed(false)}
            aria-label={isOurTeamBatting ? "Show our lineup" : "Show opposing lineup"}
          >
            <span aria-hidden>▼</span>
            Show lineup
            {batterId && activeLineupBoard.ordered.some((r) => r.playerId === batterId) ? (
              <span className="pitch-pad-ab-badge rounded px-1.5 py-0.5 text-[10px] font-bold">AB</span>
            ) : null}
          </button>
        ) : null}

        {/* Center: primary coaching focus — fixed row heights on tablet+ so pitch sequence scrolls inside its panel */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden p-2 pb-1 md:p-0 md:pb-0">
          {lineupGuardLoading ? (
            <p
              className="pitch-pad-banner-info shrink-0 rounded-lg border px-3 py-2 text-center text-sm leading-snug"
              role="status"
            >
              Loading lineups… Pitch buttons stay off until we know who is at bat.
            </p>
          ) : null}
          {!lineupGuardLoading && isOurTeamBatting ? (
            <p
              className="pitch-pad-banner-offense shrink-0 rounded-lg border px-3 py-2 text-center text-sm leading-snug"
              role="status"
            >
              We&apos;re hitting — tap <strong className="font-semibold">Fastball</strong>,{" "}
              <strong className="font-semibold">Off-speed</strong>, or{" "}
              <strong className="font-semibold">Breaking ball</strong> below for each pitch they throw. Analyst
              still logs balls and strikes on Record.
            </p>
          ) : null}
          {/* Overlay (not in flow): appearing mid-AB must not squeeze the full-game panel below it. */}
          {pitchTypesLocked && !pitchButtonsBlocked ? (
            <p
              className="pitch-pad-banner-lock absolute left-1/2 top-1 z-30 w-[min(44rem,calc(100%-1rem))] -translate-x-1/2 rounded-lg border px-3 py-2 text-center text-sm leading-snug shadow-lg md:top-0"
              role="status"
            >
              {pitchTypeBlockReason === "strikes"
                ? "Full count at 3 strikes — finish this PA in Record (out / reached base). Undo last pitch or Reset AB here only if you need to adjust coaching pitches."
                : "Four balls — finish this PA in Record (walk or strike ’em out elsewhere). Undo last pitch or Reset AB here only if you need to adjust coaching pitches."}
            </p>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden md:gap-2">
          {panelPitcherId ? (
            <section
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden max-md:max-h-[min(38dvh,20rem)] max-md:shrink-0"
              aria-label={isOurTeamBatting ? "Full game pitch data for opposing pitcher" : "Full game pitch data for our pitcher"}
            >
              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden md:gap-2">
                <div
                  className="shrink-0 border-b border-[var(--border)] pb-2"
                  aria-label="Pitcher game line from Record"
                >
                  {pitchSnapLoading ? (
                    <p className="text-center text-sm text-[var(--text-faint)] md:text-left">Loading pitcher…</p>
                  ) : pitchSnap ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 md:gap-4">
                      <div className="flex shrink-0 flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 sm:justify-start">
                        {batterId && panelPitcherId ? (
                          <button
                            type="button"
                            onClick={openMatchupGlance}
                            className="cursor-pointer rounded text-left text-base font-bold leading-tight text-[var(--text)] underline decoration-[var(--accent)]/40 decoration-2 underline-offset-4 transition hover:decoration-[var(--accent)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 sm:text-lg"
                            title="View matchup glance"
                          >
                            {pitchSnap.name}
                            {pitchSnap.jersey != null ? (
                              <span className="font-semibold tabular-nums"> #{pitchSnap.jersey}</span>
                            ) : null}
                          </button>
                        ) : (
                          <>
                            <p className="text-base font-bold leading-tight text-[var(--text)] sm:text-lg">
                              {pitchSnap.name}
                            </p>
                            <span className="text-sm font-semibold tabular-nums text-[var(--text)] sm:text-base">
                              {pitchSnap.jersey != null ? `#${pitchSnap.jersey}` : "—"}
                            </span>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => setPitchesByInningModalOpen(true)}
                          disabled={pitcherGameIntelLoading}
                          className="pitch-pad-accent cursor-pointer rounded text-sm font-semibold tabular-nums underline decoration-[var(--accent)]/40 decoration-2 underline-offset-4 transition hover:decoration-[var(--accent)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 disabled:cursor-default disabled:no-underline sm:text-base"
                          title="View pitches by inning"
                        >
                          {pitcherGameIntelLoading
                            ? "…"
                            : `${pitcherPitchesThisInning ?? 0} pitches this inning`}
                        </button>
                      </div>
                      {pitchSnap.line1 ? (
                        <p className="min-w-0 flex-1 text-center text-sm font-semibold leading-snug text-[var(--text-muted)] sm:text-left sm:text-base">
                          {pitchSnap.line1}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {pitcherGameIntelLoading ? (
                  <p className="text-xs text-[var(--text-faint)]">Loading pitch mix…</p>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <MatchupPitchMixStrip
                      pas={gamePitchMixPasMerged}
                      pitchEvents={gamePitchMixEventsMerged}
                      distributionPitchEvents={gamePitchMixDistributionEventsMerged}
                      currentPitcherId={panelPitcherId}
                      compact
                      coachPad
                      coachPadExpanded
                      hideLobInRates
                      coachPadFullGame
                      onPitchTypeClick={openPitchTypeStats}
                    />
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {/* Fixed-height row at every breakpoint — long pitch sequences scroll inside, never resize the page */}
          <div className="flex h-[min(32dvh,17rem)] max-h-[min(32dvh,17rem)] min-h-0 w-full shrink-0 grow-0 flex-col gap-1.5 overflow-hidden pt-1.5 md:h-[min(42dvh,23rem)] md:max-h-[min(42dvh,23rem)] md:flex-row md:gap-2 md:pt-0 lg:h-[min(40dvh,21rem)] lg:max-h-[min(40dvh,21rem)] xl:gap-3">
            <section
              className="pitch-pad-matchup-panel flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border-2 p-1.5 md:min-w-0 md:flex-1 md:p-1.5 xl:p-2.5"
              aria-label="This game: batter vs current pitcher"
            >
              <div className="shrink-0 border-b border-[color-mix(in_srgb,var(--accent)_25%,var(--border))] pb-1">
                <h3 className="pitch-pad-accent text-center text-xs font-bold uppercase tracking-wide sm:text-sm">
                  {isOurTeamBatting
                    ? `Batter · pitch mix seen today`
                    : `Matchup · vs ${pitchSnapLoading ? "…" : (pitchSnap?.name ?? "pitcher")}`}
                </h3>
              </div>
              {!batterId ? (
                <p className="mt-3 text-center text-sm text-[var(--text-faint)]">
                  Set the batter on Record to see how this hitter has done against your pitcher today.
                </p>
              ) : !panelPitcherId ? (
                <p className="mt-3 text-center text-sm text-[var(--text-faint)]">
                  Set the pitcher on Record (mound pitcher on the PA form).
                </p>
              ) : batterIntelLoading ? (
                <p className="mt-3 text-center text-sm text-[var(--text-faint)]">Loading matchup…</p>
              ) : (
                <div className="mt-1 flex min-h-0 flex-1 flex-col overflow-hidden md:mt-1.5">
                  <CurrentBatterPitchDataCard
                    batterName={batterIntelDisplayName}
                    pas={matchupPasMerged}
                    pitchEvents={matchupEventsMerged}
                    distributionPitchEvents={matchupDistributionEventsMerged}
                    compact
                    coachPad
                    coachPadExpanded
                    onPitchTypeClick={openPitchTypeStats}
                    onNameClick={
                      batterId && panelPitcherId ? openMatchupGlance : undefined
                    }
                  />
                </div>
              )}
            </section>

            <aside
              className="pitch-pad-sequence-aside flex h-full max-h-full min-h-0 w-full shrink-0 grow-0 flex-col overflow-hidden rounded-xl border md:w-80 md:max-w-[32vw]"
              aria-label="This at-bat pitch sequence"
            >
              <div className="shrink-0 border-b border-[var(--border)] px-2 py-1 sm:px-2.5 md:py-1.5 xl:py-2.5">
                <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                  <h2 className="pitch-pad-accent text-xs font-bold uppercase tracking-wide sm:text-sm">
                    This AB
                  </h2>
                  <div
                    className="flex shrink-0 items-baseline gap-3 sm:gap-4"
                    aria-label={`Count ${headerCountBalls} and ${headerCountStrikes}, ${outs} out${outs === 1 ? "" : "s"}`}
                  >
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)] sm:text-[10px]">
                        Count
                      </span>
                      <span className="font-mono text-3xl font-bold tabular-nums leading-none text-[var(--text)] sm:text-4xl">
                        {headerCountBalls}-{headerCountStrikes}
                      </span>
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-[var(--text)] sm:text-sm">
                      {outs} out{outs === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </div>
              {sequenceRowsThisBatter.length === 0 ? (
                <p className="px-3 py-3 text-center text-sm leading-snug text-[var(--text-faint)]">
                  {pitchButtonsBlocked
                    ? "…"
                    : isOurTeamBatting
                      ? "No pitches yet — tap Fastball, Off-speed, or Breaking ball below."
                      : "No pitches yet — tap a type below."}
                </p>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {/* Cap visible list at ~5 pitch rows (row ≈ 2.875rem + gaps + padding); longer ABs scroll. */}
                  <ol
                    ref={sequenceListRef}
                    className="flex min-h-0 max-h-[16.75rem] flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-2 py-1.5 sm:px-2.5 md:max-h-[17.5rem] md:gap-2 md:py-2 xl:px-3"
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
                            isLatest ? "pitch-pad-sequence-latest" : "pitch-pad-sequence-row"
                          }`}
                        >
                        <div className="flex items-center gap-2 sm:gap-2.5">
                          <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-[var(--text)] sm:w-7 sm:text-sm">
                            #{r.pitch_number}
                          </span>
                          <span className="w-[3.75rem] shrink-0 whitespace-nowrap text-sm font-semibold text-[var(--text)] sm:w-[4.25rem]">
                            {resultLabel}
                          </span>
                          <div className="min-w-0 flex-1">
                            <CoachPitchCountTransition
                              beforeBalls={countBefore.balls}
                              beforeStrikes={countBefore.strikes}
                              after={countAfter}
                            />
                          </div>
                          <button
                            type="button"
                            disabled={r.pitch_type == null || isOurTeamBatting}
                            onClick={() => {
                              if (r.pitch_type != null && !isOurTeamBatting) openPitchTypeStats(r.pitch_type);
                            }}
                            className={`touch-manipulation inline-flex h-7 min-w-[2.25rem] shrink-0 cursor-pointer items-center justify-center rounded-md border px-1 text-xs font-bold transition hover:brightness-110 hover:shadow-[0_0_0.6rem_rgba(255,255,255,0.45)] active:scale-95 disabled:cursor-default disabled:hover:shadow-none disabled:active:scale-100 ${pitchTrackerTypeChipClass(r.pitch_type)}`}
                            title={pitchTrackerTypeLabel(r.pitch_type)}
                            aria-label={
                              r.pitch_type != null
                                ? `${pitchTrackerTypeLabel(r.pitch_type)} stats`
                                : undefined
                            }
                          >
                            {pitchTrackerAbbrev(r.pitch_type)}
                          </button>
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
        </div>
      </main>

      <footer className="pitch-pad-footer relative z-20 shrink-0 border-t-2 px-2 py-3 sm:px-4 sm:py-3.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {/* Overlay status so the footer never changes height (a growing footer squeezes the full-game panel above). */}
        {pitchLogBusy || pitchTypeCooldown ? (
          <p
            className={`pointer-events-none absolute inset-x-0 -top-6 mx-auto w-fit rounded-t-md px-3 py-1 text-center text-xs font-medium sm:text-sm ${
              pitchLogBusy
                ? "bg-[var(--bg-card)] text-[var(--accent)]"
                : "bg-[var(--bg-card)] text-[var(--text-muted)]"
            }`}
            role="status"
          >
            {pitchLogBusy ? "Saving pitch…" : "Ready for next pitch"}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex shrink-0 items-center justify-center gap-2 self-center sm:self-auto">
            <Link
              href="/coach"
              className="pitch-pad-btn-secondary touch-manipulation inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border px-4 text-sm font-semibold transition active:opacity-90 sm:min-h-[44px]"
              aria-label="Back to coach home"
            >
              <span className="text-base leading-none" aria-hidden>
                ←
              </span>
              <span>Back</span>
            </Link>
            <ThemeToggle variant="icon" className="!h-11 !w-11 shrink-0" />
          </div>
          <div
            className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-4 sm:gap-5"
            role="group"
            aria-label={isOurTeamBatting ? "Opponent pitch category" : "Pitch type"}
          >
            {activePitchTypes.map((t) => renderPitchTypeButton(t))}
          </div>
          <div className="flex shrink-0 items-center justify-center gap-3">
            <button
              type="button"
              disabled={
                pitchLogBusy || !supabase || !groupId || sequenceRowsThisBatter.length === 0
              }
              onClick={() => void undoLast()}
              className="pitch-pad-btn-secondary touch-manipulation min-h-[44px] min-w-[5.75rem] rounded-lg border px-4 text-sm font-semibold active:opacity-90 disabled:opacity-35"
            >
              Undo
            </button>
            <button
              type="button"
              disabled={
                pitchLogBusy || !supabase || !groupId || sequenceRowsThisBatter.length === 0
              }
              onClick={() => void resetAtBat()}
              className="pitch-pad-btn-accent-outline touch-manipulation min-h-[44px] min-w-[5.75rem] rounded-lg border px-4 text-sm font-semibold active:opacity-90 disabled:opacity-35"
            >
              Reset
            </button>
          </div>
        </div>
      </footer>

      {statPitchTypeDetail != null ? (
        <PitchTypeStatsModal
          detail={statPitchTypeDetail}
          pitcherName={pitchSnap?.name ?? "Pitcher"}
          onClose={() => setStatPitchType(null)}
        />
      ) : null}

      {matchupGlanceOpen ? (
        <MatchupGlanceModal
          open
          batter={matchupBatterPlayer}
          pitcher={matchupPitcherPlayer}
          gamePas={gamePitchMixPasMerged}
          onClose={() => setMatchupGlanceOpen(false)}
        />
      ) : null}

      {pitchesByInningModalOpen && panelPitcherId ? (
        <PitchesByInningModal
          open
          pitcherName={pitchSnap?.name ?? "Pitcher"}
          rows={pitchesByInningRows}
          totalPitches={pitchesByInningTotal}
          onClose={() => setPitchesByInningModalOpen(false)}
        />
      ) : null}
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
          moundPitcherId: sync.moundPitcherId,
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

  const featuredGame = useMemo(() => pickCoachDashboardGame(games), [games]);
  const otherGames = useMemo(() => {
    if (!featuredGame || games.length <= 1) return [];
    return games.filter((g) => g.id !== featuredGame.id);
  }, [games, featuredGame]);

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
        setGames(sortGamesForCoachSelect(rows.filter((g) => !isGameFinalized(g))));
        setGamesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

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
            moundPitcherId: sync.moundPitcherId,
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
          moundPitcherId: sync.moundPitcherId,
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
      <div className="coach-pitch-pad flex min-h-[100dvh] items-center justify-center bg-[var(--bg-base)] px-4 text-center text-lg text-[var(--text-muted)]">
        Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
      </div>
    );
  }

  if (resolving) {
    return (
      <div className="coach-pitch-pad flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-[var(--bg-base)] px-4 text-center">
        <p className="text-[var(--text-muted)]">Loading pitch pad…</p>
        {resolveError ? <p className="max-w-md text-sm text-[var(--danger)]">{resolveError}</p> : null}
      </div>
    );
  }

  if (session) {
    return <CoachPitchSessionLive session={session} setSession={setSession} />;
  }

  return (
    <PitchPadGamePicker
      games={games}
      gamesLoading={gamesLoading}
      featuredGame={featuredGame}
      otherGames={otherGames}
      resolveError={resolveError}
      resolving={resolving}
      onSelectGame={(id) => void enterPitchPadForGame(id)}
    />
  );
}
