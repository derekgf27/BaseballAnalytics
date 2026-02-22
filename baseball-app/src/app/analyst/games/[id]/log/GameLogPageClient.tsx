"use client";

import Link from "next/link";

interface GameLogPageClientProps {
  gameId: string;
  gameLabel: string;
}

export function GameLogPageClient({
  gameId,
  gameLabel,
}: GameLogPageClientProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">Game</h1>
        <Link href="/analyst/games" className="text-sm font-medium text-[var(--accent)] hover:underline">
          ← Games
        </Link>
      </div>
      <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-muted)]">
        {gameLabel}
      </p>
      <p className="text-sm text-[var(--text-muted)]">
        To log plate appearances for this game, use{" "}
        <Link href="/analyst/record" className="font-medium text-[var(--accent)] hover:underline">
          Record PAs
        </Link>
        .
      </p>
      <Link
        href={`/analyst/games/${gameId}/review`}
        className="inline-block text-sm font-medium text-[var(--accent)] hover:underline"
      >
        Box score →
      </Link>
    </div>
  );
}
