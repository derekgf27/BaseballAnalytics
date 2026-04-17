"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { TeamSprayChart } from "@/components/analyst/TeamSprayChart";
import type { HitDirection } from "@/lib/types";
import type { Player } from "@/lib/types";
import {
  isValidSprayHitDirection,
  SPRAY_CHART_HIT_RESULTS,
  SPRAY_CHART_OUT_RESULTS,
  sprayResultMatchesFilter,
  type SprayResultFilterKey,
  parseSprayResultFilterKey,
} from "@/lib/sprayChartFilters";

export interface ChartsClientProps {
  /** PAs with hit_direction, batter_id, and pitcher_hand for team hitting spray (batters). */
  sprayData: { game_id: string; batter_id: string; hit_direction: string; result: string; pitcher_hand: "L" | "R" | null }[];
  /** Base hits with direction when a club pitcher is on the mound — pitching spray vs LHB / vs RHB. */
  pitchingSprayData: { game_id: string; batter_id: string; hit_direction: string; result: string; pitcher_hand: "L" | "R" | null }[];
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

export function ChartsClient({ sprayData, pitchingSprayData, players }: ChartsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sprayResultFilter = useMemo(
    () => parseSprayResultFilterKey(searchParams.get("spray")),
    [searchParams]
  );
  const setSprayResultFilter = useCallback(
    (next: SprayResultFilterKey) => {
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("spray", next);
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const batsByPlayerId = new Map<string, "L" | "R" | "S">();
  players.forEach((p) => {
    const b = p.bats?.toUpperCase();
    if (b === "L" || b === "R" || b === "S") batsByPlayerId.set(p.id, b as "L" | "R" | "S");
  });

  const filteredHittingPAs = useMemo(() => {
    return sprayData.filter(
      (pa): pa is { game_id: string; batter_id: string; hit_direction: HitDirection; result: string; pitcher_hand: "L" | "R" | null } =>
        isValidSprayHitDirection(pa.hit_direction) && sprayResultMatchesFilter(pa.result, sprayResultFilter)
    );
  }, [sprayData, sprayResultFilter]);

  const filteredPitchingPAs = useMemo(() => {
    return pitchingSprayData.filter(
      (pa): pa is { game_id: string; batter_id: string; hit_direction: HitDirection; result: string; pitcher_hand: "L" | "R" | null } =>
        isValidSprayHitDirection(pa.hit_direction) && sprayResultMatchesFilter(pa.result, sprayResultFilter)
    );
  }, [pitchingSprayData, sprayResultFilter]);

  const rhbPAs = filteredHittingPAs.filter((pa) => {
    const bats = batsByPlayerId.get(pa.batter_id);
    return effectiveBatterHand(bats, pa.pitcher_hand) === "R";
  });
  const rhbData: { hit_direction: HitDirection }[] = rhbPAs.map(({ hit_direction }) => ({ hit_direction }));
  const rhbHits = rhbPAs.filter((pa) => SPRAY_CHART_HIT_RESULTS.has(pa.result)).length;
  const rhbOuts = rhbPAs.filter((pa) => SPRAY_CHART_OUT_RESULTS.has(pa.result)).length;

  const lhbPAs = filteredHittingPAs.filter((pa) => {
    const bats = batsByPlayerId.get(pa.batter_id);
    return effectiveBatterHand(bats, pa.pitcher_hand) === "L";
  });
  const lhbData: { hit_direction: HitDirection }[] = lhbPAs.map(({ hit_direction }) => ({ hit_direction }));
  const lhbHits = lhbPAs.filter((pa) => SPRAY_CHART_HIT_RESULTS.has(pa.result)).length;
  const lhbOuts = lhbPAs.filter((pa) => SPRAY_CHART_OUT_RESULTS.has(pa.result)).length;

  const pitchingLhbPAs = filteredPitchingPAs.filter((pa) => {
    const bats = batsByPlayerId.get(pa.batter_id);
    return effectiveBatterHand(bats, pa.pitcher_hand) === "L";
  });
  const pitchingVsLhbData: { hit_direction: HitDirection }[] = pitchingLhbPAs.map(({ hit_direction }) => ({
    hit_direction,
  }));
  const pitchingLhbHits = pitchingLhbPAs.filter((pa) => SPRAY_CHART_HIT_RESULTS.has(pa.result)).length;
  const pitchingLhbOuts = pitchingLhbPAs.filter((pa) => SPRAY_CHART_OUT_RESULTS.has(pa.result)).length;

  const pitchingRhbPAs = filteredPitchingPAs.filter((pa) => {
    const bats = batsByPlayerId.get(pa.batter_id);
    return effectiveBatterHand(bats, pa.pitcher_hand) === "R";
  });
  const pitchingVsRhbData: { hit_direction: HitDirection }[] = pitchingRhbPAs.map(({ hit_direction }) => ({
    hit_direction,
  }));
  const pitchingRhbHits = pitchingRhbPAs.filter((pa) => SPRAY_CHART_HIT_RESULTS.has(pa.result)).length;
  const pitchingRhbOuts = pitchingRhbPAs.filter((pa) => SPRAY_CHART_OUT_RESULTS.has(pa.result)).length;

  return (
    <div className="space-y-10">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">Charts</h1>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Spray filter sticks in the URL (
              <code className="rounded bg-[var(--bg-elevated)] px-1">?spray=hits|outs|both</code>).
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <span className="font-display uppercase tracking-wider text-white">Filter</span>
            <select
              value={sprayResultFilter}
              onChange={(e) => setSprayResultFilter(e.target.value as SprayResultFilterKey)}
              className="rounded border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
              aria-label="Spray chart result filter"
            >
              <option value="hits">Hits</option>
              <option value="outs">Outs</option>
              <option value="both">Hits + Outs</option>
            </select>
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-white)]">
          Team hitting — balls in play
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card-tech rounded-lg border border-[var(--border)] p-5">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
              Right-handed batters
            </h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Balls in play from RHB and switch hitters when batting right (vs LHP). Wedges = LF, CF, RF (pull side is left field).
            </p>
            <p className="mt-1 text-xs tabular-nums">
              <span className="text-[var(--accent)]">{rhbPAs.length}</span>
              <span className="text-white"> PA: </span>
              <span className="text-[var(--accent)]">{rhbHits}</span>
              <span className="text-white"> Hits</span>
              <span className="text-white"> · </span>
              <span className="text-[var(--accent)]">{rhbOuts}</span>
              <span className="text-white"> Outs</span>
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
              Balls in play from LHB and switch hitters when batting left (vs RHP). Wedges = LF, CF, RF (pull side is right field).
            </p>
            <p className="mt-1 text-xs tabular-nums">
              <span className="text-[var(--accent)]">{lhbPAs.length}</span>
              <span className="text-white"> PA: </span>
              <span className="text-[var(--accent)]">{lhbHits}</span>
              <span className="text-white"> Hits</span>
              <span className="text-white"> · </span>
              <span className="text-[var(--accent)]">{lhbOuts}</span>
              <span className="text-white"> Outs</span>
            </p>
            <div className="mt-4 min-h-[280px]">
              <TeamSprayChart data={lhbData} hand="L" />
            </div>
          </section>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-white)]">
          Team pitching — balls in play allowed
        </h2>
        <p className="text-xs text-[var(--text-muted)]">
          Splits by opposing batter (this pitcher on the mound). Switch hitters use the side they batted from in each PA.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card-tech rounded-lg border border-[var(--border)] p-5">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-white">vs LHB</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Left-handed batters and switch hitters batting left (vs RHP).
            </p>
            <p className="mt-1 text-xs tabular-nums">
              <span className="text-[var(--accent)]">{pitchingLhbPAs.length}</span>
              <span className="text-white"> PA: </span>
              <span className="text-[var(--accent)]">{pitchingLhbHits}</span>
              <span className="text-white"> Hits</span>
              <span className="text-white"> · </span>
              <span className="text-[var(--accent)]">{pitchingLhbOuts}</span>
              <span className="text-white"> Outs</span>
            </p>
            <div className="mt-4 min-h-[280px]">
              <TeamSprayChart data={pitchingVsLhbData} hand="L" />
            </div>
          </section>
          <section className="card-tech rounded-lg border border-[var(--border)] p-5">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-white">vs RHB</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Right-handed batters and switch hitters batting right (vs LHP).
            </p>
            <p className="mt-1 text-xs tabular-nums">
              <span className="text-[var(--accent)]">{pitchingRhbPAs.length}</span>
              <span className="text-white"> PA: </span>
              <span className="text-[var(--accent)]">{pitchingRhbHits}</span>
              <span className="text-white"> Hits</span>
              <span className="text-white"> · </span>
              <span className="text-[var(--accent)]">{pitchingRhbOuts}</span>
              <span className="text-white"> Outs</span>
            </p>
            <div className="mt-4 min-h-[280px]">
              <TeamSprayChart data={pitchingVsRhbData} hand="R" />
            </div>
          </section>
        </div>
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
