"use client";

import type { SprayResultFilterKey } from "@/lib/sprayChartFilters";
import { TeamSprayChart } from "@/components/analyst/TeamSprayChart";
import type { HitDirection } from "@/lib/types";
import { CHARTS_SAMPLE_WARNING_BIP } from "./chartTypes";
import { sprayResultLabel } from "./chartsFilters";

type SpraySplit = {
  pas: readonly unknown[];
  data: { hit_direction: HitDirection }[];
  hits: number;
  outs: number;
};

type ChartsSpraySectionProps = {
  spray: SprayResultFilterKey;
  rhb: SpraySplit;
  lhb: SpraySplit;
  pitchingLhb: SpraySplit;
  pitchingRhb: SpraySplit;
};

function SprayCard({
  title,
  description,
  split,
  hand,
}: {
  title: string;
  description: string;
  split: SpraySplit;
  hand: "L" | "R";
}) {
  const { pas, data, hits, outs } = split;
  return (
    <section className="card-tech rounded-lg border border-[var(--border)] p-5">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-white">{title}</h3>
      <p className="charts-spray-card-desc mt-1 text-xs text-[var(--text-muted)]">{description}</p>
      <p className="mt-1 text-xs tabular-nums">
        <span className="text-[var(--accent)]">{pas.length}</span>
        <span className="text-white"> BIP · </span>
        <span className="text-[var(--accent)]">{hits}</span>
        <span className="text-white"> hits · </span>
        <span className="text-[var(--accent)]">{outs}</span>
        <span className="text-white"> outs</span>
      </p>
      {pas.length < CHARTS_SAMPLE_WARNING_BIP && pas.length > 0 && (
        <p className="mt-2 text-xs text-amber-300">Small sample ({pas.length} BIP).</p>
      )}
      {pas.length === 0 && <p className="mt-2 text-xs text-[var(--text-muted)]">No BIP in this filter.</p>}
      <div className="mt-4 min-h-[280px]">
        <TeamSprayChart data={data} hand={hand} />
      </div>
    </section>
  );
}

export function ChartsSpraySection({
  spray,
  rhb,
  lhb,
  pitchingLhb,
  pitchingRhb,
}: ChartsSpraySectionProps) {
  return (
    <>
      <div id="charts-spray-batter" data-pdf-avoid-break className="charts-pdf-block scroll-mt-28 space-y-3">
        <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-white)]">
          Team batter — balls in play ({sprayResultLabel(spray)})
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <SprayCard
            title="Right-handed batters"
            description="Balls in play from RHB and switch hitters when batting right (vs LHP). Wedges = LF, CF, RF."
            split={rhb}
            hand="R"
          />
          <SprayCard
            title="Left-handed batters"
            description="Balls in play from LHB and switch hitters when batting left (vs RHP). Wedges = LF, CF, RF."
            split={lhb}
            hand="L"
          />
        </div>
      </div>

      <div id="charts-spray-pitching" data-pdf-avoid-break className="charts-pdf-block scroll-mt-28 space-y-3">
        <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-white)]">
          Team pitching — balls in play allowed ({sprayResultLabel(spray)})
        </h2>
        <p className="charts-spray-card-desc text-xs text-[var(--text-muted)]">
          Splits by opposing batter (your pitcher on the mound). Spray result filter applies here too.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <SprayCard
            title="vs LHB"
            description="Left-handed batters and switch hitters batting left (vs RHP)."
            split={pitchingLhb}
            hand="L"
          />
          <SprayCard
            title="vs RHB"
            description="Right-handed batters and switch hitters batting right (vs LHP)."
            split={pitchingRhb}
            hand="R"
          />
        </div>
      </div>
    </>
  );
}
