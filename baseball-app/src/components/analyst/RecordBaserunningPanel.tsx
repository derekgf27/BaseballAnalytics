"use client";

import type { BaserunningEvent } from "@/lib/types";

interface RecordBaserunningPanelProps {
  players: { id: string; name: string; jersey?: string | null }[];
  baserunningEvents: BaserunningEvent[];
  onDeleteEvent?: (eventId: string) => void | Promise<void>;
  disabled?: boolean;
}

function runnerDisplay(
  players: RecordBaserunningPanelProps["players"],
  runnerId: string
): { fullName: string; jersey: string | null } {
  const p = players.find((x) => x.id === runnerId);
  if (!p) return { fullName: "Unknown player", jersey: null };
  return { fullName: p.name.trim() || "Unknown player", jersey: p.jersey?.trim() || null };
}

/** Base stolen toward (from runner's occupied base at attempt). */
function baseStolenLabel(fromBase: 0 | 1 | 2 | null | undefined): string | null {
  if (fromBase === 0) return "2nd";
  if (fromBase === 1) return "3rd";
  if (fromBase === 2) return "home";
  return null;
}

function inningLabel(ev: BaserunningEvent): string {
  return `${ev.inning_half === "bottom" ? "Bot" : "Top"} ${ev.inning}`;
}

export function RecordBaserunningPanel({
  players,
  baserunningEvents,
  onDeleteEvent,
  disabled = false,
}: RecordBaserunningPanelProps) {
  const canDelete = Boolean(onDeleteEvent) && !disabled;

  return (
    <section
      className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-3"
      aria-label="Stolen bases and caught stealing this game"
    >
      <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-white">
        Stolen bases
      </h3>
      {baserunningEvents.length > 0 ? (
        <ul className="mt-1 max-h-36 space-y-1.5 overflow-y-auto">
          {baserunningEvents.map((ev) => {
            const { fullName, jersey } = runnerDisplay(players, ev.runner_id);
            const stolenBase = baseStolenLabel(ev.from_base);
            const eventLabel = ev.event_type === "sb" ? "stolen base" : "caught stealing";
            const isCs = ev.event_type === "cs";
            return (
              <li
                key={ev.id}
                className="flex items-start justify-between gap-2 text-sm leading-snug text-[var(--text)]"
              >
                <span className="min-w-0">
                  <span className="font-semibold text-[var(--text-muted)]">
                    {isCs ? "CS" : "SB"}
                  </span>{" "}
                  <span className="font-medium text-[var(--accent)]">{fullName}</span>
                  {jersey ? (
                    <span className="font-semibold text-[var(--accent)]"> #{jersey}</span>
                  ) : null}
                  {isCs ? (
                    <>
                      <span className="text-[var(--text)]">
                        {" "}
                        caught stealing{stolenBase ? ` ${stolenBase}` : ""}
                      </span>
                      <span className="text-[var(--text-faint)]"> · </span>
                      <span className="text-[var(--text-muted)] tabular-nums">{inningLabel(ev)}</span>
                    </>
                  ) : (
                    <>
                      {stolenBase ? (
                        <>
                          <span className="text-[var(--text-faint)]"> · </span>
                          <span className="text-[var(--text)]">stole {stolenBase}</span>
                        </>
                      ) : null}
                      <span className="text-[var(--text-faint)]"> · </span>
                      <span className="text-[var(--text-muted)] tabular-nums">{inningLabel(ev)}</span>
                    </>
                  )}
                </span>
                {canDelete ? (
                  <button
                    type="button"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--danger)]/40 text-base font-bold leading-none text-[var(--danger)] transition hover:bg-[var(--danger)]/10 touch-manipulation"
                    aria-label={`Remove ${eventLabel} for ${fullName}`}
                    onClick={() => void onDeleteEvent?.(ev.id)}
                  >
                    ×
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-1 text-sm leading-snug text-[var(--text-muted)]">
          No stolen bases or caught stealing yet.
        </p>
      )}
    </section>
  );
}
