"use client";

import { TeamSprayChart } from "@/components/analyst/TeamSprayChart";
import type { HitDirection } from "@/lib/types";
import type { Player } from "@/lib/types";

export interface ChartsClientProps {
  /** PAs with hit_direction, batter_id, and pitcher_hand for team spray chart. */
  sprayData: { game_id: string; batter_id: string; hit_direction: string; result: string; pitcher_hand: "L" | "R" | null }[];
  players: Player[];
}

/** For switch hitters, infer which side they batted from: vs LHP → R, vs RHP → L. Returns null if S but pitcher_hand unknown (PA excluded from both charts). */
function effectiveBatterHand(bats: "L" | "R" | "S" | undefined, pitcherHand: "L" | "R" | null): "L" | "R" | null {
  if (bats === "L" || bats === "R") return bats;
  if (bats === "S") {
    if (pitcherHand === "L") return "R";
    if (pitcherHand === "R") return "L";
    return null;
  }
  return null;
}

export function ChartsClient({ sprayData, players }: ChartsClientProps) {
  const BASE_HIT_RESULTS = new Set(["single", "double", "triple", "hr"]);
  const validPAs = sprayData.filter(
    (pa): pa is { game_id: string; batter_id: string; hit_direction: HitDirection; result: string; pitcher_hand: "L" | "R" | null } =>
      BASE_HIT_RESULTS.has(pa.result) &&
      (pa.hit_direction === "pulled" || pa.hit_direction === "up_the_middle" || pa.hit_direction === "opposite_field")
  );

  const batsByPlayerId = new Map<string, "L" | "R" | "S">();
  players.forEach((p) => {
    const b = p.bats?.toUpperCase();
    if (b === "L" || b === "R" || b === "S") batsByPlayerId.set(p.id, b as "L" | "R" | "S");
  });

  const rhbData: { hit_direction: HitDirection }[] = validPAs.filter((pa) => {
    const bats = batsByPlayerId.get(pa.batter_id);
    return effectiveBatterHand(bats, pa.pitcher_hand) === "R";
  }).map(({ hit_direction }) => ({ hit_direction }));

  const lhbData: { hit_direction: HitDirection }[] = validPAs.filter((pa) => {
    const bats = batsByPlayerId.get(pa.batter_id);
    return effectiveBatterHand(bats, pa.pitcher_hand) === "L";
  }).map(({ hit_direction }) => ({ hit_direction }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">Charts</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Team-level visuals from plate appearances. Individual player charts live on each player&apos;s profile.
        </p>
      </div>

      {/* Spray charts side by side — main focus of the page */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card-tech rounded-lg border border-[var(--border)] p-5">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
            Right-handed batters
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Balls in play from RHB and switch hitters when batting right (vs LHP). Wedges = LF, CF, RF (pull side is left field).
          </p>
          <div className="mt-4 min-h-[280px]">
            <TeamSprayChart data={rhbData} hand="R" />
          </div>
        </section>
        <section className="card-tech rounded-lg border border-[var(--border)] p-5">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
            Left-handed batters
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Balls in play from LHB and switch hitters when batting left (vs RHP). Wedges = LF, CF, RF (pull side is right field).
          </p>
          <div className="mt-4 min-h-[280px]">
            <TeamSprayChart data={lhbData} hand="L" />
          </div>
        </section>
      </div>

      {/* Placeholders for chase tendencies and compare players */}
      <div className="card-tech p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
            <h3 className="font-display text-sm font-semibold text-[var(--text)]">Contact quality</h3>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Distribution from plate_appearances.contact_quality (Phase 2).</p>
            <div className="mt-4 h-24 rounded-lg bg-[var(--bg-input)] opacity-60" aria-hidden />
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
            <h3 className="font-display text-sm font-semibold text-[var(--text)]">Chase tendencies</h3>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Chase rate by count/zone (Phase 2).</p>
            <div className="mt-4 h-24 rounded-lg bg-[var(--bg-input)] opacity-60" aria-hidden />
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:col-span-2">
            <h3 className="font-display text-sm font-semibold text-[var(--text)]">Compare players</h3>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Select two or more players to compare spray, chase, or other metrics (Phase 2).</p>
            <div className="mt-4 h-32 rounded-lg bg-[var(--bg-input)] opacity-60" aria-hidden />
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:col-span-2">
            <h3 className="font-display text-sm font-semibold text-[var(--text)]">Late-game performance</h3>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Inning 7+ result distribution (Phase 2).</p>
            <div className="mt-4 h-32 rounded-lg bg-[var(--bg-input)] opacity-60" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
