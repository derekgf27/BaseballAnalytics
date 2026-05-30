"use client";

/**
 * Tap bases to set runner state. base_state = "1st, 2nd, 3rd" as 3-char string "100" = first only.
 * With runner tracking: tap occupied base → tap destination to move; quick advance / clear buttons.
 */
import { useEffect, useMemo, useState } from "react";
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
  /** Log SB/CS for the runner on this base (saved immediately; advances/removes runner on diamond). */
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

const quickBtnClass =
  "min-h-[36px] min-w-0 flex-1 rounded-lg border px-2 py-1 text-xs font-bold tracking-wide transition touch-manipulation";

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
  const [moveFromBase, setMoveFromBase] = useState<0 | 1 | 2 | null>(null);

  const bits = value.split("").map((c) => c === "1");
  const runnerTracking = Boolean(onRunnerChange && runnerOptions.length > 0);

  const optionsExcludingBatter = useMemo(
    () =>
      currentBatterId ? runnerOptions.filter((p) => p.id !== currentBatterId) : runnerOptions,
    [runnerOptions, currentBatterId]
  );

  useEffect(() => {
    if (moveFromBase == null) return;
    if (!bits[moveFromBase] || !runnerIds[moveFromBase]) setMoveFromBase(null);
  }, [bits, runnerIds, moveFromBase]);

  const bitsToState = (next: boolean[]): BaseState =>
    next.map((b) => (b ? "1" : "0")).join("") as BaseState;

  const setBit = (index: number, on: boolean) => {
    const next = [...bits];
    next[index] = on;
    onChange(bitsToState(next));
    if (!on && onRunnerChange) onRunnerChange(index as 0 | 1 | 2, null);
  };

  const clearBase = (baseIdx: 0 | 1 | 2) => {
    setMoveFromBase(null);
    setBit(baseIdx, false);
  };

  const moveRunnerToBase = (fromIdx: 0 | 1 | 2, toIdx: 0 | 1 | 2, playerId: string) => {
    const next = [...bits];
    next[fromIdx] = false;
    next[toIdx] = true;
    onChange(bitsToState(next));
    onRunnerChange!(fromIdx, null);
    onRunnerChange!(toIdx, playerId);
  };

  const advanceRunnerOneBase = (fromIdx: 0 | 1 | 2) => {
    const playerId = runnerIds[fromIdx];
    if (!playerId) return;
    if (fromIdx === 2) {
      clearBase(2);
      return;
    }
    const toIdx = (fromIdx + 1) as 0 | 1 | 2;
    if (bits[toIdx]) return;
    moveRunnerToBase(fromIdx, toIdx, playerId);
    setMoveFromBase(null);
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

  const handleBaseClick = (baseIdx: 0 | 1 | 2) => {
    if (disabled) return;

    if (!runnerTracking) {
      setBit(baseIdx, !bits[baseIdx]);
      return;
    }

    const hasRunner = bits[baseIdx];
    const runnerId = runnerIds[baseIdx] ?? null;

    if (moveFromBase !== null) {
      if (moveFromBase === baseIdx) {
        setMoveFromBase(null);
        return;
      }
      const fromId = runnerIds[moveFromBase] ?? null;
      if (!fromId) {
        setMoveFromBase(null);
        return;
      }
      if (!hasRunner) {
        moveRunnerToBase(moveFromBase, baseIdx, fromId);
        setMoveFromBase(null);
        return;
      }
      const destId = runnerIds[baseIdx] ?? null;
      if (destId && destId !== fromId) {
        onRunnerChange!(moveFromBase, destId);
        onRunnerChange!(baseIdx, fromId);
        setMoveFromBase(null);
      }
      return;
    }

    if (hasRunner && runnerId) {
      setMoveFromBase(baseIdx);
      return;
    }

    if (!hasRunner) {
      setBit(baseIdx, true);
      return;
    }

    clearBase(baseIdx);
  };

  const movingRunnerLabel =
    moveFromBase != null && runnerIds[moveFromBase]
      ? getLastName(getRunnerName(runnerIds[moveFromBase]) || "?")
      : null;

  return (
    <div
      className="relative inline-block w-full max-w-[300px]"
      aria-label="Runners on base (diamond)"
    >
      {runnerTracking && moveFromBase != null && movingRunnerLabel ? (
        <p className="mb-1.5 text-[10px] leading-snug text-[var(--accent)]">
          Moving <span className="font-semibold">{movingRunnerLabel}</span> — tap another base (tap
          same base to cancel)
        </p>
      ) : runnerTracking ? (
        <p className="mb-1.5 text-[10px] leading-snug text-[var(--text-muted)]">
          Tap diamond to move · double-tap diamond or tap name below to remove · empty base adds a
          runner
        </p>
      ) : null}

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
          const isMoveSource = moveFromBase === baseIdx;
          const isMoveTarget =
            moveFromBase != null && moveFromBase !== baseIdx && (!hasRunner || runnerId != null);
          return (
            <g
              key={BASE_LABELS[baseIdx]}
              role="button"
              tabIndex={disabled ? undefined : 0}
              aria-label={`${BASE_LABELS[baseIdx]} base${hasRunner ? ", runner on" : ""}${isMoveSource ? ", selected to move" : ""}`}
              className={disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
              onClick={() => handleBaseClick(baseIdx as 0 | 1 | 2)}
              onDoubleClick={(e) => {
                e.preventDefault();
                if (disabled || !runnerTracking || moveFromBase != null) return;
                if (hasRunner && runnerId) clearBase(baseIdx as 0 | 1 | 2);
              }}
              onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleBaseClick(baseIdx as 0 | 1 | 2);
                }
              }}
            >
              <rect
                x={x - half}
                y={y - half}
                width={BASE_SIZE}
                height={BASE_SIZE}
                fill={hasRunner ? "#000000" : isMoveTarget ? "var(--accent-dim)" : "#fafafa"}
                stroke={
                  isMoveSource
                    ? "var(--accent)"
                    : isMoveTarget
                      ? "var(--accent)"
                      : hasRunner
                        ? "var(--accent)"
                        : "#e8e0d0"
                }
                strokeWidth={isMoveSource ? 4 : isMoveTarget ? 3 : 2}
                strokeDasharray={isMoveTarget && !hasRunner ? "6 4" : undefined}
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
      {runnerTracking && (
        <div className="mt-1 flex w-full flex-col gap-2 text-xs">
          {BASE_POSITIONS.map((_, baseIdx) => {
            const hasRunner = bits[baseIdx];
            const runnerId = runnerIds[baseIdx] ?? null;
            if (!hasRunner) return null;

            if (!runnerId) {
              return (
                <div key={baseIdx} className="flex min-w-0 w-full flex-col items-stretch gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-white">
                    {BASE_LABELS[baseIdx]}
                  </span>
                  <select
                    value=""
                    onChange={(e) =>
                      onRunnerChange!(baseIdx as 0 | 1 | 2, e.target.value || null)
                    }
                    onClick={(e) => e.stopPropagation()}
                    className="input-tech min-h-[40px] w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2.5 py-1.5 text-sm font-semibold text-[var(--text)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                    aria-label={`Runner on ${BASE_LABELS[baseIdx]}`}
                  >
                    <option value="">Select runner…</option>
                    {optionsExcludingBatter.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            const nextBaseIdx = baseIdx < 2 ? ((baseIdx + 1) as 0 | 1 | 2) : null;
            const canAdvance = nextBaseIdx != null && !bits[nextBaseIdx];
            const runnerLastName = getLastName(getRunnerName(runnerId));
            return (
              <div key={baseIdx} className="flex min-w-0 w-full flex-col items-stretch gap-1.5">
                <div className="min-w-0">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    {BASE_LABELS[baseIdx]}
                  </span>
                  <button
                    type="button"
                    onClick={() => clearBase(baseIdx as 0 | 1 | 2)}
                    className="mt-0.5 block max-w-full truncate text-left font-display text-xl font-bold leading-tight text-[var(--accent)] transition hover:text-[var(--accent)]/80 hover:underline touch-manipulation sm:text-2xl"
                    title={`Remove ${runnerLastName} from ${BASE_LABELS[baseIdx]}`}
                    aria-label={`Remove ${runnerLastName} from ${BASE_LABELS[baseIdx]}`}
                  >
                    {runnerLastName}
                  </button>
                </div>
                <div className="grid w-full grid-cols-3 gap-1.5">
                  {canAdvance ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        advanceRunnerOneBase(baseIdx as 0 | 1 | 2);
                      }}
                      className={`${quickBtnClass} border-[var(--accent)]/55 bg-[var(--accent-dim)] text-[var(--accent)] hover:bg-[var(--accent)]/20`}
                      title={`Move to ${BASE_LABELS[nextBaseIdx!]}`}
                    >
                      → {BASE_LABELS[nextBaseIdx!]}
                    </button>
                  ) : baseIdx === 2 && runnerId ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearBase(2);
                      }}
                      className={`${quickBtnClass} border-[var(--accent)]/55 bg-[var(--accent-dim)] text-[var(--accent)] hover:bg-[var(--accent)]/20`}
                      title="Runner left base (mark scored in Who scored)"
                    >
                      Off 3rd
                    </button>
                  ) : (
                    <span className="min-h-[36px]" aria-hidden />
                  )}
                  {onBaserunning && runnerId ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onBaserunning({
                            baseIndex: baseIdx as 0 | 1 | 2,
                            runnerId,
                            type: "sb",
                          });
                        }}
                        className={`${quickBtnClass} border-[var(--accent)]/50 bg-[var(--accent-dim)] text-[var(--accent)] hover:bg-[var(--accent)]/20`}
                      >
                        SB
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onBaserunning({
                            baseIndex: baseIdx as 0 | 1 | 2,
                            runnerId,
                            type: "cs",
                          });
                        }}
                        className={`${quickBtnClass} border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:border-[var(--danger)]/50 hover:text-[var(--danger)]`}
                      >
                        CS
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="min-h-[36px]" aria-hidden />
                      <span className="min-h-[36px]" aria-hidden />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
