"use client";

/**
 * Tap bases to set runner state. base_state = "1st, 2nd, 3rd" as 3-char string "100" = first only.
 * Optional: show player names on each base and let user pick who's on base (for tracking runs/scored and stolen bases).
 */
import type { BaseState } from "@/lib/types";

const BASE_LABELS = ["1st", "2nd", "3rd"] as const;

const VIEW_BOX = "0 0 280 280";
const BASE_SIZE = 72; // diamond (rotated square) side length – large for tap + name

// Base centers [x, y]: 2nd top, 1st right, 3rd left (diamond layout)
const SECOND = [140, 60];
const FIRST = [218, 140];
const THIRD = [62, 140];

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
}

export function BaseStateSelector({
  value,
  onChange,
  disabled,
  runnerIds = [null, null, null],
  onRunnerChange,
  runnerOptions = [],
  currentBatterId,
}: BaseStateSelectorProps) {
  const bits = value.split("").map((c) => c === "1");
  const optionsExcludingBatter = currentBatterId
    ? runnerOptions.filter((p) => p.id !== currentBatterId)
    : runnerOptions;
  const usedIds = new Set((runnerIds as (string | null)[]).filter(Boolean));
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

  /** Last name only: everything after the first space, or full name if single word. */
  const getLastName = (name: string) => {
    const trimmed = name.trim();
    const space = trimmed.indexOf(" ");
    return space < 0 ? trimmed || "?" : trimmed.slice(space + 1);
  };

  return (
    <div
      className="relative inline-block w-[280px] max-w-full"
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
                fill={hasRunner ? "var(--accent)" : "#fafafa"}
                stroke={hasRunner ? "var(--accent)" : "#e8e0d0"}
                strokeWidth={2}
                transform={`rotate(45 ${x} ${y})`}
              />
              {hasRunner && runnerId && (() => {
                const name = getRunnerName(runnerId) || "?";
                const lastName = getLastName(name);
                const jersey = getRunnerJersey(runnerId);
                return (
                  <g className="pointer-events-none select-none">
                    <text
                      x={x}
                      y={jersey != null ? y - 10 : y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="var(--bg-base)"
                      fontSize="20"
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
                        fill="var(--bg-base)"
                        fontSize="16"
                        fontWeight="800"
                      >
                        #{jersey}
                      </text>
                    )}
                  </g>
                );
              })()}
            </g>
          );
        })}
      </svg>
      {onRunnerChange && runnerOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
          {BASE_POSITIONS.map((_, baseIdx) => {
            const hasRunner = bits[baseIdx];
            const runnerId = runnerIds[baseIdx] ?? null;
            if (!hasRunner) return <div key={baseIdx} className="w-24" />;
            return (
              <div key={baseIdx} className="flex flex-col items-center gap-0.5">
                <span className="font-medium text-[var(--text-muted)]">{BASE_LABELS[baseIdx]}</span>
                <select
                  value={runnerId ?? ""}
                  onChange={(e) => onRunnerChange(baseIdx as 0 | 1 | 2, e.target.value || null)}
                  onClick={(e) => e.stopPropagation()}
                  className="min-w-[6rem] max-w-[8rem] truncate rounded border border-[var(--border)] bg-[var(--bg-base)] px-1.5 py-1 text-[var(--text)]"
                  aria-label={`Runner on ${BASE_LABELS[baseIdx]}`}
                >
                  <option value="">Select…</option>
                  {optionsExcludingBatter
                    .filter((p) => p.id === runnerId || !usedIds.has(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
