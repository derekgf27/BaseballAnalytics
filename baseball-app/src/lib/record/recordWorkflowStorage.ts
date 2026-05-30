import type { BattedBallType } from "@/lib/types";
import type { RecordResumeSnapshotV1, RecordWorkflowDefaultsV1 } from "@/lib/record/recordPageTypes";

const RECORD_WORKFLOW_DEFAULTS_KEY = "record-workflow-defaults:v1";

export function readWorkflowDefaults(): RecordWorkflowDefaultsV1 {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(RECORD_WORKFLOW_DEFAULTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as RecordWorkflowDefaultsV1;
  } catch {
    return {};
  }
}

export function writeWorkflowDefaults(next: RecordWorkflowDefaultsV1) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECORD_WORKFLOW_DEFAULTS_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

export function mergeWorkflowDefaultsForGame(
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
