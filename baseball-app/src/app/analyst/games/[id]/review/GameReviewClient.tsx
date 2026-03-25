"use client";

import Link from "next/link";
import { BoxScore } from "@/components/analyst/BoxScore";
import { BattingPitchMixCard } from "@/components/analyst/BattingPitchMixCard";
import { plateAppearancesForPitchingSide } from "@/lib/compute/gamePitchingBox";
import { GameBattingTable } from "@/components/analyst/GameBattingTable";
import { GamePitchingBoxTable } from "@/components/analyst/GamePitchingBoxTable";
import { formatDateMMDDYYYY } from "@/lib/format";
import type { Game, PlateAppearance, Player } from "@/lib/types";

interface GameReviewClientProps {
  game: Game;
  /** Full game PAs (for linescore). */
  pasAll: PlateAppearance[];
  pasAway: PlateAppearance[];
  pasHome: PlateAppearance[];
  players: Player[];
  awayLineupOrder?: string[];
  homeLineupOrder?: string[];
  awayLineupPositionByPlayerId?: Record<string, string>;
  homeLineupPositionByPlayerId?: Record<string, string>;
  baserunningByPlayerId?: Record<string, { sb: number; cs: number }>;
}

export function GameReviewClient({
  game,
  pasAll,
  pasAway,
  pasHome,
  players,
  awayLineupOrder,
  homeLineupOrder,
  awayLineupPositionByPlayerId,
  homeLineupPositionByPlayerId,
  baserunningByPlayerId,
}: GameReviewClientProps) {
  const gameLabel = `${formatDateMMDDYYYY(game.date)} ${game.away_team} @ ${game.home_team}`;

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">
            Box score
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{gameLabel}</p>
        </div>
        <Link href={`/analyst/record?gameId=${game.id}`} className="text-sm text-[var(--accent)] hover:underline">
          Record PAs
        </Link>
      </header>

      <section>
        <h2 className="font-display mb-2 text-sm font-semibold uppercase tracking-wider text-white">
          Box score
        </h2>
        <BoxScore game={game} pas={pasAll} />
      </section>

      <GameBattingTable
        game={game}
        teamName={game.away_team}
        pas={pasAway}
        players={players}
        lineupOrder={awayLineupOrder}
        lineupPositionByPlayerId={awayLineupPositionByPlayerId}
        baserunningByPlayerId={baserunningByPlayerId}
        showPitchData={false}
      />

      <div className="flex flex-col gap-4">
        <GamePitchingBoxTable game={game} side="away" pas={pasAll} players={players} />
        <BattingPitchMixCard pas={plateAppearancesForPitchingSide(pasAll, "away")} players={players} />
      </div>

      <GameBattingTable
        game={game}
        teamName={game.home_team}
        pas={pasHome}
        players={players}
        lineupOrder={homeLineupOrder}
        lineupPositionByPlayerId={homeLineupPositionByPlayerId}
        baserunningByPlayerId={baserunningByPlayerId}
        showPitchData={false}
      />

      <div className="flex flex-col gap-4">
        <GamePitchingBoxTable game={game} side="home" pas={pasAll} players={players} />
        <BattingPitchMixCard pas={plateAppearancesForPitchingSide(pasAll, "home")} players={players} />
      </div>
    </div>
  );
}
