"use client";

import { ROSTER_POSITION_CODES, type RosterPositionCode } from "@/lib/rosterPositions";

export { ROSTER_POSITION_CODES, type RosterPositionCode };

export interface RosterPositionSelectorProps {
  selected: string[];
  onToggle: (position: string) => void;
  /** When set, shows a row to pick primary among selected positions. */
  primaryPosition?: string | null;
  onSetPrimary?: (position: string) => void;
  disabled?: boolean;
  size?: "default" | "large";
}

export function RosterPositionSelector({
  selected,
  onToggle,
  primaryPosition = null,
  onSetPrimary,
  disabled,
  size = "default",
}: RosterPositionSelectorProps) {
  const large = size === "large";

  return (
    <div role="group" aria-label="Player positions">
      <div
        className={
          large
            ? "grid grid-cols-5 gap-3 sm:gap-4"
            : "grid grid-cols-5 gap-2 sm:grid-cols-10 sm:gap-2"
        }
      >
        {ROSTER_POSITION_CODES.map((pos) => {
          const on = selected.includes(pos);
          return (
            <button
              key={pos}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              aria-label={`Position ${pos}`}
              onClick={() => onToggle(pos)}
              className={`font-display w-full rounded-lg border font-bold transition ${
                large
                  ? "min-h-14 px-2 py-3 text-lg sm:min-h-[4.25rem] sm:text-xl"
                  : "min-h-9 px-1 py-2 text-xs sm:min-h-10 sm:text-sm"
              } ${
                on
                  ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]/25"
                  : "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text)]"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              {pos}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && onSetPrimary ? (
        <div className={large ? "mt-4" : "mt-3"}>
          <p
            className={
              large
                ? "text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                : "text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"
            }
          >
            Primary position
          </p>
          <div className={`mt-2 flex flex-wrap ${large ? "gap-2" : "gap-1.5"}`} role="group" aria-label="Primary position">
            {selected.map((pos) => {
              const isPrimary = primaryPosition === pos;
              return (
                <button
                  key={pos}
                  type="button"
                  disabled={disabled}
                  aria-pressed={isPrimary}
                  onClick={() => onSetPrimary(pos)}
                  className={`font-display rounded-lg border font-bold transition ${
                    large ? "min-h-9 px-3 py-1.5 text-sm" : "min-h-8 px-2.5 py-1 text-xs"
                  } ${
                    isPrimary
                      ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text)]"
                  } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  {pos}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <p
        className={
          large
            ? "mt-4 text-xs leading-relaxed text-[var(--text-faint)]"
            : "mt-2 text-[10px] leading-snug text-[var(--text-faint)]"
        }
      >
        Tap to toggle. Select multiple if needed.
        {onSetPrimary ? " Set primary for lineup defaults." : ""}
      </p>
    </div>
  );
}
