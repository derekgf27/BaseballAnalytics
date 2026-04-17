"use client";

/**
 * Tap bases to set runner state. base_state = "1st, 2nd, 3rd" as 3-char string "100" = first only.
 * Optional: show player names on each base and let user pick who's on base (for tracking runs/scored and stolen bases).
 */
import { useMemo } from "react";
import type { BaseState } from "@/lib/types";

const BASE_LABELS = ["1st", "2nd", "3rd"] as const;

const VIEW_BOX = "0 0 300 300";
/** Diamond (rotated square) side length — room for tap targets + name text */
const BASE_SIZE = 98;

// Base centers [x, y]: 2nd top, 1st right, 3rd left (diamond layout), scaled for VIEW_BOX
const SECOND = [150, 78];
const FIRST = [232, 162];
const THIRD = [70, 162];

const BASE_POSITIONS = [FIRST, SECOND, THIRD]; // index 0=1st, 1=2nd, 2=3rd

export type RunnerOption = { id: string; name: string; jersey?: string | null };

interface BaseStateSelectorProps {
  value: BaseState;
  onChange: (value: BaseState) => void;
  disabled?: boolean;
  /** Optional: runner player ID per base (1st, 2nd, 3rd). When set, names are shown and user can pick who's on base. */
  runnerIds?: (string | null)[];
  onRunnerChange?: (baseIndex: 0 | 1 | 2, playerId: string | null) => void;
  /** Players that can be selected as runner (e.g. lineup). Exclude current batter when calling. */
  runnerOptions?: RunnerOption[];
  /** Current batter ID – excluded from runner options so batter can't be on base. */
  currentBatterId?: string | null;
  /** Log SB/CS for the runner on this base (saved immediately; does not change base state). */
  onBaserunning?: (args: {
    baseIndex: 0 | 1 | 2;
    runnerId: string;
    type: "sb" | "cs";
  }) => void;
}

/** Last name only: everything after the first space, or full name if single word. */
function getLastName(name: string) {
  const trimmed = name.trim();
  const space = trimmed.indexOf(" ");
  return space < 0 ? trimmed || "?" : trimmed.slice(space + 1);
}

function SvgRunnerNameLabel({
  x,
  y,
  lastName,
  jersey,
}: {
  x: number;
  y: number;
  lastName: string;
  jersey: string | null;
}) {
  return (
    <g className="pointer-events-none select-none">
      <text
        x={x}
        y={jersey != null ? y - 10 : y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--accent)"
        fontSize="22"
        fontWeight="800"
      >
        {lastName}
      </text>
      {jersey != null && (
        <text
          x={x}
          y={y + 10}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--accent)"
          fontSize="24"
          fontWeight="800"
        >
          #{jersey}
        </text>
      )}
    </g>
  );
}

export function BaseStateSelector({
  value,
  onChange,
  disabled,
  runnerIds = [null, null, null],
  onRunnerChange,
  runnerOptions = [],
  currentBatterId,
  onBaserunning,
}: BaseStateSelectorProps) {
  const bits = value.split("").map((c) => c === "1");
  const optionsExcludingBatter = useMemo(
    () =>
      currentBatterId ? runnerOptions.filter((p) => p.id !== currentBatterId) : runnerOptions,
    [runnerOptions, currentBatterId]
  );

  const setBit = (index: number, on: boolean) => {
    const next = [...bits];
    next[index] = on;
    onChange(next.map((b) => (b ? "1" : "0")).join(""));
    if (!on && onRunnerChange) onRunnerChange(index as 0 | 1 | 2, null);
  };

  const getRunnerName = (id: string | null) => {
    if (!id) return "";
    const p = runnerOptions.find((o) => o.id === id);
    return p?.name ?? id.slice(0, 8);
  };

  const getRunnerJersey = (id: string | null) => {
    if (!id) return null;
    const p = runnerOptions.find((o) => o.id === id);
    const j = p?.jersey;
    return j != null && String(j).trim() !== "" ? String(j).trim() : null;
  };

  return (
    <div
      className="relative inline-block w-full max-w-[300px]"
      aria-label="Runners on base (diamond)"
    >
      <svg
        viewBox={VIEW_BOX}
        className="block h-auto w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {BASE_POSITIONS.map(([x, y], baseIdx) => {
          const hasRunner = bits[baseIdx];
          const half = BASE_SIZE / 2;
          const runnerId = runnerIds[baseIdx] ?? null;
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
                fill={hasRunner ? "#000000" : "#fafafa"}
                stroke={hasRunner ? "var(--accent)" : "#e8e0d0"}
                strokeWidth={2}
                transform={`rotate(45 ${x} ${y})`}
              />
              {hasRunner && runnerId ? (
                <SvgRunnerNameLabel
                  x={x}
                  y={y}
                  lastName={getLastName(getRunnerName(runnerId) || "?")}
                  jersey={getRunnerJersey(runnerId)}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      {onRunnerChange && runnerOptions.length > 0 && (
        <div className="mt-1 flex w-full flex-col gap-2 text-xs">
          {BASE_POSITIONS.map((_, baseIdx) => {
            const hasRunner = bits[baseIdx];
            const runnerId = runnerIds[baseIdx] ?? null;
            if (!hasRunner) return null;
            return (
              <div key={baseIdx} className="flex min-w-0 w-full flex-col items-stretch gap-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-white">
                  {BASE_LABELS[baseIdx]}
                </span>
                <select
                  value={runnerId ?? ""}
                  onChange={(e) => onRunnerChange(baseIdx as 0 | 1 | 2, e.target.value || null)}
                  onClick={(e) => e.stopPropagation()}
                  className="input-tech min-h-[40px] w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2.5 py-1.5 text-sm font-semibold text-[var(--text)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                  aria-label={`Runner on ${BASE_LABELS[baseIdx]}`}
                >
                  <option value="">Select…</option>
                  {optionsExcludingBatter.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {onBaserunning && runnerId ? (
                  <div className="grid w-full grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBaserunning({ baseIndex: baseIdx as 0 | 1 | 2, runnerId, type: "sb" });
                      }}
                      className="min-h-[40px] w-full min-w-0 rounded-lg border-2 border-[var(--accent)]/50 bg-[var(--accent-dim)] px-2 py-1.5 text-sm font-bold tracking-wide text-[var(--accent)] transition hover:bg-[var(--accent)]/20 touch-manipulation"
                    >
                      SB
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBaserunning({ baseIndex: baseIdx as 0 | 1 | 2, runnerId, type: "cs" });
                      }}
                      className="min-h-[40px] w-full min-w-0 rounded-lg border-2 border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-sm font-bold tracking-wide text-[var(--text-muted)] transition hover:border-[var(--danger)]/50 hover:text-[var(--danger)] touch-manipulation"
                    >
                      CS
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
