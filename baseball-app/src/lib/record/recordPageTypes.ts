import type { PitchSequenceEntry } from "@/lib/compute/pitchSequence";
import type {
  BaseState,
  BattedBallType,
  HitDirection,
  PAResult,
  PitchOutcome,
} from "@/lib/types";

export type DraftPitchRow = PitchSequenceEntry & { clientKey: string };

export type LastSavedPaSummary = {
  inning: number;
  inningHalf: "top" | "bottom" | null;
  batterName: string;
  pitcherName: string;
  resultLabel: string;
  countLabel: string;
  pitchLine: string;
  hitDirectionLabel: string | null;
  errorFielderName: string | null;
  errorFielderNames: string[];
  notes: string | null;
  rbi: number;
  runsScoredNames: string[];
  unearnedRunsScoredNames: string[];
};

export type PersistedRecordFormState = {
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
  unearnedRunsScoredPlayerIds?: string[];
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
  errorFielderId?: string | null;
  errorFielderIds?: string[];
  nextBatterIndexBySide: { away: number; home: number };
  battingTablePeekOther: boolean;
  draftPitchLogRows?: { balls_before: number; strikes_before: number; outcome: PitchOutcome }[];
  /** Monotonic revision for multi-tab conflict detection. */
  revision?: number;
};

export type RecordResumeSnapshotV1 = {
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

export type RecordWorkflowDefaultsV1 = {
  resumeSnapshotByGameId?: Record<string, RecordResumeSnapshotV1>;
  lastBattedBallType?: BattedBallType | null;
};

export type InheritedForPriorPitcher = {
  chargeId: string | null;
  runnerIds: string[];
};
