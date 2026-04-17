"use client";

import { useEffect, useId, useState, useMemo, memo, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Player } from "@/lib/types";

const OF_SLOT_ORDER = ["LF", "CF", "RF"] as const;
const IF_SLOT_ORDER = ["3B", "SS", "2B", "1B"] as const;

/** One fielder tile — memoized so parent re-renders don’t recreate every button subtree when only another tile is selected. */
const FielderTile = memo(function FielderTile({
  player,
  pos,
  selected,
  onPick,
}: {
  player: Player;
  pos: string;
  selected: boolean;
  onPick: (id: string) => void;
}) {
  const jersey = player.jersey?.trim();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${pos || "Field"} — ${player.name}${jersey ? ` number ${jersey}` : ""}${
        selected ? ", selected" : ""
      }`}
      onClick={() => onPick(player.id)}
      className={`flex w-full min-h-[64px] flex-col justify-center gap-1 rounded-lg border-2 px-4 py-3 text-left transition touch-manipulation sm:min-h-[72px] sm:px-5 sm:py-3.5 ${
        selected
          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-base)]"
          : "border-transparent bg-[var(--bg-elevated)] text-[var(--text)] hover:border-[var(--accent)]/50"
      }`}
    >
      <span
        className={`text-base font-bold uppercase tracking-wide sm:text-lg ${
          selected ? "text-[var(--bg-base)]" : "text-[var(--accent)]"
        }`}
      >
        {pos || "—"}
      </span>
      <span className="text-sm font-semibold leading-snug sm:text-base">
        <span className="break-words">{player.name}</span>
      </span>
      {jersey ? (
        <span
          className={`text-[11px] font-medium tabular-nums sm:text-xs ${
            selected ? "text-[var(--bg-base)]/80" : "text-[var(--text-muted)]"
          }`}
        >
          #{jersey}
        </span>
      ) : null}
    </button>
  );
});

/**
 * Renders only while open (parent should mount conditionally) so Record page re-renders
 * don’t run grouping logic or portal work when the dialog is closed.
 */
export function ReachedOnErrorFielderModal({
  pitchingTeamName,
  fielders,
  positionByPlayerId,
  initialFielderId,
  moundPitcherId = null,
  title = "Error charged to",
  description,
  onCancel,
  onConfirm,
}: {
  pitchingTeamName: string;
  fielders: Player[];
  positionByPlayerId: Record<string, string>;
  initialFielderId: string | null;
  /** Mound pitcher id (optional) — used so P shows when not in lineup `positionByPlayerId`. */
  moundPitcherId?: string | null;
  /** Dialog title (default: reached-on-error copy). */
  title?: string;
  /** Dialog body; default explains ROE. */
  description?: string;
  onCancel: () => void;
  onConfirm: (fielderId: string) => void;
}) {
  const titleId = useId();
  const descId = useId();
  const [selectedId, setSelectedId] = useState(() => initialFielderId ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const pick = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const { outfielders, infielders, pitchers, catchers, others } = useMemo(() => {
    const of: Player[] = [];
    const inf: Player[] = [];
    const pList: Player[] = [];
    const cList: Player[] = [];
    const rest: Player[] = [];
    for (const p of fielders) {
      const rawPos = positionByPlayerId[p.id]?.trim().toUpperCase() ?? "";
      if (rawPos === "DH") continue;
      if (rawPos === "LF" || rawPos === "CF" || rawPos === "RF") {
        of.push(p);
      } else if (rawPos === "1B" || rawPos === "2B" || rawPos === "3B" || rawPos === "SS") {
        inf.push(p);
      } else if (
        rawPos === "P" ||
        (moundPitcherId && p.id === moundPitcherId && rawPos === "")
      ) {
        pList.push(p);
      } else if (rawPos === "C") {
        cList.push(p);
      } else {
        rest.push(p);
      }
    }

    const rankIn = (order: readonly string[], playerId: string): number => {
      const pos = positionByPlayerId[playerId]?.trim().toUpperCase() ?? "";
      const i = order.indexOf(pos);
      return i === -1 ? 99 : i;
    };
    of.sort((a, b) => rankIn(OF_SLOT_ORDER, a.id) - rankIn(OF_SLOT_ORDER, b.id));
    inf.sort((a, b) => rankIn(IF_SLOT_ORDER, a.id) - rankIn(IF_SLOT_ORDER, b.id));

    return {
      outfielders: of,
      infielders: inf,
      pitchers: pList,
      catchers: cList,
      others: rest,
    };
  }, [fielders, positionByPlayerId, moundPitcherId]);

  if (typeof document === "undefined") return null;

  const descText =
    description ??
    `Choose the defensive player (${pitchingTeamName}) charged with the error on this play.`;

  const confirmDisabled = !selectedId || !fielders.some((p) => p.id === selectedId);

  const posFor = (p: Player) =>
    positionByPlayerId[p.id]?.trim() || (moundPitcherId && p.id === moundPitcherId ? "P" : "");

  const tile = (p: Player) => (
    <FielderTile player={p} pos={posFor(p)} selected={selectedId === p.id} onPick={pick} />
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 sm:p-8"
      onClick={() => onCancel()}
      role="presentation"
    >
      <div
        className="flex max-h-[min(92dvh,56rem)] w-full max-w-5xl flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl ring-1 ring-[var(--accent)]/15 sm:p-8 lg:p-10"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <h3 id={titleId} className="font-display text-xl font-semibold text-[var(--text)] sm:text-2xl">
          {title}
        </h3>
        <p id={descId} className="mt-3 text-base leading-relaxed text-[var(--text-muted)] sm:text-lg">
          {descText}
        </p>
        {fielders.length > 0 ? (
          <div
            className="mt-6 min-h-[min(42vh,28rem)] max-h-[min(68vh,40rem)] flex-1 overflow-y-auto overscroll-contain rounded-xl border border-[var(--border)] bg-[var(--bg-input)]/40 p-4 sm:p-5"
            role="radiogroup"
            aria-label="Defensive players"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {outfielders.map((p) => (
                  <div key={p.id} className="min-w-0">
                    {tile(p)}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-3 sm:gap-4">
                {infielders.map((p) => (
                  <div key={p.id} className="min-w-0">
                    {tile(p)}
                  </div>
                ))}
              </div>
              {(pitchers.length > 0 || catchers.length > 0) && (
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="flex min-w-0 max-w-full flex-col gap-2">
                    {pitchers.map((p) => (
                      <div key={p.id} className="min-w-0">
                        {tile(p)}
                      </div>
                    ))}
                  </div>
                  <div className="flex min-w-0 max-w-full flex-col gap-2">
                    {catchers.map((p) => (
                      <div key={p.id} className="min-w-0">
                        {tile(p)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {others.length > 0 && (
                <ul className="mt-2 flex flex-col gap-2">
                  {others.map((p) => (
                    <li key={p.id}>{tile(p)}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-6 text-base text-[var(--warning)] sm:text-lg">
            No defensive roster or lineup — set a lineup or pitcher in Game state first.
          </p>
        )}
        <div className="mt-8 flex flex-shrink-0 flex-wrap justify-end gap-3 border-t border-[var(--border)] pt-6">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[48px] rounded-lg border border-[var(--border)] px-6 py-2.5 text-base font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-elevated)] sm:min-h-[52px] sm:px-8"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={confirmDisabled}
            onClick={() => {
              if (!selectedId) return;
              onConfirm(selectedId);
            }}
            className="min-h-[48px] rounded-lg bg-[var(--accent)] px-6 py-2.5 text-base font-semibold text-[var(--bg-base)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[52px] sm:px-8"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
