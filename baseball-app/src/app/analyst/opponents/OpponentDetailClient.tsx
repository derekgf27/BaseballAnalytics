"use client";

import Link from "next/link";
import { TeamSprayChart } from "@/components/analyst/TeamSprayChart";
import { BattingStatsSheet } from "@/components/analyst/BattingStatsSheet";
import { formatDateMMDDYYYY } from "@/lib/format";
import type { BattingStatsWithSplits, Game, HitDirection, Player } from "@/lib/types";

export interface OpponentDetailClientProps {
  opponentName: string;
  ourTeamLabel: string;
  games: Game[];
  players: Player[];
  /** Subset with at least one PA vs you — passed to BattingStatsSheet (pitchers-only entries stay off the sheet). */
  battingStatsPlayers: Player[];
  opponentBattingStatsWithSplits: Record<string, BattingStatsWithSplits>;
  sprayData: {
    game_id: string;
    batter_id: string;
    hit_direction: string;
    result: string;
    pitcher_hand: "L" | "R" | null;
  }[];
  /** False when no players are tagged for this opponent — stats sections still show with an empty state. */
  hasTaggedOpponentRoster: boolean;
}

function effectiveBatterHand(
  bats: "L" | "R" | "S" | undefined,
  pitcherHand: "L" | "R" | null
): "L" | "R" | null {
  if (bats === "L" || bats === "R") return bats;
  if (bats === "S") {
    if (pitcherHand === "L") return "R";
    if (pitcherHand === "R") return "L";
    return null;
  }
  return null;
}

export function OpponentDetailClient({
  opponentName,
  ourTeamLabel,
  games,
  players,
  battingStatsPlayers,
  opponentBattingStatsWithSplits,
  sprayData,
  hasTaggedOpponentRoster,
}: OpponentDetailClientProps) {
  const batsByPlayerId = new Map<string, "L" | "R" | "S">();
  players.forEach((p) => {
    const b = p.bats?.toUpperCase();
    if (b === "L" || b === "R" || b === "S") batsByPlayerId.set(p.id, b as "L" | "R" | "S");
  });

  const BASE_HIT_RESULTS = new Set(["single", "double", "triple", "hr"]);
  const validPAs = sprayData.filter(
    (pa): pa is typeof pa & { hit_direction: HitDirection } =>
      BASE_HIT_RESULTS.has(pa.result) &&
      (pa.hit_direction === "pulled" || pa.hit_direction === "up_the_middle" || pa.hit_direction === "opposite_field")
  );

  const rhbData: { hit_direction: HitDirection }[] = validPAs
    .filter((pa) => {
      const bats = batsByPlayerId.get(pa.batter_id);
      return effectiveBatterHand(bats, pa.pitcher_hand) === "R";
    })
    .map(({ hit_direction }) => ({ hit_direction }));

  const lhbData: { hit_direction: HitDirection }[] = validPAs
    .filter((pa) => {
      const bats = batsByPlayerId.get(pa.batter_id);
      return effectiveBatterHand(bats, pa.pitcher_hand) === "L";
    })
    .map(({ hit_direction }) => ({ hit_direction }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">
          {opponentName}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {games.length} game{games.length === 1 ? "" : "s"} vs {ourTeamLabel}. Open Roster for hitters and opposing pitchers.
          {hasTaggedOpponentRoster
            ? " Batting stats and spray charts use only tagged opponent players and plate appearances when they batted against you."
            : " Add opponent players in View roster to see batting stats and spray charts from recorded games."}
        </p>
      </div>

      {/* Roster + Games — side by side on large screens */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section className="card-tech min-w-0 rounded-lg border border-[var(--border)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Roster</h2>
            <Link
              href={`/analyst/players?opponentTeam=${encodeURIComponent(opponentName)}`}
              className="font-display inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] transition hover:opacity-90"
            >
              View roster
            </Link>
          </div>
        </section>

        <section className="card-tech min-w-0 rounded-lg border border-[var(--border)] p-5">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Games</h2>
          {games.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">No games vs this opponent yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {games.map((g) => (
                <li
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-2 last:border-0 last:pb-0"
                >
                  <span className="min-w-0 text-[var(--text)]">
                    {formatDateMMDDYYYY(g.date)} — {g.away_team} @ {g.home_team}
                  </span>
                  <Link
                    href={`/analyst/games/${g.id}/review`}
                    className="font-display inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--bg-base)] transition hover:opacity-90"
                  >
                    Box score
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Batting stats — section always visible; empty state when no tagged roster or no PAs */}
      <section className="card-tech rounded-lg border border-[var(--border)] p-5">
        {!hasTaggedOpponentRoster ? (
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--text)]">Batting stats</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              No opponent players tagged yet. Use Roster → View roster to add players for {opponentName}; stats will show
              here once they have plate appearances vs you.
            </p>
          </div>
        ) : battingStatsPlayers.length === 0 ? (
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--text)]">Batting stats</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              No plate appearances recorded yet for tagged opponent players. Pitchers and others without PAs vs you appear
              in View roster only.
            </p>
          </div>
        ) : (
          <BattingStatsSheet
            players={battingStatsPlayers}
            battingStatsWithSplits={opponentBattingStatsWithSplits}
            heading="Batting stats"
            subheading={`${opponentName} vs ${ourTeamLabel} — tagged opponent players only; PAs when they batted against you.`}
          />
        )}
      </section>

      {/* Spray charts — same card shell as batting; empty state when no data */}
      <section className="card-tech rounded-lg border border-[var(--border)] p-5">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Spray charts</h2>
        {!hasTaggedOpponentRoster ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Tag opponent players in View roster to see spray data from games when those players put the ball in play.
          </p>
        ) : validPAs.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            No batted balls with spray direction and hit type for tagged opponent players yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <section className="card-tech rounded-lg border border-[var(--border)] p-5">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
                Right-handed batters
              </h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                RHB and switch hitters when batting right (vs LHP).
              </p>
              <div className="mt-4 min-h-[280px]">
                <TeamSprayChart data={rhbData} hand="R" />
              </div>
            </section>
            <section className="card-tech rounded-lg border border-[var(--border)] p-5">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
                Left-handed batters
              </h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                LHB and switch hitters when batting left (vs RHP).
              </p>
              <div className="mt-4 min-h-[280px]">
                <TeamSprayChart data={lhbData} hand="L" />
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
