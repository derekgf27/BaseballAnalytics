import type { AnalystPlayerSpraySplits } from "@/lib/analystPlayerSpraySplits";
import type { BattingStatsWithSplits } from "@/lib/types";

/** Payload for PDF export (club roster hitters / pitchers with spray). */
export interface HitterReportBundle {
  players: { id: string; name: string; bats: string | null; jersey: string | null }[];
  batting: Record<string, BattingStatsWithSplits | undefined>;
  spray: Record<string, AnalystPlayerSpraySplits | null>;
}
