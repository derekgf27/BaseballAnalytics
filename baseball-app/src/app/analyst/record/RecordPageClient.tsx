"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BaseStateSelector } from "@/components/shared/BaseStateSelector";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { BoxScoreLine } from "@/components/analyst/BoxScoreLine";
import { PitchTypeStatsModal } from "@/components/coach/PitchTypeStatsModal";
import { pitchTypeGameDetailFromPas } from "@/lib/compute/pitchTypeGameDetail";
import { RecordBoxScoreSection } from "@/components/record/RecordBoxScoreSection";
import { RecordLastPaSummary } from "@/components/record/RecordLastPaSummary";
import { RecordPrimaryActions } from "@/components/record/RecordPrimaryActions";
import { QuickAddPlayerModal, type QuickAddPlayerCreatedPayload } from "@/components/analyst/QuickAddPlayerModal";
import {
  QuickAddPitcherModal,
  type QuickAddPitcherCreatedPayload,
} from "@/components/analyst/QuickAddPitcherModal";
import { insertPlayerAction } from "@/app/analyst/roster/actions";
import { setGameStartingPitcherIfEmptyAction } from "@/app/analyst/record/actions";
import { formatDateMMDDYYYY } from "@/lib/format";
import { isGameFinalized } from "@/lib/gameRecord";
import { analystGameLogHref, analystGameReviewHref } from "@/lib/analystRoutes";
import { clearPAsForGameAction } from "@/app/analyst/games/actions";
import { isDemoId } from "@/lib/db/mockData";
import { plateAppearancesForPitchingSide } from "@/lib/compute/gamePitchingBox";
import { totalRunsBottom, totalRunsTop } from "@/lib/compute/boxScore";
import { lastPaChronological } from "@/lib/compute/plateAppearanceOrder";
import { isFactoryDefaultRecordForm } from "@/lib/record/recordFormSnapshot";
import {
  clearUnavailablePlayers,
  readUnavailablePlayers,
  writeUnavailablePlayers,
  type UnavailableBySide,
} from "@/lib/record/recordUnavailablePlayers";
import { pitchEventsFromDraftPitchLogWithTerminal } from "@/lib/compute/contactProfileFromPas";
import {
  clampPitchCountBefore,
  hasPutawayStrikeAtTwoStrikes,
  isPitchOutcomeBlockedByFullCount,
  replayCountAtEndOfSequence,
  resultImpliesBattedBallInPlay,
  summarizePitchSequence,
  withInferredTerminalOutcomePitches,
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
  COACH_LIVE_AB_PA_ID,
  coachPitchRowByAbIndex as buildCoachPitchRowByAbIndex,
  mapCoachPitchTypesToSequence,
  mergeTrackerPitchesIntoPitchEvents,
  nextOpenPitchNumberInGroup,
  recordLiveTrackerSyntheticPa,
  sortCoachPitchRowsForAb,
} from "@/lib/compute/pitchTrackerCount";
import {
  pitchOutcomeToTrackerLogResult,
  pitchTrackerAbbrev,
  pitchTrackerTypeChipClass,
  pitchTrackerTypeLabel,
} from "@/lib/pitchTrackerUi";
import { useMediaQueryLg } from "@/hooks/useMediaQueryLg";
import { usePitchTrackerRows } from "@/hooks/usePitchTrackerRows";
import { usePitchTrackerPadPresence } from "@/hooks/usePitchTrackerPadPresence";
import { resolvePitchTrackerPadHealthAlert } from "@/lib/record/pitchTrackerPadHealth";
import { RecordPitchPadHealthBanner } from "@/components/record/RecordPitchPadHealthBanner";
import { useRecordKeyboardShortcuts } from "@/hooks/useRecordKeyboardShortcuts";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  RESULT_ALLOWS_HIT_DIRECTION,
  RESULT_IS_HIT,
} from "@/lib/paResultSets";
import {
  isClubRosterPlayer,
  isPitcherPlayer,
  matchupLabelUsFirst,
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
  PitchTrackerPitchType,
  Throws,
  Bats,
} from "@/lib/types";
import { PitchPadCountTransition } from "@/components/record/PitchPadCountTransition";
import { RecordPageToast } from "@/components/record/RecordPageToast";

const FinalizeGameModal = dynamic(
  () => import("@/app/analyst/record/FinalizeGameModal").then((m) => ({ default: m.FinalizeGameModal })),
  { ssr: false }
);
const ReachedOnErrorFielderModal = dynamic(
  () =>
    import("@/components/analyst/ReachedOnErrorFielderModal").then((m) => ({
      default: m.ReachedOnErrorFielderModal,
    })),
  { ssr: false }
);
const RecordPitcherChangeModal = dynamic(
  () =>
    import("@/components/analyst/RecordPitcherChangeModal").then((m) => ({
      default: m.RecordPitcherChangeModal,
    })),
  { ssr: false }
);
const RecordSubstitutionModal = dynamic(
  () =>
    import("@/components/analyst/RecordSubstitutionModal").then((m) => ({
      default: m.RecordSubstitutionModal,
    })),
  { ssr: false }
);
const RecordShortcutsHelpModal = dynamic(
  () =>
    import("@/components/record/RecordShortcutsHelpModal").then((m) => ({
      default: m.RecordShortcutsHelpModal,
    })),
  { ssr: false }
);
const CurrentBatterPitchDataCard = dynamic(
  () =>
    import("@/components/analyst/BattingPitchMixCard").then((m) => ({
      default: m.CurrentBatterPitchDataCard,
    })),
  { ssr: false, loading: () => <div className="h-28 animate-pulse rounded-lg bg-[var(--bg-elevated)]" /> }
);
const BattingPitchMixCard = dynamic(
  () =>
    import("@/components/analyst/BattingPitchMixCard").then((m) => ({ default: m.BattingPitchMixCard })),
  { ssr: false, loading: () => <div className="h-28 animate-pulse rounded-lg bg-[var(--bg-elevated)]" /> }
);
import {
  BATTED_BALL_TYPE_OPTIONS,
  PITCH_LOG_BUTTONS,
  PITCH_SEQUENCE_ROW_CLASS,
  PITCH_SEQUENCE_VISIBLE_ROWS,
  PLAY_ABBREVIATIONS,
  PLAY_PRESETS,
  RESULT_ADDS_ONE_OUT,
  RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT,
  RESULT_GROUPS,
  RESULT_IS_OUT,
  RESULT_OPTIONS,
} from "@/lib/record/recordPageConstants";
import { batterBatsLetter, batterSelectOptionText } from "@/lib/record/recordBatterSelect";
import { parsePersistedBattedBallType } from "@/lib/record/recordBattedBall";
import { useRecordAtBatForm } from "@/hooks/useRecordAtBatForm";
import { recordFormStorageKey } from "@/lib/record/recordFormStorage";
import { isRemoteFormNewer, nextFormRevision } from "@/lib/record/recordFormRevision";
import { throwsToPitcherHand } from "@/lib/record/recordKeyboard";
import {
  freshGameRecordBatterState,
  inferRecordBatterFromExistingPAs,
} from "@/lib/record/recordEntryBatter";
import { batterIdAtLineupSlot, lineupSlotForBatterId } from "@/lib/record/recordLineup";
import {
  applyPlayerToLineupSlot,
  lineupSlotsForSave,
} from "@/lib/record/recordLineupSlots";
import {
  outcomeShortcutDigit,
  pitchCountBlockHint,
  requiresRunnerOnBaseForResult,
  resultBlockedByPitchCount,
  isWalkOrHbpResult,
} from "@/lib/record/recordPaOutcome";
import {
  computeShowEarnedUnearnedRunControls,
  persistPlateAppearanceErrorFielderId,
  playerIdsWhoReachedOnErrorFromPas,
  unearnedScorerIdsForSave,
} from "@/lib/record/recordPaFielding";
import {
  PITCH_LOG_CLEAR_PAD_CLASS,
  PITCH_LOG_UNDO_PAD_CLASS,
  pitchLogOutcomePadClass,
  pitchLogOutcomeSequenceBorderClass,
} from "@/lib/record/recordPitchLogUi";
import {
  persistPitchTrackerBatterToGame,
  persistPitchTrackerCountToGame,
  persistPitchTrackerGroupToGame,
  persistPitchTrackerMoundPitcherToGame,
  persistPitchTrackerOutsToGame,
  persistPitchTrackerPitcherToGame,
} from "@/lib/record/recordPitchTrackerSync";
import { formatPlayWithDashes } from "@/lib/record/recordPlayNotes";
import {
  advanceRunnersAfterStolenBase,
  baseStateFromRunnerIds,
  clearScoredRunnersFromSlots,
  getRunnerIdsAfterResult,
  hasRunnersOnBaseForm,
  normBaseStateBits,
  occupiedRunnerIdsFromForm,
  removeRunnerAfterCaughtStealing,
  validateStealAttempt,
} from "@/lib/record/recordRunnerState";
import type {
  DraftPitchRow,
  LastSavedPaSummary,
  PersistedRecordFormState,
  RecordResumeSnapshotV1,
} from "@/lib/record/recordPageTypes";
import { mergeWorkflowDefaultsForGame, readWorkflowDefaults } from "@/lib/record/recordWorkflowStorage";

interface RecordPageClientProps {
  game: Game | null;
  players: Player[];
  /** Game to record (from `?gameId=`). No in-form game switching — open from Games → Log → Record. */
  initialGameId?: string;
  fetchPAsForGame: (gameId: string) => Promise<{
    pas: PlateAppearance[];
    pitchEvents: PitchEvent[];
    distributionPitchEvents: PitchEvent[];
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
    finalAway: number,
    options?: {
      winningPitcherId?: string | null;
      savePitcherId?: string | null;
      losingPitcherId?: string | null;
    }
  ) => Promise<{ ok: boolean; error?: string }>;
  linkPitchTrackerGroupToPa: (
    trackerGroupId: string,
    paId: string
  ) => Promise<{ ok: boolean; error?: string }>;
}

/** While we hit, coach rows may use a different/null `pitcher_id` than Record's mound pitcher. */
function coachPitchRowMatchesAb(
  row: { batter_id?: string | null; pitcher_id?: string | null },
  batterId: string | null,
  pitcherId: string | null,
  ourSide: string | null | undefined,
  inningHalf: "top" | "bottom" | null | undefined
): boolean {
  if (batterId && row.batter_id && row.batter_id !== batterId) return false;
  const offenseAb =
    (ourSide === "home" || ourSide === "away") &&
    battingSideFromHalf(inningHalf ?? "top") === ourSide;
  return offenseAb || !row.pitcher_id || !pitcherId || row.pitcher_id === pitcherId;
}

export default function RecordPageClient({
  game,
  players: initialPlayers,
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
  const [players, setPlayers] = useState(initialPlayers);
  useEffect(() => {
    setPlayers(initialPlayers);
  }, [initialPlayers]);
  /** Fixed for this page load from URL; use Games → Log to change game. */
  const selectedGameId = initialGameId ?? null;
  const {
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
    errorFielderId,
    hitDirection,
    battedBallType,
    pitcherId,
    pitcherBySide,
    pitchesSeen,
    strikesThrown,
    firstCountFromZero,
    playNote,
    notes,
    nextBatterIndexBySide,
    battingTablePeekOther,
    draftPitchLog,
    setInning,
    setInningHalf,
    setOuts,
    setBaseState,
    setRunnerOn1bId,
    setRunnerOn2bId,
    setRunnerOn3bId,
    setBatterId,
    setResult,
    setCountBalls,
    setCountStrikes,
    setRbi,
    setRunsScoredPlayerIds,
    setUnearnedRunsScoredPlayerIds,
    setInheritedForPriorPitcher,
    setErrorFielderId,
    setHitDirection,
    setBattedBallType,
    setPitcherId,
    setPitcherBySide,
    setPitchesSeen,
    setStrikesThrown,
    setFirstCountFromZero,
    setPlayNote,
    setNotes,
    setNextBatterIndexBySide,
    setBattingTablePeekOther,
    setDraftPitchLog,
    applySavedFormFromStorage: applyAtBatPersisted,
    resetFormEmpty,
    clearNewPaDraftFields: clearAtBatNewPaDraft,
    clearAtBatForm,
  } = useRecordAtBatForm(null);
  const [showDetails, setShowDetails] = useState(false);
  const [errorFielderModalMode, setErrorFielderModalMode] = useState<null | "roe" | "hit">(null);
  const prevResultBeforeRoeModalRef = useRef<PAResult | null>(null);
  const prevErrorFielderIdBeforeRoeModalRef = useRef<string | null>(null);
  const hrScorersSeededRef = useRef(false);
  const [baserunningEvents, setBaserunningEvents] = useState<BaserunningEvent[]>([]);
  const draftPitchLogEmptyRef = useRef(true);
  const recordLockedRef = useRef(false);
  const [pitchTrackerGroupId, setPitchTrackerGroupId] = useState<string | null>(null);
  const pitchEventsByGameRef = useRef<PitchEvent[]>([]);
  const countSnapRef = useRef({ balls: 0, strikes: 0 });
  countSnapRef.current = { balls: countBalls, strikes: countStrikes };
  const batterSelectRef = useRef<HTMLSelectElement>(null);
  const pitchSequenceScrollRef = useRef<HTMLDivElement>(null);
  const pitchSequenceEndRef = useRef<HTMLLIElement>(null);
  const formHydratedForGameRef = useRef<string | null>(null);
  const loadPasRequestIdRef = useRef(0);
  const resumeStackByGameRef = useRef<Map<string, RecordResumeSnapshotV1[]>>(new Map());
  const [saving, setSaving] = useState(false);
  const [substitutionModalOpen, setSubstitutionModalOpen] = useState(false);
  const [quickAddPlayerOpen, setQuickAddPlayerOpen] = useState(false);
  const [quickAddPitcherOpen, setQuickAddPitcherOpen] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(true);
  const [pitcherChangeModalOpen, setPitcherChangeModalOpen] = useState(false);
  const [clearingPAs, setClearingPAs] = useState(false);
  const [destructiveConfirm, setDestructiveConfirm] = useState<null | "undoLastPa" | "clearGamePas">(null);
  const [destructivePending, setDestructivePending] = useState(false);
  const [finalizingGame, setFinalizingGame] = useState(false);
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
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
  /** Pitch types for mix strip (includes coach iPad types before ball/strike is set). */
  const [gamePitchDistributionEvents, setGamePitchDistributionEvents] = useState<PitchEvent[]>([]);
  const [lineupAway, setLineupAway] = useState<{
    order: string[];
    positionByPlayerId: Record<string, string>;
  }>({ order: [], positionByPlayerId: {} });
  const [lineupHome, setLineupHome] = useState<{
    order: string[];
    positionByPlayerId: Record<string, string>;
  }>({ order: [], positionByPlayerId: {} });
  /** Players subbed out for this game (per team); persisted in localStorage for the session. */
  const [unavailableBySide, setUnavailableBySide] = useState<UnavailableBySide>({
    away: [],
    home: [],
  });
  /** Two-column box score: shared heading row only at lg+ (see GameBattingTable / GamePitchingBoxTable hideHeading). */
  const isLg = useMediaQueryLg();
  const [lastSavedPaSummary, setLastSavedPaSummary] = useState<LastSavedPaSummary | null>(null);
  /** Mirrors last persist payload for synchronous flush on tab hide / beforeunload. */
  const recordFormSnapshotRef = useRef<PersistedRecordFormState | null>(null);
  const formRevisionRef = useRef(0);
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
      setUnavailableBySide({ away: [], home: [] });
      return;
    }
    setUnavailableBySide(readUnavailablePlayers(selectedGameId));
  }, [selectedGameId]);

  useEffect(() => {
    if (!selectedGameId) {
      setPitchTrackerGroupId(null);
      return;
    }
    if (game?.id === selectedGameId && game.pitch_tracker_group_id) {
      setPitchTrackerGroupId(game.pitch_tracker_group_id);
      writeStoredPitchTrackerGroupId(selectedGameId, game.pitch_tracker_group_id);
      return;
    }
    const existing = readStoredPitchTrackerGroupId(selectedGameId);
    const id = existing && existing.length > 0 ? existing : newPitchTrackerGroupId();
    if (!existing) writeStoredPitchTrackerGroupId(selectedGameId, id);
    setPitchTrackerGroupId(id);
    void persistPitchTrackerGroupToGame(selectedGameId, id);
  }, [selectedGameId, game]);

  useEffect(() => {
    const sync = () => setNetworkOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

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
    realtimeOk: coachPitchesRealtimeOk,
    fetchError: coachPitchesFetchError,
  } = usePitchTrackerRows(selectedGameId && pitchTrackerGroupId ? pitchTrackerGroupId : null);

  const { coachPadConnected, everConnected: coachPadEverConnected } = usePitchTrackerPadPresence(
    pitchTrackerGroupId,
    "monitor"
  );

  const coachRowsThisAb = useMemo(() => {
    const ourSide = selectedGameId && game?.id === selectedGameId ? game.our_side : undefined;
    return coachPitchRows.filter((r) =>
      coachPitchRowMatchesAb(r, batterId, pitcherId, ourSide, inningHalf)
    );
  }, [coachPitchRows, batterId, pitcherId, selectedGameId, game, inningHalf]);
  const coachPitchRowByAbIndex = useMemo(
    () => buildCoachPitchRowByAbIndex(coachRowsThisAb),
    [coachRowsThisAb]
  );
  /** Show coach iPad rows even before the analyst taps the pitch log for that pitch. */
  const mergedSequenceLength = Math.max(draftPitchLog.length, coachRowsThisAb.length);
  const coachTypesAwaitingLog = Math.max(0, coachRowsThisAb.length - draftPitchLog.length);

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
    const s = summarizePitchSequence(withInferredTerminalOutcomePitches(entries, result));
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
   * Default to 1 pitch / 1 strike (first-pitch swing/contact → FPS yes) so quick saves don't require typing totals.
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
    } else if (result != null && isWalkOrHbpResult(result)) {
      if (pitchesSeen === "") setPitchesSeen(1);
      setStrikesThrown((s) => (s === "" || s === 0 ? 0 : s));
    } else if (
      prev != null &&
      resultImpliesBattedBallInPlay(prev) &&
      (result === null || !resultImpliesBattedBallInPlay(result))
    ) {
      setPitchesSeen((p) => (p === 1 ? "" : p));
      setStrikesThrown((s) => (s === 1 ? "" : s));
    } else if (prev != null && isWalkOrHbpResult(prev) && !isWalkOrHbpResult(result)) {
      setPitchesSeen((p) => (p === 1 ? "" : p));
      setStrikesThrown((s) => (s === 0 || s === "" ? "" : s));
    }
    prevResultForBipDefaultsRef.current = result;
  }, [result, draftPitchLog.length]);

  useEffect(() => {
    if (result == null) return;
    if (result === "reached_on_error") return;
    if (result === "hr") {
      setErrorFielderId(null);
      return;
    }
    if (RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT.has(result)) return;
    if (!hasRunnersOnBaseForm(baseState)) {
      setErrorFielderId(null);
    }
  }, [result, baseState]);

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

  const selectedGame = selectedGameId && game?.id === selectedGameId ? game : null;
  const recordLocked = selectedGame != null && isGameFinalized(selectedGame);
  const selectedBatter = players.find((p) => p.id === batterId);
  draftPitchLogEmptyRef.current = draftPitchLog.length === 0;
  recordLockedRef.current = recordLocked;

  const pitchPadHealthAlert = useMemo(
    () =>
      resolvePitchTrackerPadHealthAlert({
        enabled: Boolean(selectedGameId && pitchTrackerGroupId && !recordLocked),
        coachPadConnected,
        everConnected: coachPadEverConnected,
        realtimeOk: coachPitchesRealtimeOk,
        fetchError: coachPitchesFetchError,
        networkOnline,
        coachTypesAwaitingLog,
      }),
    [
      selectedGameId,
      pitchTrackerGroupId,
      recordLocked,
      coachPadConnected,
      coachPadEverConnected,
      coachPitchesRealtimeOk,
      coachPitchesFetchError,
      networkOnline,
      coachTypesAwaitingLog,
    ]
  );

  const syncCoachPitchResultsSeqRef = useRef(0);
  useEffect(() => {
    const sb = getSupabaseBrowserClient();
    if (!sb || !pitchTrackerGroupId || recordLocked || !selectedGameId || isDemoId(selectedGameId)) {
      return;
    }
    const groupId = pitchTrackerGroupId;
    const log = draftPitchLog;
    const seq = ++syncCoachPitchResultsSeqRef.current;
    void (async () => {
      try {
        const n = log.length;
        if (n === 0) {
          const { error } = await sb.from("pitches").update({ result: null }).eq("tracker_group_id", groupId);
          if (error) console.warn("[Record] Clear coach pitch results:", error.message);
          const { error: delStubErr } = await sb
            .from("pitches")
            .delete()
            .eq("tracker_group_id", groupId)
            .is("pitch_type", null);
          if (delStubErr) console.warn("[Record] Remove PA-only pitch rows:", delStubErr.message);
        } else {
          if (!batterId) return;
          const ourSide = selectedGame?.our_side;
          const coachRowsForAb = sortCoachPitchRowsForAb(
            coachPitchRows.filter((r) =>
              coachPitchRowMatchesAb(r, batterId, pitcherId, ourSide, inningHalf)
            )
          );
          const occupiedPitchNumbers = new Set(coachPitchRows.map((r) => r.pitch_number));
          for (let i = 0; i < n; i++) {
            const trackerResult = pitchOutcomeToTrackerLogResult(log[i]!.outcome);
            const coachRow = coachRowsForAb[i];
            if (coachRow?.id) {
              const { error } = await sb.from("pitches").update({ result: trackerResult }).eq("id", coachRow.id);
              if (error) console.warn("[Record] Sync coach pitch result:", error.message);
            } else {
              const pitch_number = nextOpenPitchNumberInGroup(
                [...occupiedPitchNumbers].map((pitch_number) => ({ pitch_number }))
              );
              occupiedPitchNumbers.add(pitch_number);
              const { error } = await sb.from("pitches").insert({
                game_id: selectedGameId,
                at_bat_id: null,
                tracker_group_id: groupId,
                pitch_number,
                pitch_type: null,
                result: trackerResult,
                batter_id: batterId,
                pitcher_id: pitcherId,
              });
              if (error) console.warn("[Record] Insert PA-only coach pitch row:", error.message);
            }
          }
          for (let i = n; i < coachRowsForAb.length; i++) {
            const tail = coachRowsForAb[i]!;
            const { error: clearErr } = await sb
              .from("pitches")
              .update({ result: null })
              .eq("id", tail.id);
            if (clearErr) console.warn("[Record] Clear trailing coach pitch results:", clearErr.message);
            if (tail.pitch_type == null) {
              const { error: delTailErr } = await sb.from("pitches").delete().eq("id", tail.id);
              if (delTailErr) console.warn("[Record] Remove trailing PA-only rows:", delTailErr.message);
            }
          }
        }
      } finally {
        if (seq === syncCoachPitchResultsSeqRef.current) void refreshCoachPitches({ background: true });
      }
    })();
  }, [
    draftPitchLog,
    pitchTrackerGroupId,
    recordLocked,
    selectedGameId,
    refreshCoachPitches,
    batterId,
    pitcherId,
    coachPitchRows,
    selectedGame?.our_side,
    inningHalf,
  ]);

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

  const playerIdsReachedOnError = useMemo(
    () =>
      playerIdsWhoReachedOnErrorFromPas(
        allPAsForGame,
        result === "reached_on_error" ? batterId : null
      ),
    [allPAsForGame, result, batterId]
  );

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

  const pitchTrackerBatterSlot = useMemo(() => {
    if (!batterId) return null;
    const order = lineupForBatting.order ?? [];
    const i = order.indexOf(batterId);
    if (i < 0) return null;
    return i + 1;
  }, [batterId, lineupForBatting.order]);

  useEffect(() => {
    if (!selectedGameId || recordLocked) return;
    void persistPitchTrackerBatterToGame(selectedGameId, batterId, pitchTrackerBatterSlot);
  }, [selectedGameId, batterId, pitchTrackerBatterSlot, recordLocked]);

  const displayBattingSide = battingTablePeekOther
    ? battingSide === "away"
      ? "home"
      : "away"
    : battingSide;
  /**
   * Pitching box + pitch mix: defensive team for the batting column.
   * When peeking the other lineup, flip so pitchers stay paired with the batters shown (same as live inning logic).
   */
  const pitchingSideForBox = battingTablePeekOther
    ? displayBattingSide === "away"
      ? "home"
      : "away"
    : pitchingSide;
  const ourGameSide = selectedGame?.our_side;
  /** Record: hide pitch-type Mix for our hitters and opposing pitchers; keep Mix for our arms only. */
  const isOurBatterAtPlate =
    ourGameSide === "home" || ourGameSide === "away" ? battingSide === ourGameSide : false;
  const isOurPitcherOnMound =
    ourGameSide === "home" || ourGameSide === "away" ? pitchingSide === ourGameSide : false;
  const isOurPitchingSideForBox =
    ourGameSide === "home" || ourGameSide === "away" ? pitchingSideForBox === ourGameSide : false;
  const battingTeamForQuickAdd = selectedGame
    ? battingSide === "away"
      ? selectedGame.away_team.trim()
      : selectedGame.home_team.trim()
    : "";
  const canQuickAddOpponentPlayer = Boolean(
    selectedGame &&
      !recordLocked &&
      (ourGameSide === "home" || ourGameSide === "away") &&
      battingSide !== ourGameSide &&
      battingTeamForQuickAdd.length > 0
  );
  const pitchingTeamForQuickAdd = selectedGame
    ? pitchingSide === "away"
      ? selectedGame.away_team.trim()
      : selectedGame.home_team.trim()
    : "";
  const canQuickAddOpponentPitcher = Boolean(
    selectedGame &&
      !recordLocked &&
      (ourGameSide === "home" || ourGameSide === "away") &&
      pitchingSide !== ourGameSide &&
      pitchingTeamForQuickAdd.length > 0
  );
  const handleQuickAddPlayerCreated = useCallback(
    async ({ player, lineupSlot, lineupPosition }: QuickAddPlayerCreatedPayload) => {
      setPlayers((prev) => {
        if (prev.some((p) => p.id === player.id)) return prev;
        return [...prev, player].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
      });
      if (isPitcherPlayer(player)) return;

      const currentLineup = battingSide === "away" ? lineupAway : lineupHome;
      let mergedOrder = currentLineup.order;
      let mergedPositions = currentLineup.positionByPlayerId;

      if (selectedGameId && selectedGame && !isDemoId(selectedGameId)) {
        try {
          const merged = applyPlayerToLineupSlot(
            currentLineup.order,
            currentLineup.positionByPlayerId,
            lineupSlot,
            player.id,
            lineupPosition
          );
          mergedOrder = merged.order;
          mergedPositions = merged.positionByPlayerId;
          const result = await saveRecordGameLineup(
            selectedGameId,
            battingSide,
            lineupSlotsForSave(mergedOrder, mergedPositions)
          );
          if (!result.ok) {
            showMsg("error", result.error ?? "Player added but lineup could not be saved.");
          } else {
            if (battingSide === "away") {
              setLineupAway({ order: mergedOrder, positionByPlayerId: mergedPositions });
            } else {
              setLineupHome({ order: mergedOrder, positionByPlayerId: mergedPositions });
            }
          }
        } catch (e) {
          showMsg(
            "error",
            e instanceof Error ? e.message : "Player added but lineup could not be updated."
          );
        }
      }

      setBatterId(player.id);
      setNextBatterIndexBySide((prev) => ({
        ...prev,
        [battingSide]: lineupSlotForBatterId(mergedOrder, player.id),
      }));
      queueMicrotask(() => batterSelectRef.current?.focus());
    },
    [
      battingSide,
      lineupAway,
      lineupHome,
      selectedGameId,
      selectedGame,
      saveRecordGameLineup,
      setBatterId,
      setNextBatterIndexBySide,
    ]
  );
  const handleQuickAddPitcherCreated = useCallback(
    async ({ player }: QuickAddPitcherCreatedPayload) => {
      setPlayers((prev) => {
        if (prev.some((p) => p.id === player.id)) return prev;
        return [...prev, player].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
      });
      setPitcherId(player.id);
      setPitcherBySide((prev) => ({ ...prev, [pitchingSide]: player.id }));
      if (selectedGameId && selectedGame && !isDemoId(selectedGameId)) {
        const spResult = await setGameStartingPitcherIfEmptyAction(
          selectedGameId,
          pitchingSide,
          player.id
        );
        if (!spResult.ok) {
          showMsg("error", spResult.error ?? "Pitcher added but starter could not be saved on the game.");
        }
      }
      showMsg("success", `${player.name.trim()} is on the mound.`);
    },
    [pitchingSide, selectedGameId, selectedGame, setPitcherId, setPitcherBySide]
  );
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

    let seqSummary: ReturnType<typeof summarizePitchSequence> | null = null;
    if (draftPitchLog.length > 0) {
      const entries: PitchSequenceEntry[] = draftPitchLog.map(
        ({ balls_before, strikes_before, outcome }) => ({
          balls_before,
          strikes_before,
          outcome,
        })
      );
      seqSummary = summarizePitchSequence(
        withInferredTerminalOutcomePitches(entries, result)
      );
    }

    const fromLog = seqSummary != null && seqSummary.pitches_seen > 0;
    const hasManual = pitchesSeen !== "" && pitchesSeen >= 0;
    if (!fromLog && !hasManual) return null;
    if (hasManual && !fromLog && strikesThrown === "") return null;

    const pitchCount = fromLog ? seqSummary!.pitches_seen : (pitchesSeen as number);
    const strikesCount = fromLog
      ? seqSummary!.strikes_thrown
      : hasManual && strikesThrown !== ""
        ? (strikesThrown as number)
        : 0;
    const inferredFirstPitch = fromLog
      ? seqSummary!.first_pitch_strike
      : pitchCount > 0
        ? firstCountFromZero === null
          ? countBalls === 0 && countStrikes === 0
            ? strikesCount > 0
            : null
          : firstCountFromZero === "strike"
        : null;

    const inningHalfForDraft = inningHalf ?? "top";
    return {
      id: "__draft_pitch_mix__",
      game_id: selectedGameId,
      batter_id: batterId ?? "__draft_batter__",
      inning,
      outs,
      base_state: baseState,
      score_diff: 0,
      count_balls: fromLog ? seqSummary!.finalBalls : countBalls,
      count_strikes: fromLog ? seqSummary!.finalStrikes : countStrikes,
      result: result ?? "other",
      contact_quality: null,
      hit_direction:
        result != null && RESULT_ALLOWS_HIT_DIRECTION.has(result) ? hitDirection : null,
      batted_ball_type:
        result != null && RESULT_ALLOWS_HIT_DIRECTION.has(result) ? battedBallType : null,
      pitches_seen: pitchCount,
      strikes_thrown: pitchCount > 0 ? strikesCount : 0,
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
    draftPitchLog,
    result,
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
    hitDirection,
    battedBallType,
  ]);
  const liveAbPaId =
    draftPaForPitchMix && draftPaForPitchMix.batter_id === batterId
      ? "__draft_pitch_mix__"
      : COACH_LIVE_AB_PA_ID;
  const hasLiveCoachTrackerActivity = coachRowsThisAb.some(
    (r) => r.pitch_type != null || r.result != null
  );
  const liveCoachSyntheticPa = useMemo(() => {
    if (!selectedGameId || !batterId || !pitcherId || !hasLiveCoachTrackerActivity) return null;
    if (draftPaForPitchMix?.batter_id === batterId) return null;
    return recordLiveTrackerSyntheticPa(
      selectedGameId,
      batterId,
      pitcherId,
      inning,
      inningHalf ?? "top",
      liveAbPaId
    );
  }, [
    selectedGameId,
    batterId,
    pitcherId,
    hasLiveCoachTrackerActivity,
    draftPaForPitchMix,
    inning,
    inningHalf,
    liveAbPaId,
  ]);
  const pitchEventsBaseForMix = useMemo(() => {
    if (!draftPaForPitchMix || draftPitchLog.length === 0) return gamePitchEvents;
    const synthetic = pitchEventsFromDraftPitchLogWithTerminal(
      "__draft_pitch_mix__",
      draftPitchLog,
      result
    );
    return [
      ...gamePitchEvents.filter((e) => e.pa_id !== "__draft_pitch_mix__"),
      ...synthetic,
    ];
  }, [gamePitchEvents, draftPaForPitchMix, draftPitchLog, result]);
  const mergedGamePitchEvents = useMemo(() => {
    const live =
      hasLiveCoachTrackerActivity && coachRowsThisAb.length > 0
        ? { paId: liveAbPaId, rows: coachRowsThisAb }
        : undefined;
    return mergeTrackerPitchesIntoPitchEvents(pitchEventsBaseForMix, [], live);
  }, [pitchEventsBaseForMix, hasLiveCoachTrackerActivity, coachRowsThisAb, liveAbPaId]);
  const pitchEventsForPitchMixCard = mergedGamePitchEvents.pitchEvents;
  const distributionPitchEventsForPitchMixCard = mergedGamePitchEvents.distributionPitchEvents;
  /** Same PAs as the pitching box (defensive team on the mound), not the batting half. */
  const pasForPitchMixUnderPitchingTable = useMemo(() => {
    const extraPas: PlateAppearance[] = [];
    if (draftPaForPitchMix) extraPas.push(draftPaForPitchMix);
    else if (liveCoachSyntheticPa) extraPas.push(liveCoachSyntheticPa);
    return plateAppearancesForPitchingSide(
      extraPas.length > 0 ? [...allPAsForGame, ...extraPas] : allPAsForGame,
      pitchingSideForBox
    );
  }, [allPAsForGame, draftPaForPitchMix, liveCoachSyntheticPa, pitchingSideForBox]);
  /** Current batter's PAs in this game (+ draft PA when it matches selected batter). */
  const pasForCurrentBatterPitchData = useMemo(() => {
    if (!batterId) return [];
    const fromDb = allPAsForGame.filter((p) => p.batter_id === batterId);
    if (draftPaForPitchMix && draftPaForPitchMix.batter_id === batterId) {
      return [...fromDb, draftPaForPitchMix];
    }
    if (liveCoachSyntheticPa && liveCoachSyntheticPa.batter_id === batterId) {
      return [...fromDb, liveCoachSyntheticPa];
    }
    return fromDb;
  }, [allPAsForGame, batterId, draftPaForPitchMix, liveCoachSyntheticPa]);

  const pitchEventsForCurrentBatter = useMemo(() => {
    const ids = new Set(pasForCurrentBatterPitchData.map((p) => p.id));
    return pitchEventsForPitchMixCard.filter((e) => ids.has(e.pa_id));
  }, [pitchEventsForPitchMixCard, pasForCurrentBatterPitchData]);
  const distributionPitchEventsForCurrentBatter = useMemo(() => {
    const ids = new Set(pasForCurrentBatterPitchData.map((p) => p.id));
    return distributionPitchEventsForPitchMixCard.filter((e) => ids.has(e.pa_id));
  }, [distributionPitchEventsForPitchMixCard, pasForCurrentBatterPitchData]);

  const [statPitchType, setStatPitchType] = useState<PitchTrackerPitchType | null>(null);

  const statPitchTypeDetail = useMemo(() => {
    if (!statPitchType || !pitcherId) return null;
    const pitcherPas = pasForPitchMixUnderPitchingTable.filter((p) => p.pitcher_id === pitcherId);
    return pitchTypeGameDetailFromPas(
      pitcherPas,
      pitchEventsForPitchMixCard,
      statPitchType,
      distributionPitchEventsForPitchMixCard
    );
  }, [
    statPitchType,
    pitcherId,
    pasForPitchMixUnderPitchingTable,
    pitchEventsForPitchMixCard,
    distributionPitchEventsForPitchMixCard,
    draftPitchLog,
    coachRowsThisAb,
  ]);

  const pitcherNameForPitchTypeStats = useMemo(() => {
    if (!pitcherId) return "Pitcher";
    return players.find((p) => p.id === pitcherId)?.name?.trim() || "Pitcher";
  }, [pitcherId, players]);

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
  /** Live mound team — stays tied to the inning half (recording / ROE), not batting-table peek. */
  const livePitchingTeamName = selectedGame
    ? pitchingSide === "home"
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

  const batterSelectEntries = useMemo(
    () =>
      battersForDropdown.map((p, idx) => ({
        id: p.id,
        slot: idx + 1,
        name: p.name.trim() || "Unknown",
        jersey: p.jersey?.trim() || null,
        bats: batterBatsLetter(p.bats),
      })),
    [battersForDropdown]
  );

  const selectedBatterEntry = useMemo(
    () => batterSelectEntries.find((e) => e.id === batterId) ?? null,
    [batterSelectEntries, batterId]
  );

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
    if (errorFielderModalMode === "hit" && (result === "hr" || result === "reached_on_error")) {
      setErrorFielderModalMode(null);
    }
  }, [result, baseState, errorFielderModalMode]);

  const undoLastDraftPitch = useCallback(() => {
    setDraftPitchLog((prev) => prev.slice(0, -1));
  }, []);

  const clearDraftPitchLog = useCallback(() => {
    setDraftPitchLog([]);
  }, []);

  const loadPAs = useCallback((options?: { resetBatter?: boolean; softRefresh?: boolean }) => {
    if (!selectedGameId) return;
    const resetBatter = options?.resetBatter !== false;
    const softRefresh = options?.softRefresh === true;
    const requestId = ++loadPasRequestIdRef.current;
    if (!softRefresh) {
      setAllPAsForGame([]);
      setGamePitchEvents([]);
      setGamePitchDistributionEvents([]);
      setLineupAway({ order: [], positionByPlayerId: {} });
      setLineupHome({ order: [], positionByPlayerId: {} });
    }
    Promise.all([
      fetchPAsForGame(selectedGameId),
      fetchGameLineupOrder(selectedGameId),
      fetchBaserunningEventsForGame(selectedGameId),
    ]).then(([{ pas, pitchEvents, distributionPitchEvents }, lineups, events]) => {
      if (requestId !== loadPasRequestIdRef.current) return;
      setAllPAsForGame(pas);
      setGamePitchEvents(pitchEvents);
      setGamePitchDistributionEvents(distributionPitchEvents);
      pitchEventsByGameRef.current = pitchEvents;
      setBaserunningEvents(events);
      setLineupAway(lineups.away);
      setLineupHome(lineups.home);
      formHydratedForGameRef.current = selectedGameId;

      let savedForm: PersistedRecordFormState | null = null;
      try {
        const raw = window.localStorage.getItem(recordFormStorageKey(selectedGameId));
        if (raw) savedForm = JSON.parse(raw) as PersistedRecordFormState;
      } catch {
        savedForm = null;
      }
      const factoryDefault = !savedForm || isFactoryDefaultRecordForm(savedForm);

      if (resetBatter && factoryDefault) {
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
          if (order.length > 0) {
            const slot =
              (resume.nextBatterIndexBySide?.[side] ?? 0) % order.length;
            const batterFromOrder = batterIdAtLineupSlot(order, players, slot);
            if (batterFromOrder) setBatterId(batterFromOrder);
          }
        } else if (pas.length === 0) {
          const fresh = freshGameRecordBatterState(lineups, players);
          setInning(fresh.inning);
          setInningHalf(fresh.inningHalf);
          setOuts(0);
          setBaseState("000");
          setNextBatterIndexBySide(fresh.nextBatterIndexBySide);
          setBatterId(fresh.batterId);
        } else {
          const inferred = inferRecordBatterFromExistingPAs(pas, lineups, players);
          setInning(Math.max(1, Math.min(inferred.inning, MAX_SELECTABLE_INNING)));
          setInningHalf(inferred.inningHalf);
          setNextBatterIndexBySide(inferred.nextBatterIndexBySide);
          setBatterId(inferred.batterId);
        }
      }

      if (pas.length > 0) {
        const wf = readWorkflowDefaults().resumeSnapshotByGameId?.[selectedGameId];
        if (wf) {
          resumeStackByGameRef.current.set(selectedGameId, [wf]);
        }
      } else {
        resumeStackByGameRef.current.set(selectedGameId, []);
      }
    });
  }, [selectedGameId, fetchPAsForGame, fetchGameLineupOrder, fetchBaserunningEventsForGame, players]);

  useEffect(() => {
    formHydratedForGameRef.current = null;
    loadPasRequestIdRef.current += 1;
  }, [selectedGameId]);

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

  const applySavedFormFromStorage = useCallback(
    (saved: PersistedRecordFormState) => {
      applyAtBatPersisted(saved);
      formRevisionRef.current = saved.revision ?? 0;
    },
    [applyAtBatPersisted]
  );

  useEffect(() => {
    if (!selectedGameId) return;
    const raw = window.localStorage.getItem(recordFormStorageKey(selectedGameId));
    if (!raw) {
      resetFormEmpty();
      formRevisionRef.current = 0;
      return;
    }
    try {
      applySavedFormFromStorage(JSON.parse(raw) as PersistedRecordFormState);
    } catch {
      resetFormEmpty();
      formRevisionRef.current = 0;
    }
  }, [selectedGameId, applySavedFormFromStorage, resetFormEmpty]);

  const applyResumeSnapshot = useCallback(
    (
      snap: RecordResumeSnapshotV1,
      lineups: { away: { order: string[] }; home: { order: string[] } }
    ) => {
      setInning(Math.max(1, Math.min(snap.inning, MAX_SELECTABLE_INNING)));
      setInningHalf(snap.inningHalf);
      setOuts(Math.max(0, Math.min(snap.outs, 2)));
      setBaseState(snap.baseState);
      setRunnerOn1bId(snap.runnerOn1bId);
      setRunnerOn2bId(snap.runnerOn2bId);
      setRunnerOn3bId(snap.runnerOn3bId);
      setNextBatterIndexBySide(snap.nextBatterIndexBySide);
      setPitcherBySide(snap.pitcherBySide);
      const side = battingSideFromHalf(snap.inningHalf);
      const order = side === "away" ? lineups.away.order : lineups.home.order;
      const pitchingSideNow = side === "away" ? "home" : "away";
      const rememberedPitcher = snap.pitcherBySide[pitchingSideNow];
      if (rememberedPitcher && players.some((p) => p.id === rememberedPitcher)) {
        setPitcherId(rememberedPitcher);
      }
      if (order.length > 0) {
        const slot = snap.nextBatterIndexBySide[side] ?? 0;
        const fromOrder = batterIdAtLineupSlot(order, players, slot);
        if (fromOrder) setBatterId(fromOrder);
      }
    },
    [players]
  );

  const clearNewPaDraftFields = useCallback(() => {
    clearAtBatNewPaDraft();
    setLastSavedPaSummary(null);
    lastRepeatablePaRef.current = null;
  }, [clearAtBatNewPaDraft]);

  const restoreFormFromRemovedPa = useCallback(
    (pa: PlateAppearance) => {
      setInning(Math.max(1, Math.min(pa.inning, MAX_SELECTABLE_INNING)));
      setInningHalf(pa.inning_half === "bottom" ? "bottom" : "top");
      setOuts(Math.max(0, Math.min(pa.outs, 2)));
      setBaseState(pa.base_state);
      setRunnerOn1bId(null);
      setRunnerOn2bId(null);
      setRunnerOn3bId(null);
      setBatterId(pa.batter_id);
      const side = battingSideFromHalf(pa.inning_half === "bottom" ? "bottom" : "top");
      const order = side === "away" ? lineupAway.order : lineupHome.order;
      if (order.length > 0) {
        setNextBatterIndexBySide((prev) => ({
          ...prev,
          [side]: lineupSlotForBatterId(order, pa.batter_id),
        }));
      }
    },
    [lineupAway.order, lineupHome.order]
  );

  useEffect(() => {
    if (!selectedGameId) return;
    if (formHydratedForGameRef.current !== selectedGameId) return;
    const revision = nextFormRevision(recordFormSnapshotRef.current?.revision);
    formRevisionRef.current = revision;
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
      revision,
    };
    recordFormSnapshotRef.current = payload;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(recordFormStorageKey(selectedGameId), JSON.stringify(payload));
      } catch {
        /* quota / private mode */
      }
    }, 300);
    return () => window.clearTimeout(t);
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

  /** Keep selected batter on the team at bat; remember lineup order slot per side when switching halves. */
  useEffect(() => {
    const order = lineupForBatting.order ?? [];
    if (order.length > 0) {
      if (batterId && order.includes(batterId)) {
        const p = players.find((pl) => pl.id === batterId);
        if (p && !isPitcherPlayer(p)) {
          const slot = lineupSlotForBatterId(order, batterId);
          setNextBatterIndexBySide((prev) =>
            prev[battingSide] === slot ? prev : { ...prev, [battingSide]: slot }
          );
          return;
        }
      }
      const slot = Math.min(
        Math.max(0, nextBatterIndexBySide[battingSide] ?? 0),
        order.length - 1
      );
      const restoredId = batterIdAtLineupSlot(order, players, slot);
      if (restoredId && restoredId !== batterId) setBatterId(restoredId);
      return;
    }
    if (battersForDropdown.length === 0) {
      if (batterId) setBatterId(null);
      return;
    }
    const idx = battersForDropdown.findIndex((p) => p.id === batterId);
    if (idx >= 0) {
      setNextBatterIndexBySide((prev) =>
        prev[battingSide] === idx ? prev : { ...prev, [battingSide]: idx }
      );
      return;
    }
    const slot = (nextBatterIndexBySide[battingSide] ?? 0) % battersForDropdown.length;
    const restoredId = battersForDropdown[slot]?.id ?? null;
    if (restoredId && restoredId !== batterId) setBatterId(restoredId);
  }, [
    lineupForBatting.order,
    players,
    battersForDropdown,
    batterId,
    battingSide,
    nextBatterIndexBySide,
  ]);

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

  /**
   * Coach pitch pad always tracks our mound pitcher — not the opponent arm while we hit.
   * Matchup / PA form still use `pitcherId` (mound pitcher for the current half).
   */
  useEffect(() => {
    if (!selectedGameId || recordLocked) return;
    const ourSide = selectedGame?.our_side;
    const isOurTeamBatting = ourSide === "home" || ourSide === "away" ? battingSide === ourSide : false;
    const coachPadPitcherId =
      isOurTeamBatting && ourSide ? pitcherBySide[ourSide] : pitcherId;
    if (coachPadPitcherId == null && pitchersForDropdown.length > 0) return;
    void persistPitchTrackerPitcherToGame(selectedGameId, coachPadPitcherId);
    void persistPitchTrackerMoundPitcherToGame(selectedGameId, pitcherId);
  }, [
    selectedGameId,
    pitcherId,
    pitcherBySide,
    battingSide,
    selectedGame?.our_side,
    recordLocked,
    pitchersForDropdown.length,
  ]);

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

  /** ROE reachers are always unearned when marked as scoring (user can still tap E to override). */
  useEffect(() => {
    if (playerIdsReachedOnError.size === 0) return;
    setUnearnedRunsScoredPlayerIds((prev) => {
      const next = new Set(prev);
      for (const id of runsScoredPlayerIds) {
        if (playerIdsReachedOnError.has(id)) next.add(id);
      }
      return [...next];
    });
  }, [runsScoredPlayerIds, playerIdsReachedOnError]);

  /** Hide manual E/UE when no error context — keep auto-UE for ROE reachers (HR keeps per-scorer E/UE). */
  useEffect(() => {
    if (result === "hr") return;
    if (!showEarnedUnearnedRunControls) {
      setUnearnedRunsScoredPlayerIds((prev) =>
        prev.filter((id) => playerIdsReachedOnError.has(id) && runsScoredPlayerIds.includes(id))
      );
    }
  }, [result, showEarnedUnearnedRunControls, playerIdsReachedOnError, runsScoredPlayerIds]);

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
    const pref = parsePersistedBattedBallType(readWorkflowDefaults().lastBattedBallType);
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

  /** Sync mid-PA draft when another tab writes a newer revision to localStorage. */
  useEffect(() => {
    if (!selectedGameId) return;
    const key = recordFormStorageKey(selectedGameId);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || !e.newValue) return;
      try {
        const remote = JSON.parse(e.newValue) as PersistedRecordFormState;
        if (!isRemoteFormNewer(formRevisionRef.current, remote)) return;
        applySavedFormFromStorage(remote);
        showMsg("destructive", "Another tab updated this game — form synced from that tab.");
      } catch {
        /* ignore malformed blob */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [selectedGameId, applySavedFormFromStorage, showMsg]);

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
            outcome === "ball" && balls >= 3
              ? "Count is already 3 balls — set Outcome to Walk (BB) instead of logging another ball."
              : outcome === "ball" && strikes >= 3
                ? "Third strike is already logged — cannot add a ball. Use Undo or set Outcome to SO."
                : strikes >= 3
                  ? "Third strike is already logged — use Undo to change or set Outcome to SO."
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
        from_base: baseIndex,
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
                ? `3rd out — ${REGULATION_INNINGS}-inning regulation complete. Set inning/half manually for extras.`
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

  const handleDeleteBaserunningEvent = useCallback(
    async (eventId: string) => {
      if (
        !window.confirm(
          "Remove this stolen base / caught stealing from the log? Runner positions on the diamond will not change."
        )
      ) {
        return;
      }
      const r = await deleteBaserunningEventAction(eventId);
      if (r.ok) {
        setBaserunningEvents((prev) => prev.filter((x) => x.id !== eventId));
        showMsg("destructive", "Baserunning event removed");
      } else {
        showMsg("error", r.error ?? "Failed to remove");
      }
    },
    [deleteBaserunningEventAction, showMsg]
  );

  const handleSave = async () => {
    if (saving) return;
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
    const sequenceForSave = withInferredTerminalOutcomePitches(sequenceBase, result);
    const coachTypesForSave = mapCoachPitchTypesToSequence(sequenceForSave, coachRowsThisAb);
    const pitchLogForSave: PitchEventDraft[] | undefined =
      sequenceForSave.length > 0
        ? sequenceForSave.map((row, i) => {
            const { balls, strikes } = clampPitchCountBefore(row.balls_before, row.strikes_before);
            return {
            pitch_index: i + 1,
            balls_before: balls,
            strikes_before: strikes,
            outcome: row.outcome,
            pitch_type: coachTypesForSave[i] ?? null,
          };
          })
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
          showMsg("error", "Strikes thrown is required when pitches â‰¥ 1.");
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
    if (errorFielderId && !fieldersForErrorPicker.some((p) => p.id === errorFielderId)) {
      showMsg("error", "Chosen fielder is not on the defensive team — pick again.");
      return;
    }
    if (result != null && errorFielderId) {
      const persistedErr = persistPlateAppearanceErrorFielderId(result, baseState, errorFielderId);
      if (persistedErr === null) {
        showMsg(
          "error",
          "Fielding error doesn't match this outcome and bases — add a runner on base or clear the error."
        );
        return;
      }
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
      const unearnedScorerIds = unearnedScorerIdsForSave(
        runsScoredIds,
        playerIdsWhoReachedOnErrorFromPas(
          allPAsForGame,
          result === "reached_on_error" ? batterId : null
        ),
        persistUnearned,
        unearnedRunsScoredPlayerIds
      );
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
          result != null ? persistPlateAppearanceErrorFielderId(result, baseState, errorFielderId) : null,
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
      let pitchTrackerLinked = true;
      if (
        insertedPa?.id &&
        !insertedPa.id.startsWith("local-") &&
        pitchTrackerGroupId
      ) {
        const linkRes = await linkPitchTrackerGroupToPa(pitchTrackerGroupId, insertedPa.id);
        if (!linkRes.ok) {
          pitchTrackerLinked = false;
          showMsg("error", linkRes.error ?? "Pitch tracker rows could not be linked to this PA.");
        }
      }
      if (selectedGameId && pitchTrackerLinked) {
        const nextTracker = newPitchTrackerGroupId();
        writeStoredPitchTrackerGroupId(selectedGameId, nextTracker);
        setPitchTrackerGroupId(nextTracker);
        void persistPitchTrackerGroupToGame(selectedGameId, nextTracker);
        /** Coach pad reads count from `games` — flush 0-0 immediately so it stays aligned with the new AB. */
        void persistPitchTrackerCountToGame(selectedGameId, 0, 0);
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
      const persistedErrId =
        result != null ? persistPlateAppearanceErrorFielderId(result, baseState, errorFielderId) : null;
      const errorFielderName =
        persistedErrId != null ? players.find((p) => p.id === persistedErrId)?.name ?? "?" : null;
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
        const optimisticEvents = pitchLogForSave.map((row) => ({
          id: `local-pe-${optimisticPa.id}-${row.pitch_index}`,
          pa_id: optimisticPa.id,
          pitch_index: row.pitch_index,
          balls_before: row.balls_before,
          strikes_before: row.strikes_before,
          outcome: row.outcome,
          pitch_type: row.pitch_type ?? null,
          created_at: created,
        }));
        setGamePitchEvents((prev) => [...prev, ...optimisticEvents]);
        setGamePitchDistributionEvents((prev) => [...prev, ...optimisticEvents]);
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
      const battingOrder = lineupForBatting.order ?? [];
      let advancedNextIdxForCurrentSide = nextBatterIndexBySide[battingSide] ?? 0;
      if (battingOrder.length > 0) {
        const curSlot = batterId
          ? lineupSlotForBatterId(battingOrder, batterId)
          : Math.min(advancedNextIdxForCurrentSide, battingOrder.length - 1);
        advancedNextIdxForCurrentSide = (curSlot + 1) % battingOrder.length;
        setNextBatterIndexBySide((prev) => ({
          ...prev,
          [battingSide]: advancedNextIdxForCurrentSide,
        }));
      } else if (battersForDropdown.length > 0) {
        const idx = battersForDropdown.findIndex((p) => p.id === batterId);
        advancedNextIdxForCurrentSide =
          idx < 0
            ? (nextBatterIndexBySide[battingSide] ?? 0) % battersForDropdown.length
            : (idx + 1) % battersForDropdown.length;
        setNextBatterIndexBySide((prev) => ({
          ...prev,
          [battingSide]: advancedNextIdxForCurrentSide,
        }));
      }
      const nextBatterAfterSave = () => {
        if (battingOrder.length > 0) {
          return batterIdAtLineupSlot(battingOrder, players, advancedNextIdxForCurrentSide);
        }
        return battersForDropdown[advancedNextIdxForCurrentSide]?.id ?? null;
      };
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
            const nextOrder =
              nextSide === "away" ? lineupAway.order : lineupHome.order;
            const nextId =
              nextOrder.length > 0
                ? batterIdAtLineupSlot(nextOrder, players, nextBatterIndexBySide[nextSide] ?? 0)
                : battersForSide(nextSide)[
                    (nextBatterIndexBySide[nextSide] ?? 0) % battersForSide(nextSide).length
                  ]?.id ?? null;
            if (nextId) setBatterId(nextId);
          }
        } else {
          setOuts(newOuts);
          setBaseState(newBaseState);
          setRunnerOn1bId(cR1);
          setRunnerOn2bId(cR2);
          setRunnerOn3bId(cR3);
          {
            const nextId = nextBatterAfterSave();
            if (nextId) setBatterId(nextId);
          }
        }
        if (gidpHadRunner2ndOr3rd) {
          showMsg(
            "success",
            "GIDP: 1st-base runner cleared and +2 outs recorded. If a runner was on 2nd or 3rd, update the diamond to match the play."
          );
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
            const nextOrder =
              nextSide === "away" ? lineupAway.order : lineupHome.order;
            const nextId =
              nextOrder.length > 0
                ? batterIdAtLineupSlot(nextOrder, players, nextBatterIndexBySide[nextSide] ?? 0)
                : battersForSide(nextSide)[
                    (nextBatterIndexBySide[nextSide] ?? 0) % battersForSide(nextSide).length
                  ]?.id ?? null;
            if (nextId) setBatterId(nextId);
          }
        } else {
          setOuts((o) => o + 1);
          setBaseState(newBaseState);
          setRunnerOn1bId(cR1);
          setRunnerOn2bId(cR2);
          setRunnerOn3bId(cR3);
          {
            const nextId = nextBatterAfterSave();
            if (nextId) setBatterId(nextId);
          }
        }
      } else {
        setBaseState(newBaseState);
        setRunnerOn1bId(cR1);
        setRunnerOn2bId(cR2);
        setRunnerOn3bId(cR3);
        {
          const nextId = nextBatterAfterSave();
          if (nextId) setBatterId(nextId);
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

        const resumeSnap: RecordResumeSnapshotV1 = {
          inning: Math.max(1, Math.min(wfInning, MAX_SELECTABLE_INNING)),
          inningHalf: wfHalf,
          outs: Math.max(0, Math.min(wfOuts, 2)),
          baseState: wfBase,
          runnerOn1bId: wfR1,
          runnerOn2bId: wfR2,
          runnerOn3bId: wfR3,
          nextBatterIndexBySide: wfNextIdx,
          pitcherBySide: wfPitcherBySide,
        };
        mergeWorkflowDefaultsForGame(selectedGameId, {
          resumeSnapshot: resumeSnap,
          lastBattedBallType:
            RESULT_ALLOWS_HIT_DIRECTION.has(result) && battedBallType != null
              ? battedBallType
              : undefined,
        });
        const stack = resumeStackByGameRef.current.get(selectedGameId) ?? [];
        stack.push(resumeSnap);
        resumeStackByGameRef.current.set(selectedGameId, stack);
      }
      loadPAs({ resetBatter: false, softRefresh: true });
      queueMicrotask(() => {
        batterSelectRef.current?.focus();
      });
    } finally {
      setSaving(false);
    }
  };

  const lastPA = lastPaChronological(allPAsForGame);

  const requestUndoLastPA = () => {
    if (!lastPA || !selectedGameId) return;
    setDestructiveConfirm("undoLastPa");
  };

  const handleFinalizeGame = useCallback(
    async (
      winningPitcherId: string | null,
      savePitcherId: string | null,
      losingPitcherId: string | null
    ) => {
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
        const result = await finalizeGameScore(selectedGameId, liveHomeRuns, liveAwayRuns, {
          winningPitcherId,
          savePitcherId,
          losingPitcherId,
        });
        if (!result.ok) {
          showMsg("error", result.error ?? "Failed to finalize game");
          return;
        }
        const wasPreviouslyFinalized = currentFinalAway != null && currentFinalHome != null;
        setFinalizedScoreSnapshot({ away: liveAwayRuns, home: liveHomeRuns });
        setFinalizeModalOpen(false);
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
    },
    [
      router,
      selectedGameId,
      finalizedScoreSnapshot.away,
      finalizedScoreSnapshot.home,
      finalizeGameScore,
      liveHomeRuns,
      liveAwayRuns,
      showMsg,
    ]
  );

  const handleDestructiveConfirm = async () => {
    if (destructiveConfirm === "undoLastPa") {
      if (!lastPA || !selectedGameId) return;
      const paToRemove = lastPA;
      const lineupsSnap = { away: lineupAway, home: lineupHome };
      setDestructivePending(true);
      try {
        const { ok, error } = await deletePlateAppearance(paToRemove.id);
        setDestructiveConfirm(null);
        if (ok) {
          const stack = resumeStackByGameRef.current.get(selectedGameId) ?? [];
          if (stack.length > 0) stack.pop();
          const prevSnap = stack[stack.length - 1];
          clearNewPaDraftFields();
          if (prevSnap) {
            applyResumeSnapshot(prevSnap, lineupsSnap);
          } else {
            restoreFormFromRemovedPa(paToRemove);
          }
          showMsg("destructive", "Last PA removed — form restored to that spot in the game.");
          loadPAs({ resetBatter: false, softRefresh: true });
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
          if (selectedGameId) {
            resumeStackByGameRef.current.set(selectedGameId, []);
            try {
              window.localStorage.removeItem(recordFormStorageKey(selectedGameId));
            } catch {
              /* ignore */
            }
            clearUnavailablePlayers(selectedGameId);
            setUnavailableBySide({ away: [], home: [] });
          }
          clearNewPaDraftFields();
          clearForm();
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
    clearAtBatForm(lineupAway.order[0] ?? lineupHome.order[0] ?? players[0]?.id ?? null);
    setBaserunningEvents([]);
    setLastSavedPaSummary(null);
    lastRepeatablePaRef.current = null;
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

  const savePaDisabled =
    !batterId ||
    result === null ||
    !pitcherId ||
    throwsToPitcherHand(selectedPitcher?.throws) === null ||
    pitchesSeen === "" ||
    (typeof pitchesSeen === "number" && pitchesSeen > 0 && strikesThrown === "") ||
    (result != null && RESULT_IS_HIT.has(result) && hitDirection === null) ||
    (result != null && RESULT_ALLOWS_HIT_DIRECTION.has(result) && battedBallType === null) ||
    (result != null && requiresRunnerOnBaseForResult(result) && baseState === "000") ||
    (result === "reached_on_error" && !errorFielderId) ||
    (result === "hr" && runsScoredPlayerIds.length === 0) ||
    saving;

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
    return summarizePitchSequence(withInferredTerminalOutcomePitches(entries, result));
  }, [draftPitchLog, result]);

  const pitchSequenceListRowCount = useMemo(() => {
    let rows = mergedSequenceLength;
    if (
      result != null &&
      draftPitchLog.length > 0 &&
      livePitchSequenceSummary != null &&
      livePitchSequenceSummary.pitches_seen > draftPitchLog.length
    ) {
      rows += 1;
    }
    return rows;
  }, [mergedSequenceLength, result, draftPitchLog.length, livePitchSequenceSummary]);

  const pitchSequenceListScrollable =
    pitchSequenceListRowCount > PITCH_SEQUENCE_VISIBLE_ROWS;

  useEffect(() => {
    if (pitchSequenceListRowCount === 0) return;
    const raf = requestAnimationFrame(() => {
      const container = pitchSequenceScrollRef.current;
      const end = pitchSequenceEndRef.current;
      if (!end) return;
      if (container && pitchSequenceListScrollable) {
        container.scrollTop = container.scrollHeight;
      } else {
        end.scrollIntoView({ block: "nearest", behavior: "auto" });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [pitchSequenceListRowCount, pitchSequenceListScrollable]);

  const displayCountBalls = livePitchSequenceSummary?.finalBalls ?? countBalls;
  const displayCountStrikes = livePitchSequenceSummary?.finalStrikes ?? countStrikes;

  /** Coach pad reads `games.pitch_tracker_*` — must match PA form display (incl. pitch-log totals). */
  useEffect(() => {
    if (!selectedGameId || recordLocked) return;
    const t = window.setTimeout(() => {
      void persistPitchTrackerCountToGame(selectedGameId, displayCountBalls, displayCountStrikes);
    }, 400);
    return () => window.clearTimeout(t);
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
    const order = lineupForBatting.order ?? [];
    if (order.length > 0) {
      const curSlot = batterId
        ? lineupSlotForBatterId(order, batterId)
        : Math.min(nextBatterIndexBySide[battingSide] ?? 0, order.length - 1);
      const nextSlot = (curSlot + 1) % order.length;
      setNextBatterIndexBySide((prev) => ({ ...prev, [battingSide]: nextSlot }));
      const nextId = batterIdAtLineupSlot(order, players, nextSlot);
      if (nextId) setBatterId(nextId);
      queueMicrotask(() => batterSelectRef.current?.focus());
      return;
    }
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
  }, [
    lineupForBatting.order,
    players,
    battersForDropdown,
    batterId,
    nextBatterIndexBySide,
    battingSide,
  ]);

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

  useRecordKeyboardShortcuts({
    selectedGameId,
    recordLocked,
    batterId,
    result,
    errorFielderId,
    substitutionModalOpen,
    pitcherChangeModalOpen,
    finalizeModalOpen,
    destructiveConfirm,
    errorFielderModalMode,
    shortcutsHelpOpen,
    savePaDisabled,
    batterSelectRef,
    outcomeCountGateRef,
    prevResultBeforeRoeModalRef,
    prevErrorFielderIdBeforeRoeModalRef,
    handleSaveRef,
    advanceToNextLineupBatterRef,
    repeatLastSavedOutcomeRef,
    setShortcutsHelpOpen,
    setSubstitutionModalOpen,
    setPitcherChangeModalOpen,
    setResult,
    setErrorFielderId,
    setHitDirection,
    setBattedBallType,
    setErrorFielderModalMode,
  });

  return (
    <div className="space-y-2 pb-24 sm:space-y-3 sm:pb-28">
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
              {formatDateMMDDYYYY(selectedGame.date)} — {matchupLabelUsFirst(selectedGame, true)}
            </p>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {finalizedScoreText ? (
                <span
                  className="inline-flex min-h-[44px] min-w-[12.5rem] items-center justify-center rounded-lg border-2 border-[var(--accent)]/60 bg-[var(--accent)]/12 px-5 py-2 text-base font-semibold tabular-nums tracking-wide text-[var(--accent)]"
                  title="Finalized score snapshot"
                >
                  Final: {finalizedScoreText}
                  {finalizedOutcomeText ? <span className="ml-3">({finalizedOutcomeText})</span> : null}
                </span>
              ) : null}
              {pitchPadHealthAlert ? (
                <div className="max-w-[14rem] min-w-0 shrink">
                  <RecordPitchPadHealthBanner alert={pitchPadHealthAlert} />
                </div>
              ) : null}
              {!isDemoId(selectedGameId) && (
                <button
                  type="button"
                  onClick={() => setFinalizeModalOpen(true)}
                  disabled={finalizingGame}
                  className="font-display min-h-[44px] rounded-lg border-2 border-[var(--danger)] bg-[var(--danger)]/15 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-[var(--danger)] transition hover:bg-[var(--danger)]/25 hover:border-[var(--danger)]/80 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Set final score and pitcher credits, then open box score review."
                >
                  {finalizingGame ? "Finalizing…" : "Finalize game"}
                </button>
              )}
            </div>
          </div>

          <RecordPageToast mounted={toastMounted} message={message} onDismiss={dismissMessage} />

          <div className="card-tech min-w-0 rounded-lg border p-2">
            <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-stretch lg:gap-4">
              <CurrentBatterPitchDataCard
                batterName={currentBatterPitchDataName}
                pas={pasForCurrentBatterPitchData}
                pitchEvents={pitchEventsForCurrentBatter}
                distributionPitchEvents={distributionPitchEventsForCurrentBatter}
                compact
                hideTypeMix={isOurBatterAtPlate}
              />
              <BattingPitchMixCard
                pas={pasForPitchMixUnderPitchingTable}
                players={players}
                pitchEvents={pitchEventsForPitchMixCard}
                distributionPitchEvents={distributionPitchEventsForPitchMixCard}
                compact
                currentPitcherId={pitcherId}
                inning={inning}
                inningHalf={inningHalf}
                onPitchTypeClick={setStatPitchType}
                hideTypeMix={!isOurPitcherOnMound}
              />
            </div>
            <div className="flex min-h-0 min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:gap-3">
              <div className="order-1 flex min-h-0 min-w-0 flex-1 flex-col space-y-1.5 lg:order-2">
            {/* Outcome (left on lg) · Game state + At bat (right on lg). Single column below lg: game → at bat → outcome. */}
            <div className="grid min-h-0 min-w-0 gap-1.5 lg:grid-cols-2 lg:gap-2 lg:items-start">
            <div className="min-h-0 min-w-0 space-y-1.5 lg:order-2 lg:max-h-[calc(100dvh-5rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
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
              <div className="mb-0.5 flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-heading text-xs font-semibold text-[var(--text)]">
                  Pitcher (
                  {pitchingSide === "home" ? selectedGame.home_team : selectedGame.away_team})
                </span>
                {canQuickAddOpponentPitcher ? (
                  <button
                    type="button"
                    onClick={() => setQuickAddPitcherOpen(true)}
                    className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)] underline decoration-dotted underline-offset-2 hover:opacity-90"
                  >
                    + Add pitcher
                  </button>
                ) : null}
              </div>
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
                  onClick={() =>
                    pitchersForDropdown.length === 0 && canQuickAddOpponentPitcher
                      ? setQuickAddPitcherOpen(true)
                      : setPitcherChangeModalOpen(true)
                  }
                  disabled={pitchersForDropdown.length === 0 && !canQuickAddOpponentPitcher}
                  className="font-display min-h-[44px] shrink-0 rounded-lg border-2 border-[var(--accent)] bg-[var(--accent)]/12 px-4 py-2 text-center text-sm font-semibold tracking-wide text-[var(--accent)] transition hover:bg-[var(--accent)]/22 disabled:cursor-not-allowed disabled:opacity-45 touch-manipulation"
                >
                  {pitchersForDropdown.length === 0 && canQuickAddOpponentPitcher
                    ? "Add pitcher"
                    : "Change pitcher"}
                </button>
              </div>
              {canQuickAddOpponentPitcher && pitchersForDropdown.length === 0 ? (
                <p className="mt-1.5 max-w-md text-[10px] leading-snug text-[var(--text-muted)]">
                  No pitchers tagged for {pitchingTeamForQuickAdd} yet. Use{" "}
                  <button
                    type="button"
                    onClick={() => setQuickAddPitcherOpen(true)}
                    className="font-medium text-[var(--accent)] underline decoration-dotted underline-offset-2 hover:opacity-90"
                  >
                    Add pitcher
                  </button>{" "}
                  to log this half-inning.
                </p>
              ) : null}
              {showPitcherWarning && (
                <p className="mt-1 text-[11px] leading-snug text-[var(--warning)]">
                  {pitchersForDropdown.length === 0
                    ? "Add at least one pitcher (position P, throwing hand) on the defensive team's roster."
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
              <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-start sm:gap-3 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:items-start">
                <div className="min-w-0 space-y-1.5 sm:order-2 sm:self-start lg:sticky lg:top-2 lg:z-20 lg:max-h-[min(calc(100dvh-9rem),42rem)] lg:overflow-y-auto lg:overflow-x-hidden lg:rounded-md lg:bg-[var(--bg-elevated)] lg:px-1.5">
                  <div className="mb-1 flex min-h-5 shrink-0 items-baseline justify-between gap-2">
                    <span className="font-heading text-xs font-semibold text-[var(--text)]">Batter</span>
                    {canQuickAddOpponentPlayer ? (
                      <button
                        type="button"
                        onClick={() => setQuickAddPlayerOpen(true)}
                        className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)] underline decoration-dotted underline-offset-2 hover:opacity-90"
                      >
                        + Add player
                      </button>
                    ) : null}
                  </div>
                    <div className="relative h-10 w-full max-w-[min(100%,18rem)] overflow-hidden rounded-lg border border-[var(--border)] bg-black transition-[border-color,box-shadow] focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_var(--accent-dim)]">
                      <div
                        className="flex h-full min-w-0 items-center gap-1.5 overflow-hidden bg-black px-2 pr-8"
                        aria-hidden
                      >
                        {selectedBatterEntry ? (
                          <>
                            <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-[var(--text-muted)]">
                              {selectedBatterEntry.slot}.
                            </span>
                            <span className="min-w-0 truncate text-sm font-medium text-[var(--accent)]">
                              {selectedBatterEntry.name}
                            </span>
                            {selectedBatterEntry.jersey ? (
                              <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--accent)]">
                                #{selectedBatterEntry.jersey}
                              </span>
                            ) : null}
                            {selectedBatterEntry.bats ? (
                              <span className="shrink-0 text-sm font-semibold text-white">
                                {selectedBatterEntry.bats}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-sm text-[var(--text-muted)]">Select batter</span>
                        )}
                      </div>
                      <select
                        ref={batterSelectRef}
                        value={batterId ?? ""}
                        onChange={(e) => {
                          const id = e.target.value || null;
                          setBatterId(id);
                          if (!id) return;
                          const order = lineupForBatting.order ?? [];
                          if (order.length > 0) {
                            setNextBatterIndexBySide((prev) => ({
                              ...prev,
                              [battingSide]: lineupSlotForBatterId(order, id),
                            }));
                          } else {
                            const pickIdx = battersForDropdown.findIndex((p) => p.id === id);
                            if (pickIdx >= 0) {
                              setNextBatterIndexBySide((prev) => ({ ...prev, [battingSide]: pickIdx }));
                            }
                          }
                        }}
                        className="absolute inset-0 z-10 h-full w-full cursor-pointer bg-black opacity-0 touch-manipulation"
                        aria-label={
                          selectedBatterEntry
                            ? `Batter ${selectedBatterEntry.slot}, ${selectedBatterEntry.name}`
                            : "Batter"
                        }
                      >
                        <option value="">Select batter</option>
                        {batterSelectEntries.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {batterSelectOptionText(entry)}
                          </option>
                        ))}
                      </select>
                      <span
                        className="pointer-events-none absolute right-2 top-1/2 z-0 -translate-y-1/2 text-[10px] text-[var(--text-muted)]"
                        aria-hidden
                      >
                        ▾
                      </span>
                    </div>

                    {canQuickAddOpponentPlayer && batterSelectEntries.length === 0 ? (
                      <p className="mt-1.5 text-[10px] leading-snug text-[var(--text-muted)]">
                        No batters tagged for {battingTeamForQuickAdd} yet.{" "}
                        <button
                          type="button"
                          onClick={() => setQuickAddPlayerOpen(true)}
                          className="font-medium text-[var(--accent)] underline decoration-dotted underline-offset-2 hover:opacity-90"
                        >
                          Add a player
                        </button>{" "}
                        to log this at-bat.
                      </p>
                    ) : null}

                <details className="mt-2">
                  <summary className="mb-0.5 cursor-pointer list-none text-[9px] text-[var(--text-muted)] underline decoration-dotted underline-offset-2 marker:content-none [&::-webkit-details-marker]:hidden">
                    Pitch log tips
                  </summary>
                  <p className="mt-1 text-[9px] leading-snug text-[var(--text-muted)]">
                    Tap a pitch — count updates live. At 2 strikes you can still tap Called or Whiff for the putaway strike; Foul stays available for two-strike fouls. If you use a pitch log and save a strikeout, log that putaway pitch before saving. Walk / HBP without a log: use Outcome only; clear the log if not logging pitches. FC and sac plays use simplified runner defaults — adjust the diamond if needed.
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
                      pitchLogEndCount.strikes >= 3
                        ? outcome === "ball"
                          ? "Third strike logged — cannot add a ball. Undo or set Outcome to SO."
                          : "Third strike logged — Undo to change or set Outcome to SO."
                        : outcome === "ball"
                          ? "3 balls already — choose Walk (BB) as outcome."
                          : "Putaway strike already logged at 2 strikes — Undo to change.";
                    return (
                    <button
                        key={outcome}
                      type="button"
                        title={countBlocked ? blockHint : title}
                        disabled={countBlocked}
                        onClick={() => appendDraftPitch(outcome)}
                        className={`flex min-h-[40px] w-full touch-manipulation items-center justify-center rounded-md border px-1 py-1.5 text-[11px] font-semibold leading-tight transition disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[44px] sm:text-xs ${pitchLogOutcomePadClass(outcome)}`}
                      >
                        {label}
                    </button>
                    );
                  })}
                    <button
                      type="button"
                    onClick={undoLastDraftPitch}
                    disabled={draftPitchLog.length === 0}
                    className={`flex min-h-[40px] w-full touch-manipulation items-center justify-center rounded-md border px-1 py-1.5 text-[11px] font-medium leading-tight transition disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[44px] sm:text-xs ${PITCH_LOG_UNDO_PAD_CLASS}`}
                  >
                    Undo
                    </button>
                    <button
                      type="button"
                    onClick={clearDraftPitchLog}
                    disabled={draftPitchLog.length === 0}
                    className={`flex min-h-[40px] w-full touch-manipulation items-center justify-center rounded-md border px-1 py-1.5 text-[11px] font-medium leading-tight transition disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[44px] sm:text-xs ${PITCH_LOG_CLEAR_PAD_CLASS}`}
                  >
                    Clear
                    </button>
              </div>

                <div
                  role="status"
                  aria-live="polite"
                  aria-label={`Count ${displayCountBalls}-${displayCountStrikes}, ${displayPitchesSeen ?? "—"} pitches, ${displayStrikesThrown ?? "—"} strikes thrown`}
                  className="mt-2"
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
            </div>

                <div className="flex min-h-0 min-w-0 flex-col sm:order-1">
                  <div className="mb-1 flex min-h-5 shrink-0 items-baseline justify-between gap-2">
                    <span className="font-heading text-xs font-semibold text-[var(--text)]">
                      Sequence
                    </span>
                    {selectedGameId ? (
                      <span className="shrink-0 text-[9px] tabular-nums text-[var(--text-muted)]">
                        {coachPitchesLoading ? "…" : `${coachPitchRows.length} on iPad`}
                      </span>
                    ) : null}
                  </div>
                  <div
                    ref={pitchSequenceScrollRef}
                    className={`mt-1 min-h-0 ${
                      pitchSequenceListScrollable
                        ? "max-h-[calc(6*2.5rem+5*0.25rem)] overflow-y-auto overflow-x-hidden overscroll-contain pl-0.5 [direction:rtl]"
                        : ""
                    }`}
                  >
                  {mergedSequenceLength > 0 ? (
                    <ul className="space-y-1 [direction:ltr]">
                      {Array.from({ length: mergedSequenceLength }, (_, i) => {
                        const draftRow = draftPitchLog[i];
                        const coachRow = coachPitchRowByAbIndex.get(i + 1);
                        const coachType = coachRow?.pitch_type ?? null;
                        if (draftRow) {
                          const row = draftRow;
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
                        return (
                            <li key={row.clientKey}>
                              <div
                                className={`${PITCH_SEQUENCE_ROW_CLASS} border bg-[var(--bg-base)]/50 ${pitchLogOutcomeSequenceBorderClass(row.outcome)}`}
                                aria-label={`Pitch ${i + 1}: ${pitchTrackerAbbrev(coachType)} ${lbl} count ${row.balls_before}-${row.strikes_before} to ${after.balls}-${after.strikes}`}
                              >
                                <span
                                  className={`inline-flex h-5 min-w-[1.75rem] shrink-0 items-center justify-center rounded border px-1 text-[10px] font-bold ${pitchTrackerTypeChipClass(coachType)}`}
                                  title={pitchTrackerTypeLabel(coachType)}
                                >
                                  {pitchTrackerAbbrev(coachType)}
                                </span>
                                <span className="min-w-0 shrink-0 font-semibold text-[var(--text)]">
                                  {lbl}
                                </span>
                                <PitchPadCountTransition
                                  beforeBalls={row.balls_before}
                                  beforeStrikes={row.strikes_before}
                                  after={{ balls: after.balls, strikes: after.strikes }}
                                />
                        </div>
                            </li>
                          );
                        }
                        if (coachRow) {
                          const prefixBeforeCoach: PitchSequenceEntry[] = draftPitchLog.slice(0, i).map((r) => ({
                            balls_before: r.balls_before,
                            strikes_before: r.strikes_before,
                            outcome: r.outcome,
                          }));
                          const countBeforeThis = replayCountAtEndOfSequence(prefixBeforeCoach);
                                return (
                            <li key={coachRow.id}>
                              <div
                                className={`${PITCH_SEQUENCE_ROW_CLASS} border border-dashed border-[var(--accent)]/45 bg-[var(--bg-base)]/40`}
                                aria-label={`Pitch ${i + 1}: ${pitchTrackerAbbrev(coachType)} — awaiting pitch log, count before pitch ${countBeforeThis.balls}-${countBeforeThis.strikes}`}
                              >
                                <span
                                  className={`inline-flex h-5 min-w-[1.75rem] shrink-0 items-center justify-center rounded border px-1 text-[10px] font-bold ${pitchTrackerTypeChipClass(coachType)}`}
                                  title={pitchTrackerTypeLabel(coachType)}
                                >
                                  {pitchTrackerAbbrev(coachType)}
                                </span>
                                <span className="min-w-0 shrink-0 font-medium text-[var(--text-muted)]">
                                  Awaiting pitch log
                                </span>
                                <PitchPadCountTransition
                                  beforeBalls={countBeforeThis.balls}
                                  beforeStrikes={countBeforeThis.strikes}
                                  after={null}
                                />
                              </div>
                            </li>
                          );
                        }
                        return null;
                      })}
                      {result != null &&
                        draftPitchLog.length > 0 &&
                        livePitchSequenceSummary != null &&
                        livePitchSequenceSummary.pitches_seen > draftPitchLog.length && (
                          <li>
                            <div
                              className={`${PITCH_SEQUENCE_ROW_CLASS} gap-1.5 border border-dashed border-[var(--accent)]/45 bg-[var(--accent-dim)]/10 text-[10px] text-[var(--text-muted)]`}
                            >
                              <span className="font-medium text-[var(--accent)]">
                                {resultImpliesBattedBallInPlay(result)
                                  ? "+ In play"
                                  : result === "bb" || result === "ibb"
                                    ? "+ Ball 4"
                                    : result === "hbp"
                                      ? "+ HBP"
                                      : "+ Pitch"}
                            </span>
                              <span className="truncate">
                                ({RESULT_OPTIONS.find((o) => o.value === result)?.label ?? result})
                              </span>
                        </div>
                          </li>
                        )}
                      <li ref={pitchSequenceEndRef} className="h-px shrink-0 overflow-hidden" aria-hidden />
                    </ul>
                  ) : !selectedGameId ? (
                    <p className="py-2 text-[11px] leading-snug text-[var(--text-muted)]">
                      Tap Ball, Called, Whiff, or Foul — each pitch appears here.
                    </p>
                  ) : (
                    <p className="py-1 text-[10px] leading-snug text-[var(--text-muted)]">
                      Log a pitch on the pad or on the iPad — each pitch appears here (type from coach, result from
                      pad).
                        </p>
                      )}
                  </div>
                </div>
              </div>
            </section>
            </div>

            {/* Outcome */}
            <section
              className="min-h-0 rounded border border-[var(--border)] bg-[var(--bg-elevated)] p-2 sm:p-3 lg:order-1 lg:sticky lg:top-2 lg:z-20 lg:max-h-[calc(100dvh-5rem)] lg:overflow-y-auto lg:overscroll-contain"
              aria-labelledby="record-h-outcome"
            >
              <h4
                id="record-h-outcome"
                className="scroll-mt-20 font-display mb-2 text-[10px] font-semibold uppercase tracking-wider text-white"
              >
                Outcome
              </h4>
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-5">
                    {(["Hits", "Outs", "Reach", "Other"] as const).map((label) => {
                        const group = RESULT_GROUPS.find((g) => g.label === label);
                        if (!group) return null;
                      const runnerAware = label === "Outs" || label === "Other";
                      const gridClass =
                        label === "Hits"
                          ? "grid grid-cols-4 gap-2"
                          : label === "Outs"
                            ? "grid grid-cols-2 gap-2 sm:grid-cols-4"
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
                              const shortcut = outcomeShortcutDigit(opt.value);
                              const title = [
                                runnerAware ? runnerHint : null,
                                countHint,
                                shortcut != null ? `Shortcut: ${shortcut}` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ") || undefined;
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
                                title={
                                  errorFielderId
                                    ? `Fielding error: ${players.find((p) => p.id === errorFielderId)?.name ?? "?"}. Tap to change.`
                                    : result == null
                                      ? "Charge a fielding error on this play (pick outcome if needed; save checks that error matches result and bases)."
                                      : RESULT_ALLOWS_OPTIONAL_ERROR_ON_HIT.has(result)
                                        ? "Charge a fielding error after a clean hit (batter keeps 1B / 2B / 3B)."
                                        : "Charge a fielding error on this play (e.g. errant throw on a steal). Save must match outcome and base state."
                                }
                                onClick={() => {
                                  setErrorFielderModalMode("hit");
                                }}
                                className={`min-h-[42px] w-full rounded-lg border-2 px-2 py-2 text-center text-xs font-semibold transition duration-200 touch-manipulation sm:min-h-[44px] sm:px-2.5 sm:text-sm ${
                                  errorFielderId
                                    ? "cursor-pointer border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)] hover:opacity-90"
                                    : "cursor-pointer border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--bg-elevated)]"
                                }`}
                              >
                                Error
                              </button>
                            ) : null}
                            </div>
                          {label === "Other" && errorFielderId ? (
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
                              setBattedBallType((t) => (t === value ? null : value))
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
                                const reachedOnError = playerIdsReachedOnError.has(id);
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
                                        if (adding && reachedOnError) {
                                          setUnearnedRunsScoredPlayerIds((prev) =>
                                            prev.includes(id) ? prev : [...prev, id]
                                          );
                                        }
                                        if (result !== "hr" && adding) {
                                          setRbi((r) => Math.min(r + 1, 4));
                                        }
                                      }}
                                      className={`min-h-[40px] rounded-lg border-2 px-2.5 py-1.5 text-left text-xs font-semibold transition touch-manipulation ${
                                        selected
                                          ? unearned
                                            ? "border-[var(--danger)]/70 bg-[var(--accent)] text-[var(--bg-base)]"
                                            : "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)]"
                                          : reachedOnError
                                            ? "border-[var(--danger)]/45 bg-[var(--bg-input)] text-[var(--text)] hover:border-[var(--danger)]/55"
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
                                        {reachedOnError ? (
                                          <span
                                            className={
                                              selected
                                                ? "ml-1 font-semibold text-cyan-950/90"
                                                : "ml-1 font-semibold text-[var(--danger)]"
                                            }
                                          >
                                            · ROE
                                          </span>
                                        ) : null}
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
                                    {selected &&
                                    (result === "hr" ||
                                      showEarnedUnearnedRunControls ||
                                      reachedOnError) ? (
                                      reachedOnError ? (
                                        <span
                                          className="inline-flex min-h-[28px] items-center rounded-md border border-[var(--danger)]/85 bg-[var(--danger-dim)] px-2 text-[11px] font-bold text-[var(--danger)]"
                                          title="Reached on error — this run is unearned vs pitcher ERA"
                                        >
                                          UE
                                        </span>
                                      ) : (
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
                                      )
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
                {showDetails ? "âˆ’ Hide details" : "+ Add details (play, notes)"}
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

            <RecordPrimaryActions
              hasLastPa={Boolean(lastPA)}
              destructivePending={destructivePending}
              saving={saving}
              savePaDisabled={savePaDisabled}
              clearingPAs={clearingPAs}
              isDemoGame={isDemoId(selectedGameId)}
              onUndoLastPa={requestUndoLastPA}
              onSubstitution={() => setSubstitutionModalOpen(true)}
              onClearPas={() => setDestructiveConfirm("clearGamePas")}
              onSave={handleSave}
            />
            </div>
              <div className="order-2 w-full max-w-[300px] shrink-0 self-start lg:order-1 lg:min-w-[260px]">
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
                      onBaserunning={
                        selectedGameId && !recordLocked && !isDemoId(selectedGameId)
                          ? handleBaserunning
                          : undefined
                      }
                    />
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

          {lastSavedPaSummary ? <RecordLastPaSummary summary={lastSavedPaSummary} /> : null}

          <div className="space-y-3">
            <RecordBoxScoreSection
              isLg={isLg}
              toggleLabel={recordBoxScoreToggleLabel}
              onTogglePeekOther={() => setBattingTablePeekOther((v) => !v)}
              battingTeamName={battingTableTeamName}
              pitchingTeamName={pitchingTableTeamName}
              selectedGame={selectedGame}
              pasForBattingTable={pasForBattingTable}
              allPAsForGame={allPAsForGame}
              players={players}
              lineupOrder={lineupForBattingTable.order}
              lineupPositionByPlayerId={lineupForBattingTable.positionByPlayerId}
              highlightedBatterId={batterId}
              battingTablePeekOther={battingTablePeekOther}
              baserunningByPlayerId={baserunningByPlayerId}
              baserunningEvents={baserunningEvents}
              recordLocked={recordLocked}
              isDemoGame={isDemoId(selectedGameId)}
              onDeleteBaserunningEvent={handleDeleteBaserunningEvent}
              pitchingSideForBox={pitchingSideForBox}
              pasForPitchMix={pasForPitchMixUnderPitchingTable}
              pitchEventsForMix={pitchEventsForPitchMixCard}
              distributionPitchEventsForMix={distributionPitchEventsForPitchMixCard}
              currentPitcherId={pitcherId}
              hidePitchTypeMix={!isOurPitchingSideForBox}
            />
          </div>
        </main>
      )}

      {finalizeModalOpen && selectedGameId && selectedGame && (
        <FinalizeGameModal
          open
          onClose={() => !finalizingGame && setFinalizeModalOpen(false)}
          game={selectedGame}
          pas={allPAsForGame}
          players={players}
          finalHomeRuns={liveHomeRuns}
          finalAwayRuns={liveAwayRuns}
          initialWinningPitcherId={selectedGame.winning_pitcher_id}
          initialSavePitcherId={selectedGame.save_pitcher_id}
          initialLosingPitcherId={selectedGame.losing_pitcher_id}
          pending={finalizingGame}
          onConfirm={(winningPitcherId, savePitcherId, losingPitcherId) =>
            handleFinalizeGame(winningPitcherId, savePitcherId, losingPitcherId)
          }
        />
      )}

      {statPitchTypeDetail != null ? (
        <PitchTypeStatsModal
          detail={statPitchTypeDetail}
          pitcherName={pitcherNameForPitchTypeStats}
          onClose={() => setStatPitchType(null)}
        />
      ) : null}

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

      {errorFielderModalMode != null && selectedGameId && selectedGame ? (
        <ReachedOnErrorFielderModal
          pitchingTeamName={livePitchingTeamName}
          fielders={fieldersForErrorPicker}
          positionByPlayerId={positionByPlayerIdForRoeModal}
          moundPitcherId={pitcherId}
          initialFielderId={errorFielderId}
          title={errorFielderModalMode === "hit" ? "Error on the bases" : undefined}
          description={
            errorFielderModalMode === "hit"
              ? `The batter still gets credit for the hit (${RESULT_OPTIONS.find((o) => o.value === result)?.label ?? "1B–3B"}). Choose the ${livePitchingTeamName} fielder charged with the error (e.g. misplay or bad throw for an extra base).`
              : undefined
          }
          onCancel={handleErrorFielderModalCancel}
          onConfirm={handleErrorFielderModalConfirm}
        />
      ) : null}

      {pitcherChangeModalOpen && selectedGame ? (
        <RecordPitcherChangeModal
          open
          onClose={() => setPitcherChangeModalOpen(false)}
          teamName={pitchingSide === "home" ? selectedGame.home_team : selectedGame.away_team}
          currentPitcherId={pitcherId}
          pitchers={pitchersForDropdown}
          onQuickAddPitcher={
            canQuickAddOpponentPitcher
              ? () => setQuickAddPitcherOpen(true)
              : undefined
          }
          onApply={(playerId) => {
            setPitcherId(playerId);
            setPitcherBySide((prev) => ({ ...prev, [pitchingSide]: playerId }));
            const name = players.find((p) => p.id === playerId)?.name ?? "Pitcher";
            showMsg("success", `${name} is on the mound.`);
          }}
        />
      ) : null}

      {substitutionModalOpen && selectedGameId && selectedGame && (
        <RecordSubstitutionModal
          open
          onClose={() => setSubstitutionModalOpen(false)}
          gameId={selectedGameId}
          game={selectedGame}
          defaultSide={battingSide}
          awayLineup={lineupAway}
          homeLineup={lineupHome}
          unavailableBySide={unavailableBySide}
          players={players}
          onSave={saveRecordGameLineup}
          onApplied={(side, order, positionByPlayerId, unavailableForSide) => {
            const prevOrder =
              side === "away" ? lineupAway.order : lineupHome.order;
            const mergedUnavailable = [
              ...new Set([
                ...unavailableForSide,
                ...prevOrder.filter((id) => !order.includes(id)),
              ]),
            ];
            const nextUnavailableBySide: UnavailableBySide = {
              ...unavailableBySide,
              [side]: mergedUnavailable,
            };
            setUnavailableBySide(nextUnavailableBySide);
            if (selectedGameId) writeUnavailablePlayers(selectedGameId, nextUnavailableBySide);
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
              const n1 = runnerOn1bId && eligible.has(runnerOn1bId) ? runnerOn1bId : null;
              const n2 = runnerOn2bId && eligible.has(runnerOn2bId) ? runnerOn2bId : null;
              const n3 = runnerOn3bId && eligible.has(runnerOn3bId) ? runnerOn3bId : null;
              setRunnerOn1bId(n1);
              setRunnerOn2bId(n2);
              setRunnerOn3bId(n3);
              setBaseState(baseStateFromRunnerIds(n1, n2, n3));
              if (order.length > 0) {
                if (batterId && order.includes(batterId) && eligible.has(batterId)) {
                  setNextBatterIndexBySide((prev) => ({
                    ...prev,
                    [battingSide]: lineupSlotForBatterId(order, batterId),
                  }));
                } else {
                  const rememberedSlot =
                    batterId && prevOrder.length > 0
                      ? lineupSlotForBatterId(prevOrder, batterId)
                      : Math.min(
                          Math.max(0, nextBatterIndexBySide[battingSide] ?? 0),
                          order.length - 1
                        );
                  const nextId = batterIdAtLineupSlot(order, players, rememberedSlot);
                  if (nextId && eligible.has(nextId)) {
                    setBatterId(nextId);
                    setNextBatterIndexBySide((prev) => ({
                      ...prev,
                      [battingSide]: rememberedSlot,
                    }));
                  }
                }
              }
            }
            showMsg(
              "success",
              `Lineup saved (${side === "away" ? selectedGame.away_team : selectedGame.home_team})`
            );
          }}
        />
      )}

      {quickAddPitcherOpen && canQuickAddOpponentPitcher ? (
        <QuickAddPitcherModal
          open
          opponentTeam={pitchingTeamForQuickAdd}
          onClose={() => setQuickAddPitcherOpen(false)}
          onSave={insertPlayerAction}
          onCreated={handleQuickAddPitcherCreated}
        />
      ) : null}

      {quickAddPlayerOpen && canQuickAddOpponentPlayer ? (
        <QuickAddPlayerModal
          open
          opponentTeam={battingTeamForQuickAdd}
          lineupOrder={lineupForBatting.order}
          players={players}
          onClose={() => setQuickAddPlayerOpen(false)}
          onSave={insertPlayerAction}
          onCreated={handleQuickAddPlayerCreated}
        />
      ) : null}

      {shortcutsHelpOpen ? (
        <RecordShortcutsHelpModal open onClose={() => setShortcutsHelpOpen(false)} />
      ) : null}
    </div>
  );
}
