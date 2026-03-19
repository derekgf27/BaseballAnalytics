"use client";

import type { HitDirection } from "@/lib/types";

export interface TeamSprayChartProps {
  /** PAs with hit_direction set (balls in play). Data should already be filtered by batter hand (R or L). */
  data: { hit_direction: HitDirection }[];
  /** Batter hand for this chart. RHB: pull=LF, oppo=RF. LHB: pull=RF, oppo=LF. */
  hand: "R" | "L";
  /** Smaller size for side-by-side layout. */
  compact?: boolean;
  className?: string;
}

/** Red fill for a section: 0% = very light red, 100% = deep intense red. */
function redForPercentage(pct: number): string {
  const t = Math.max(0, Math.min(1, pct / 100));
  const saturation = 40 + 45 * t;
  const lightness = 96 - 50 * t;
  return `hsl(0, ${saturation}%, ${lightness}%)`;
}

export function TeamSprayChart({ data, hand, compact = false, className = "" }: TeamSprayChartProps) {
  const width = compact ? 360 : 480;
  const height = compact ? 240 : 320;

  const total = data.length;
  const pulledCount = data.filter((pa) => pa.hit_direction === "pulled").length;
  const centerCount = data.filter((pa) => pa.hit_direction === "up_the_middle").length;
  const oppositeCount = data.filter((pa) => pa.hit_direction === "opposite_field").length;

  // Map to outfield: left wedge = LF, middle = CF, right wedge = RF.
  // RHB: pull -> LF (left), up_the_middle -> CF, oppo -> RF (right).
  // LHB: pull -> RF (right), up_the_middle -> CF, oppo -> LF (left).
  const leftCount = hand === "R" ? pulledCount : oppositeCount;
  const rightCount = hand === "R" ? oppositeCount : pulledCount;

  const pctLF = total > 0 ? (leftCount / total) * 100 : 0;
  const pctCF = total > 0 ? (centerCount / total) * 100 : 0;
  const pctRF = total > 0 ? (rightCount / total) * 100 : 0;

  // Field: home at bottom center; rounded outfield arc at top. Three wedges = LF, CF, RF.
  const cx = width / 2;
  const homeY = height * 0.88;
  const leftX = width * 0.12;
  const leftY = height * 0.38;
  const topY = height * 0.08;
  const rightX = width * 0.88;
  const rightY = height * 0.38;

  const arcTopY = topY - 28;
  const controlX = cx;
  const controlY = arcTopY;

  function bezierPoint(t: number) {
    const x = (1 - t) ** 2 * leftX + 2 * (1 - t) * t * controlX + t ** 2 * rightX;
    const y = (1 - t) ** 2 * leftY + 2 * (1 - t) * t * controlY + t ** 2 * rightY;
    return { x, y };
  }
  const midLeft = bezierPoint(1 / 3);
  const midRight = bezierPoint(2 / 3);

  const leftControlY = (2 / 3) * leftY + (1 / 3) * controlY;
  const leftControlX = (2 / 3) * leftX + (1 / 3) * controlX;
  const rightControlY = (1 / 3) * controlY + (2 / 3) * rightY;
  const rightControlX = (1 / 3) * controlX + (2 / 3) * rightX;
  const midControlY = (5 / 9) * controlY + (2 / 9) * (leftY + rightY);
  const midControlX = (5 / 9) * controlX + (2 / 9) * (leftX + rightX);

  const leftPath = `M ${cx} ${homeY} L ${leftX} ${leftY} Q ${leftControlX} ${leftControlY} ${midLeft.x} ${midLeft.y} Z`;
  const middlePath = `M ${cx} ${homeY} L ${midLeft.x} ${midLeft.y} Q ${midControlX} ${midControlY} ${midRight.x} ${midRight.y} Z`;
  const rightPath = `M ${cx} ${homeY} L ${midRight.x} ${midRight.y} Q ${rightControlX} ${rightControlY} ${rightX} ${rightY} Z`;

  // Label position: x centered in each wedge; y in the middle band (halfway between home plate and outfield wall).
  const labelY = (homeY + controlY) / 2;
  const labelLeft = { x: (cx + leftX + midLeft.x) / 3, y: labelY };
  const labelMiddle = { x: (cx + midLeft.x + midRight.x + cx) / 4, y: labelY };
  const labelRight = { x: (cx + midRight.x + rightX) / 3, y: labelY };

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-full"
        aria-label={`Spray chart for ${hand === "R" ? "right" : "left"}-handed batters: LF, CF, RF`}
      >
        <path
          d={`M ${cx} ${homeY} L ${leftX} ${leftY} Q ${controlX} ${controlY} ${rightX} ${rightY} Z`}
          fill="none"
          stroke="var(--border)"
          strokeWidth="1.5"
        />

        <path d={leftPath} fill={redForPercentage(pctLF)} stroke="var(--border)" strokeWidth="1" />
        <text x={labelLeft.x} y={labelLeft.y} textAnchor="middle" dominantBaseline="middle" fill="#1f2937" fontSize={compact ? 12 : 16} fontWeight="700" fontFamily="var(--font-sans)">
          {total > 0 ? `${Math.round(pctLF)}%` : "—"}
        </text>

        <path d={middlePath} fill={redForPercentage(pctCF)} stroke="var(--border)" strokeWidth="1" />
        <text x={labelMiddle.x} y={labelMiddle.y} textAnchor="middle" dominantBaseline="middle" fill="#1f2937" fontSize={compact ? 12 : 16} fontWeight="700" fontFamily="var(--font-sans)">
          {total > 0 ? `${Math.round(pctCF)}%` : "—"}
        </text>

        <path d={rightPath} fill={redForPercentage(pctRF)} stroke="var(--border)" strokeWidth="1" />
        <text x={labelRight.x} y={labelRight.y} textAnchor="middle" dominantBaseline="middle" fill="#1f2937" fontSize={compact ? 12 : 16} fontWeight="700" fontFamily="var(--font-sans)">
          {total > 0 ? `${Math.round(pctRF)}%` : "—"}
        </text>

        <text x={width * 0.22} y={height * 0.96} textAnchor="middle" fill="var(--text-muted)" fontSize={compact ? 9 : 11} fontFamily="var(--font-display)">LF</text>
        <text x={cx} y={height * 0.96} textAnchor="middle" fill="var(--text-muted)" fontSize={compact ? 9 : 11} fontFamily="var(--font-display)">CF</text>
        <text x={width * 0.78} y={height * 0.96} textAnchor="middle" fill="var(--text-muted)" fontSize={compact ? 9 : 11} fontFamily="var(--font-display)">RF</text>
      </svg>
      {data.length > 0 && (
        <p className={`mt-1.5 text-center text-[var(--text-muted)] ${compact ? "text-[9px]" : "text-[10px]"}`}>
          {total} ball{total !== 1 ? "s" : ""} in play · LF / CF / RF
        </p>
      )}
      {data.length === 0 && (
        <p className="mt-2 text-center text-sm text-[var(--text-muted)]">
          No balls in play with direction recorded for {hand === "R" ? "right" : "left"}-handed batters.
        </p>
      )}
    </div>
  );
}
