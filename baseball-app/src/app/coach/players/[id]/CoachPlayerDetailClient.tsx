"use client";

import { Card, CardTitle } from "@/components/ui/Card";
import { PlayerTagList } from "@/components/ui/PlayerTag";
import { formatHeight } from "@/lib/height";
import {
  hasPitchingProfileStats,
  PlayerPitchingProfileSections,
} from "@/components/analyst/PlayerPitchingProfileSections";
import { PlayerSprayChartsSection } from "@/components/analyst/PlayerSprayChartsSection";
import { PlayerBattingProfileSections } from "@/app/analyst/roster/[id]/PlayerProfileClient";
import { PlayerProfileHero } from "@/components/shared/PlayerProfileHero";
import { isPitcherPlayer } from "@/lib/opponentUtils";
import type { AnalystPlayerSpraySplits } from "@/lib/analystPlayerSpraySplits";
import {
  PLAYER_ROSTER_STATUS_LABELS,
  resolveRosterStatus,
} from "@/lib/playerRoster";
import type {
  BattingStatsWithSplits,
  PitchEvent,
  PitchingStatsWithSplits,
  PlateAppearance,
  Player,
} from "@/lib/types";

const TREND_STYLES = {
  hot: "bg-[var(--decision-hot-dim)] text-[var(--decision-hot)] border-[var(--decision-hot)]/30",
  cold: "bg-[var(--decision-red-dim)] text-[var(--decision-red)] border-[var(--decision-red)]/30",
  neutral: "bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border)]",
} as const;

interface CoachPlayerDetailClientProps {
  player: Player;
  battingSplits: BattingStatsWithSplits | null;
  pitchingSplits: PitchingStatsWithSplits | null;
  spraySplits: AnalystPlayerSpraySplits | null;
  battingPas?: PlateAppearance[];
  battingPitchEvents?: PitchEvent[];
}

/** Parse YYYY-MM-DD as local date to avoid UTC-off-by-one when displaying. */
function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function CoachPlayerDetailClient({
  player,
  battingSplits,
  pitchingSplits,
  spraySplits,
  battingPas = [],
  battingPitchEvents = [],
}: CoachPlayerDetailClientProps) {
  const isSwitch = player.bats?.toUpperCase().startsWith("S") ?? false;
  const isPitcher = isPitcherPlayer(player);

  const trend = "neutral";
  const trendStyle = TREND_STYLES[trend];
  const trendLabel = "Neutral";

  const today = new Date();
  const age =
    player.birth_date != null && player.birth_date !== ""
      ? (() => {
          const b = parseLocalDate(player.birth_date);
          let a = today.getFullYear() - b.getFullYear();
          if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate()))
            a--;
          return a;
        })()
      : null;

  const formatBirthDate = (d: string) => {
    const date = parseLocalDate(d);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const heightWeight =
    player.height_in != null || player.weight_lb != null
      ? `${player.height_in != null ? formatHeight(player.height_in) : ""}${
          player.height_in != null && player.weight_lb != null ? " " : ""
        }${player.weight_lb != null ? `${player.weight_lb} lb` : ""}`.trim()
      : null;

  const rosterStatus = resolveRosterStatus(player);
  const secondaryFacts = [
    { label: "Status", value: PLAYER_ROSTER_STATUS_LABELS[rosterStatus] },
    heightWeight ? { label: "Height · Weight", value: heightWeight } : null,
    player.hometown?.trim() ? { label: "Hometown", value: player.hometown.trim() } : null,
    player.birth_date ? { label: "Birthday", value: formatBirthDate(player.birth_date) } : null,
    age != null ? { label: "Age", value: `${age} yrs` } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="space-y-6 pb-8">
      <PlayerProfileHero
        player={player}
        secondaryFacts={secondaryFacts}
        titleExtra={
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${trendStyle}`}
          >
            {trendLabel}
          </span>
        }
      >
        <PlayerTagList tags={[]} />
      </PlayerProfileHero>

      {player.staff_notes?.trim() ? (
        <Card>
          <CardTitle>Staff notes</CardTitle>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">
            {player.staff_notes.trim()}
          </p>
        </Card>
      ) : null}

      {battingSplits && !isPitcher ? (
        <PlayerBattingProfileSections
          playerId={player.id}
          battingSplits={battingSplits}
          battingPas={battingPas}
          battingPitchEvents={battingPitchEvents}
        />
      ) : null}

      {pitchingSplits && hasPitchingProfileStats(pitchingSplits) ? (
        <PlayerPitchingProfileSections playerId={player.id} pitchingSplits={pitchingSplits} />
      ) : null}

      <Card>
        <CardTitle>Strengths & weaknesses</CardTitle>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Add notes in Analyst → Players for strengths and watch list.
        </p>
      </Card>

      {spraySplits ? <PlayerSprayChartsSection spraySplits={spraySplits} isSwitch={isSwitch} /> : null}
    </div>
  );
}
