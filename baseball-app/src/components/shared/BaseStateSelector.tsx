"use client";

/**
 * Tap bases to set runner state. base_state = "1st, 2nd, 3rd" as 3-char string "100" = first only.
 * Visual: three diamond-shaped bases only; runner on = entire base filled with accent color.
 */
import type { BaseState } from "@/lib/types";

const BASE_LABELS = ["1st", "2nd", "3rd"] as const;

const VIEW_BOX = "0 0 200 200";
const BASE_SIZE = 50; // diamond (rotated square) side length – large for easy tap

// Base centers [x, y]: 2nd top, 1st right, 3rd left (diamond layout)
const SECOND = [100, 44];
const FIRST = [156, 108];
const THIRD = [44, 108];

const BASE_POSITIONS = [FIRST, SECOND, THIRD]; // index 0=1st, 1=2nd, 2=3rd

interface BaseStateSelectorProps {
  value: BaseState;
  onChange: (value: BaseState) => void;
  disabled?: boolean;
}

export function BaseStateSelector({ value, onChange, disabled }: BaseStateSelectorProps) {
  const bits = value.split("").map((c) => c === "1");
  const setBit = (index: number, on: boolean) => {
    const next = [...bits];
    next[index] = on;
    onChange(next.map((b) => (b ? "1" : "0")).join(""));
  };

  return (
    <div
      className="relative inline-block w-[200px] max-w-full"
      aria-label="Runners on base (diamond)"
    >
      <svg
        viewBox={VIEW_BOX}
        className="block h-auto w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Three bases: diamond shape; empty = white, runner on = entire base filled with accent */}
        {BASE_POSITIONS.map(([x, y], baseIdx) => {
          const hasRunner = bits[baseIdx];
          const half = BASE_SIZE / 2;
          return (
            <g
              key={BASE_LABELS[baseIdx]}
              role="button"
              tabIndex={disabled ? undefined : 0}
              aria-label={`${BASE_LABELS[baseIdx]} base${hasRunner ? ", runner on" : ""}`}
              className={disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
              onClick={() => !disabled && setBit(baseIdx, !bits[baseIdx])}
              onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setBit(baseIdx, !bits[baseIdx]);
                }
              }}
            >
              <rect
                x={x - half}
                y={y - half}
                width={BASE_SIZE}
                height={BASE_SIZE}
                fill={hasRunner ? "var(--accent)" : "#fafafa"}
                stroke={hasRunner ? "var(--accent)" : "#e8e0d0"}
                strokeWidth={2}
                transform={`rotate(45 ${x} ${y})`}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
