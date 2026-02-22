"use client";

import Link from "next/link";
import { BoxScore } from "@/components/analyst/BoxScore";
import { GameBattingTable } from "@/components/analyst/GameBattingTable";
import { formatDateMMDDYYYY } from "@/lib/format";
import type { Game, PlateAppearance, Player } from "@/lib/types";

interface GameReviewClientProps {
  gameId: string;
  game: Game;
  pas: PlateAppearance[];
  players: Player[];
  lineupOrder?: string[] | null;
  lineupPositionByPlayerId?: Record<string, string>;
}

export function GameReviewClient({
  gameId,
  game,
  pas,
  players,
  lineupOrder,
  lineupPositionByPlayerId,
}: GameReviewClientProps) {
  const gameLabel = `${formatDateMMDDYYYY(game.date)} ${game.away_team} @ ${game.home_team}`;

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            Box score
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{gameLabel}</p>
        </div>
        <Link href="/analyst/record" className="text-sm text-[var(--accent)] hover:underline">
          Record PAs
        </Link>
      </header>

      {/* Box score */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Box score
        </h2>
        <BoxScore game={game} pas={pas} />
      </section>

      {/* Individual batting stats for our team */}
      <GameBattingTable
        game={game}
        pas={pas}
        players={players}
        lineupOrder={lineupOrder}
        lineupPositionByPlayerId={lineupPositionByPlayerId}
      />

      <p className="text-center">
        <Link href="/analyst/games" className="text-sm text-[var(--accent)] hover:underline">
          ← Back to games
        </Link>
      </p>
    </div>
  );
}
