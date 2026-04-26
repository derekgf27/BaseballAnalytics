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
import {
  COACH_LIVE_AB_PA_ID,
  displayCountFromPitchTrackerRows,
  pitchEventsFromCoachTrackerRows,
  pitchTypeMixEventsFromCoachTrackerRows,
} from "@/lib/compute/pitchTrackerCount";
import {
  coachPitchCountNewPitchTypeBlockReason,
  countAfterPitch,
  replayCountAtEndOfSequence,
} from "@/lib/compute/pitchSequence";
import type { PitchSequenceEntry } from "@/lib/compute/pitchSequence";
import { pitchingStatsFromPAs } from "@/lib/compute/pitchingStats";
import { isDemoId } from "@/lib/db/mockData";
import { formatDateMMDDYYYY, formatPPa } from "@/lib/format";
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
  line1: string;
  line2: string;
};

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
    <span className="inline-flex shrink-0 items-center gap-x-1.5 rounded-md border border-amber-500/40 bg-zinc-950/80 px-2 py-1 tabular-nums leading-none">
      <span className="text-xs text-zinc-500 sm:text-[13px]">{beforeBalls}-{beforeStrikes}</span>
      <span className="text-xs text-zinc-500 sm:text-[13px]" aria-hidden>
        →
      </span>
      <span className="text-xs font-bold text-amber-400 sm:text-[13px]">{tail}</span>
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

  const supabase = getSupabaseBrowserClient();
  const canLogPitch = !!(supabase && gameId && groupId && batterId);

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

  const sequenceRowsThisBatter = useMemo(() => {
    if (!batterId) return [];
    return sequenceRows.filter((r) => r.batter_id === batterId);
  }, [sequenceRows, batterId]);

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

  const lineupEntry = useMemo(
    () => (batterId ? opponentLineupByPlayerId[batterId] : null),
    [batterId, opponentLineupByPlayerId]
  );

  const lineupGuardLoading = ourLineupPlayerIds === null;
  const isOurTeamBatting = !!(batterId && ourLineupPlayerIds && ourLineupPlayerIds.has(batterId));

  const atBatPanel = useMemo(() => {
    type Segment = { key: string; text: string; className: string };
    if (!batterId) {
      return {
        title: "Set the batter on Record",
        segments: [{ key: "empty", text: "—", className: "text-zinc-500" }] as Segment[],
      };
    }
    if (opponentLineupLoading || batterProfileLoading) {
      return {
        title: undefined as string | undefined,
        segments: [{ key: "load", text: "…", className: "text-zinc-500" }] as Segment[],
      };
    }
    if (isOurTeamBatting) {
      return {
        title: "Our team is hitting — opponent pitcher on the mound",
        segments: [
          {
            key: "our-ab",
            text: "Our lineup (not shown)",
            className: "text-zinc-400 italic",
          },
        ] as Segment[],
      };
    }
    /** Always prefer `players` for the synced batter id — lineup card can be wrong-side if `our_side`/lineups mismatch. */
    const name = batterProfile?.name ?? lineupEntry?.name ?? null;
    const jersey = batterProfile?.jersey ?? lineupEntry?.jersey ?? null;
    const bats = batterProfile?.bats ?? lineupEntry?.bats ?? null;
    const battingOrder =
      batterSlot ??
      lineupBattingOrderByPlayerId[batterId] ??
      lineupEntry?.slot ??
      null;
    const jerseyPart = jersey != null ? `#${jersey}` : "—";
    const batsPart = batsHandLabel(bats);
    const displayName = name ?? "Unknown";
    const segments: Segment[] = [];
    if (battingOrder != null) {
      segments.push({
        key: "order",
        text: battingOrderOrdinal(battingOrder),
        className: "text-amber-400 tabular-nums",
      });
    }
    const identityClass = "text-zinc-100";
    segments.push({
      key: "name",
      text: displayName,
      className: identityClass,
    });
    segments.push({
      key: "jersey",
      text: jerseyPart,
      className: `${identityClass} font-mono tabular-nums`,
    });
    segments.push({
      key: "bats",
      text: batsPart,
      className: batsHandChipClass(bats, "prominent"),
    });
    const title = [battingOrder != null ? `${battingOrderOrdinal(battingOrder)} in lineup` : null, displayName, jersey != null ? `jersey #${jersey}` : null, bats != null ? `${batsHandLabel(bats)}-handed` : null]
      .filter(Boolean)
      .join(", ");
    return { title, segments };
  }, [
    batterId,
    batterSlot,
    lineupEntry,
    batterProfile,
    lineupBattingOrderByPlayerId,
    opponentLineupLoading,
    batterProfileLoading,
    isOurTeamBatting,
  ]);

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
    () => coachPitchCountNewPitchTypeBlockReason(sequenceRowsThisBatter),
    [sequenceRowsThisBatter]
  );
  const pitchTypesLocked = pitchTypeBlockReason != null;
  /** Pitch-type pad is only for when we're on defense (opponent batting). */
  const pitchDefenseOnlyBlocked = lineupGuardLoading || isOurTeamBatting;
  const canLogPitchType = canLogPitch && !pitchTypesLocked && !pitchDefenseOnlyBlocked;

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

  /** Pitch type only — ball/strike outcomes live on the analyst PA form. Fills first typeless row if Record created it. */
  const logPitch = async (pitch_type: PitchTrackerPitchType) => {
    if (!supabase || !gameId || !groupId || !batterId) return;
    if (pitchDefenseOnlyBlocked) return;
    const batterRows = batterId ? rows.filter((r) => r.batter_id === batterId) : rows;
    const block = coachPitchCountNewPitchTypeBlockReason(
      [...batterRows].sort((a, b) => a.pitch_number - b.pitch_number)
    );
    if (block === "strikes") {
      setError("This AB already has 3 strikes — finish the PA in Record, or Undo / Reset AB.");
      return;
    }
    if (block === "balls") {
      setError("This AB already has 4 balls — finish the PA in Record, or Undo / Reset AB.");
      return;
    }
    setError(null);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(12);
      }
    } catch {
      /* ignore */
    }
    const awaitingType = [...batterRows]
      .filter((r) => r.pitch_type == null)
      .sort((a, b) => a.pitch_number - b.pitch_number)[0];
    if (awaitingType) {
      const { error: upErr } = await supabase
        .from("pitches")
        .update({ pitch_type, pitcher_id: pitcherId })
        .eq("id", awaitingType.id);
      if (upErr) {
        setError(upErr.message);
        return;
      }
    } else {
      const maxNum = batterRows.length > 0 ? Math.max(...batterRows.map((r) => r.pitch_number)) : 0;
      const pitch_number = maxNum + 1;
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
        setError(insErr.message);
        return;
      }
    }
    setFlashType(pitch_type);
    setToast(`${pitchTrackerTypeLabel(pitch_type)} recorded`);
    void refresh();
  };

  const undoLast = async () => {
    const pool = batterId ? rows.filter((r) => r.batter_id === batterId) : rows;
    if (!supabase || !groupId || pool.length === 0) return;
    const last = pool.reduce((a, b) => (a.pitch_number >= b.pitch_number ? a : b));
    const { error: delErr } = await supabase.from("pitches").delete().eq("id", last.id);
    if (delErr) setError(delErr.message);
    else void refresh();
  };

  const resetAtBat = async () => {
    if (!supabase || !groupId) return;
    let q = supabase.from("pitches").delete().eq("tracker_group_id", groupId);
    if (batterId) q = q.eq("batter_id", batterId);
    const { error: delErr } = await q;
    if (delErr) setError(delErr.message);
    else void refresh();
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <section className="min-w-0 shrink-0 lg:max-w-md" aria-label="Pitcher this game">
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
              <div className="mt-2 min-w-0 space-y-2">
                <p className="truncate text-base font-bold tracking-tight text-zinc-100 sm:text-lg">
                  {pitchSnap.name}
                </p>
                <p className="text-sm font-semibold leading-relaxed tracking-tight text-zinc-200 tabular-nums sm:text-base">
                  {pitchSnap.line1}
                </p>
                {pitchSnap.line2 ? (
                  <p className="text-xs font-medium leading-relaxed text-zinc-400 tabular-nums sm:text-sm">
                    {pitchSnap.line2}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-zinc-500">Could not load pitcher stats.</p>
            )}
          </section>
          {pitcherId ? (
            <section
              className="min-w-0 flex-1 border-t border-zinc-800 pt-3 lg:border-l lg:border-t-0 lg:pt-0 lg:pl-5"
              aria-label="Full game pitch data for this pitcher"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 sm:text-sm">
                Pitch data · full game vs {pitchSnapLoading ? "…" : (pitchSnap?.name ?? "pitcher")}
              </p>
              {pitcherGameIntelLoading ? (
                <p className="mt-2 text-sm text-zinc-500">Loading game pitch data…</p>
              ) : (
                <div className="mt-2 min-w-0">
                  <MatchupPitchMixStrip
                    pas={gamePitchMixPasMerged}
                    pitchEvents={gamePitchMixEventsMerged}
                    distributionPitchEvents={gamePitchMixDistributionEventsMerged}
                    currentPitcherId={pitcherId}
                    compact
                  />
                </div>
              )}
            </section>
          ) : null}
        </div>
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
                ? "3 strikes — log the out in Record, or Undo last pitch / Reset AB to keep tracking."
                : "4 balls — log the walk in Record, or Undo last pitch / Reset AB to keep tracking."}
            </p>
          ) : null}
          <div className="grid w-full shrink-0 grid-cols-4 content-start items-start gap-2 auto-rows-auto sm:gap-3 md:gap-4">
            {PITCH_TRACKER_TYPES.map((t) => {
              const flashed = flashType === t;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={!canLogPitchType}
                  onClick={() => void logPitch(t)}
                  className={`flex h-16 max-h-16 min-h-0 w-full min-w-0 shrink-0 items-center justify-center self-start rounded-lg border-2 px-1.5 py-2 shadow transition active:scale-[0.98] disabled:opacity-40 sm:h-20 sm:max-h-20 sm:px-2 sm:py-2.5 ${pitchTrackerCoachButtonClass(t)} ${
                    flashed ? "ring-2 ring-white/80 ring-offset-2 ring-offset-zinc-950" : ""
                  }`}
                >
                  <span className="line-clamp-2 max-w-full min-h-0 break-words text-center text-base font-semibold leading-[1.08] text-balance sm:text-lg">
                    {pitchTrackerTypeLabel(t)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 flex-wrap justify-center gap-2 pt-1">
            <button
              type="button"
              disabled={!supabase || !groupId || sequenceRowsThisBatter.length === 0}
              onClick={() => void undoLast()}
              className="min-h-[44px] min-w-[120px] rounded-lg border border-zinc-600 bg-zinc-900 px-4 text-sm font-semibold text-zinc-200 active:bg-zinc-800 disabled:opacity-35"
            >
              Undo last
            </button>
            <button
              type="button"
              disabled={!supabase || !groupId || sequenceRowsThisBatter.length === 0}
              onClick={() => void resetAtBat()}
              className="min-h-[44px] min-w-[120px] rounded-lg border border-amber-700/60 bg-amber-950/40 px-4 text-sm font-semibold text-amber-100 active:bg-amber-950/70 disabled:opacity-35"
            >
              Reset AB
            </button>
          </div>

          <div className="mt-2 flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-4">
            <section
              className="w-full max-w-[min(17.5rem,calc(100%-0.5rem))] shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/50 px-2 py-2 sm:max-w-[min(19.5rem,calc(100%-0.5rem))] sm:px-2.5 sm:py-2 lg:self-start"
              aria-label="Opposing lineup"
            >
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Opposing lineup
              </h3>
              {opponentLineupLoading ? (
                <p className="mt-2 text-xs text-zinc-500">Loading lineup…</p>
              ) : opposingLineupBoard.ordered.length === 0 ? (
                <p className="mt-2 text-xs leading-snug text-zinc-500">
                  No opponent lineup in this game yet (set lineups on Record).
                </p>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {opposingLineupBoard.ordered.map((row) => {
                    const atBat = !!(batterId && row.playerId === batterId);
                    const onDeck =
                      !atBat &&
                      opposingLineupBoard.onDeckPlayerId != null &&
                      row.playerId === opposingLineupBoard.onDeckPlayerId;
                    const jerseyStr =
                      row.jersey != null ? `#${row.jersey}` : "—";
                    return (
                      <li
                        key={row.playerId}
                        className={`flex min-w-0 items-center gap-1.5 rounded-lg py-0.5 pl-0.5 pr-1 text-xs sm:gap-2 sm:text-[13px] ${
                          atBat
                            ? "bg-amber-950/45 ring-1 ring-amber-600/40"
                            : onDeck
                              ? "bg-zinc-800/80 ring-1 ring-zinc-600/50"
                              : ""
                        }`}
                      >
                        <span className="w-8 shrink-0 tabular-nums font-semibold text-amber-400 sm:w-9">
                          {battingOrderOrdinal(row.slot)}
                        </span>
                        <div className="flex min-w-0 flex-1 items-center gap-x-1">
                          <span className="min-w-0 truncate font-medium text-zinc-100">
                            {row.name}
                          </span>
                          <span className="shrink-0 font-mono tabular-nums text-zinc-100">
                            {jerseyStr}
                          </span>
                          <span className={batsHandChipClass(row.bats, "compact")}>
                            {batsHandLabel(row.bats)}
                          </span>
                        </div>
                        <div className="flex w-7 shrink-0 justify-end">
                          {atBat ? (
                            <span
                              className="rounded bg-amber-600/25 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200"
                              title="At bat"
                            >
                              AB
                            </span>
                          ) : onDeck ? (
                            <span
                              className="rounded bg-zinc-700/80 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300"
                              title="On deck"
                            >
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

            <section
              className="flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 px-2 py-2 sm:px-2.5 sm:py-2"
              aria-label="This game: batter vs current pitcher"
            >
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                This game vs{" "}
                <span className="text-zinc-400">
                  {pitcherId
                    ? pitchSnapLoading
                      ? "…"
                      : (pitchSnap?.name ?? "pitcher")
                    : "pitcher"}
                </span>
              </h3>
              {!batterId ? (
                <p className="mt-2 text-xs leading-snug text-zinc-500">
                  Set the batter on Record to see pitch mix and results from earlier PAs in this game.
                </p>
              ) : !pitcherId ? (
                <p className="mt-2 text-xs leading-snug text-zinc-500">
                  Set the pitcher on Record (mound pitcher on the PA form) to see how this batter has
                  fared against them today.
                </p>
              ) : isOurTeamBatting ? (
                <p className="mt-2 text-xs leading-snug text-zinc-500">
                  Pitch mix for this spot is hidden while we hit. It shows again when an opponent batter
                  is synced from Record.
                </p>
              ) : batterIntelLoading ? (
                <p className="mt-2 text-xs text-zinc-500">Loading matchup…</p>
              ) : (
                <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain">
                  <CurrentBatterPitchDataCard
                    batterName={batterIntelDisplayName}
                    pas={matchupPasMerged}
                    pitchEvents={matchupEventsMerged}
                    distributionPitchEvents={matchupDistributionEventsMerged}
                    compact
                  />
                  {batterIntelPas.length === 0 && livePitchEventsForCard.length === 0 ? (
                    <p className="text-[11px] leading-snug text-zinc-500">
                      No completed plate appearances vs this pitcher in this game yet. Numbers fill in
                      as Record saves PAs and pitch logs.
                    </p>
                  ) : null}
                </div>
              )}
            </section>
          </div>
        </div>

        <aside
          className="flex max-h-[min(52dvh,28rem)] min-h-0 w-full shrink-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 md:max-h-[calc(100dvh-8rem)] md:min-w-[13rem] md:w-[min(46vw,20rem)] md:max-w-[50%] md:self-stretch lg:min-w-[15rem] lg:w-[min(42vw,22rem)]"
          aria-label="This at-bat pitch sequence"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800 px-3 py-1.5 sm:px-3.5 sm:py-2">
            <span className="shrink-0 text-xs font-semibold text-zinc-400 sm:text-sm">At bat</span>
            <span
              className="min-w-0 truncate text-right text-xs font-semibold sm:text-sm"
              title={atBatPanel.title}
            >
              {atBatPanel.segments.map((seg, i) => (
                <span key={seg.key}>
                  {i > 0 ? (
                    <span className="font-semibold text-zinc-600" aria-hidden>
                      {" "}
                      ·{" "}
                    </span>
                  ) : null}
                  <span className={seg.className}>{seg.text}</span>
                </span>
              ))}
            </span>
          </div>
          <div className="shrink-0 border-b border-zinc-800 px-3 py-2 sm:px-3.5 sm:py-2.5">
            <p className="text-sm text-zinc-400">
              Count{" "}
              <span className="font-mono text-base font-bold tabular-nums text-white sm:text-lg">
                {headerCountBalls}-{headerCountStrikes}
              </span>
              <span className="mx-2 text-zinc-600">·</span>
              <span className="text-sm text-zinc-300">{outs} out{outs === 1 ? "" : "s"}</span>
            </p>
          </div>
          <h2 className="shrink-0 border-b border-zinc-800 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 sm:px-3.5 sm:text-xs">
            This AB
          </h2>
          {sequenceRowsThisBatter.length === 0 ? (
            <p className="px-3 py-3 text-sm leading-snug text-zinc-500 sm:px-4">
              {pitchDefenseOnlyBlocked
                ? lineupGuardLoading
                  ? "…"
                  : "No pitch types while we bat. When the opponent is up, tap pitch types here."
                : "No pitches yet — tap a pitch type. Log ball/strike on the PA form in Record."}
            </p>
          ) : (
            <ol className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-2.5 py-2.5 sm:gap-2 sm:px-3 sm:py-3">
              {sequenceRowsThisBatter.map((r, idx) => {
                const resultLabel = pitchTrackerLogResultShortLabel(r.result);
                const priorEntries: PitchSequenceEntry[] = sequenceRowsThisBatter
                  .slice(0, idx)
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
                return (
                  <li
                    key={r.id}
                    className="rounded-lg border border-amber-500/25 bg-zinc-950/50 px-2.5 py-2 sm:px-3 sm:py-2.5"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="shrink-0 tabular-nums text-xs font-semibold text-zinc-500 sm:text-sm">
                          #{r.pitch_number}
                        </span>
                        <span className="min-w-0 shrink-0 text-sm font-semibold leading-tight text-zinc-100 sm:text-base">
                          {resultLabel}
                        </span>
                        <CoachPitchCountTransition
                          beforeBalls={countBefore.balls}
                          beforeStrikes={countBefore.strikes}
                          after={countAfter}
                        />
                      </div>
                      <span
                        className={`inline-flex h-7 min-w-[2.25rem] shrink-0 items-center justify-center rounded-md border px-1.5 text-xs font-bold leading-none sm:h-8 sm:min-w-[2.5rem] sm:text-sm ${pitchTrackerTypeChipClass(r.pitch_type)}`}
                        title={pitchTrackerTypeLabel(r.pitch_type)}
                      >
                        {pitchTrackerAbbrev(r.pitch_type)}
                      </span>
                    </div>
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
