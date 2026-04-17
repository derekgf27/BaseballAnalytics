"use client";

import { useState } from "react";
import { newPitchTrackerGroupId, writeStoredPitchTrackerGroupId } from "@/lib/pitchTrackerSession";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  PitchTrackerLogResult,
  PitchTrackerPitch,
  PitchTrackerPitchType,
  Player,
} from "@/lib/types";
import {
  PITCH_TRACKER_TYPES,
  pitchTrackerAbbrev,
} from "@/lib/pitchTrackerUi";

/** Options for manual “missed pitch” in iPad tools popover. */
const MANUAL_RESULT_OPTIONS: { value: PitchTrackerLogResult; label: string }[] = [
  { value: "ball", label: "Ball" },
  { value: "called_strike", label: "Called" },
  { value: "swinging_strike", label: "Whiff" },
  { value: "foul", label: "Foul" },
  { value: "in_play", label: "In play" },
];

/** Coach pad loads batter, outs, and pitcher from `games` (Record PA form). */
function coachPitchTrackerHref(gameId: string): string {
  return `/coach/pitch-tracker?${new URLSearchParams({ gameId }).toString()}`;
}

export interface PitchTrackerSequenceProps {
  gameId: string | null;
  trackerGroupId: string | null;
  batterId: string | null;
  pitcherId: string | null;
  outs: number;
  players: Player[];
  disabled?: boolean;
  onTrackerGroupIdChange?: (nextId: string) => void;
  /** From {@link usePitchTrackerRows} — coach rows for pitch count in toolbar only. */
  coachPitchRows: PitchTrackerPitch[];
  coachPitchesLoading: boolean;
  refreshCoachPitches: () => void;
}

/**
 * Toolbar: coach pitch count + iPad URL / manual pitch. Sequence rows live in Record (merged with draft log).
 */
export function PitchTrackerSequence({
  gameId,
  trackerGroupId,
  batterId,
  pitcherId,
  outs,
  players,
  disabled,
  onTrackerGroupIdChange,
  coachPitchRows,
  coachPitchesLoading,
  refreshCoachPitches,
}: PitchTrackerSequenceProps) {
  const [msg, setMsg] = useState<string | null>(null);
  const [manualType, setManualType] = useState<PitchTrackerPitchType>("fastball");
  const [manualResult, setManualResult] = useState<PitchTrackerLogResult | "">("");

  const supabase = getSupabaseBrowserClient();

  const addManualPitch = async () => {
    if (!supabase || !gameId || !trackerGroupId || !batterId) return;
    const sorted = coachPitchRows;
    const maxNum = sorted.length > 0 ? Math.max(...sorted.map((r) => r.pitch_number)) : 0;
    const nextNum = maxNum + 1;
    const result = manualResult === "" ? null : manualResult;
    const { error } = await supabase.from("pitches").insert({
      game_id: gameId,
      at_bat_id: null,
      tracker_group_id: trackerGroupId,
      pitch_number: nextNum,
      pitch_type: manualType,
      result,
      batter_id: batterId,
      pitcher_id: pitcherId,
    });
    if (error) setMsg(error.message);
    else {
      setMsg(null);
      void refreshCoachPitches();
    }
  };

  const rotateGroup = () => {
    if (!gameId || !onTrackerGroupIdChange) return;
    const next = newPitchTrackerGroupId();
    writeStoredPitchTrackerGroupId(gameId, next);
    onTrackerGroupIdChange(next);
    setMsg("New coach link — share the updated URL.");
  };

  const batterName = batterId ? players.find((p) => p.id === batterId)?.name ?? "—" : "—";
  /** Relative path only — matches SSR and client (avoids hydration mismatch from `window.location.origin`). */
  const coachHref = gameId && supabase ? coachPitchTrackerHref(gameId) : "";

  const blockedManual = disabled || !gameId || !trackerGroupId || !batterId || !supabase;
  const blockedRotate = disabled || !gameId || !trackerGroupId || !onTrackerGroupIdChange;

  if (!gameId) return null;

  return (
    <div className="mb-2 space-y-1">
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)]/50 pb-1.5">
        <span className="mr-1 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Coach types
        </span>
        {coachPitchesLoading ? (
          <span className="text-[9px] text-[var(--text-muted)]">…</span>
        ) : (
          <span className="text-[9px] tabular-nums text-[var(--text-muted)]">
            {coachPitchRows.length} on iPad
          </span>
        )}
        <details className="relative ml-auto min-w-0">
          <summary className="cursor-pointer list-none text-[9px] text-[var(--accent)] underline decoration-dotted marker:content-none [&::-webkit-details-marker]:hidden">
            iPad link &amp; tools
          </summary>
          <div className="absolute right-0 z-20 mt-1 w-[min(100vw-2rem,18rem)] space-y-2 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-2 shadow-lg">
            {!supabase ? (
              <p className="text-[9px] text-[var(--warning)]">Supabase not configured.</p>
            ) : (
              <>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Coach pad ({outs} out{outs === 1 ? "" : "s"})
                </p>
                <p className="text-[9px] text-[var(--text-muted)]">
                  iPad follows Record — batter:{" "}
                  <span className="font-medium text-[var(--text)]">{batterName}</span>
                  {!batterId ? " (select on PA form)" : null}; pitcher from PA form mound; outs: {outs}.
                </p>
                <p className="break-all font-mono text-[8px] leading-snug text-[var(--text)]">{coachHref}</p>
                <button
                  type="button"
                  disabled={!coachHref}
                  onClick={() => {
                    if (!coachHref) return;
                    void navigator.clipboard
                      .writeText(`${window.location.origin}${coachHref}`)
                      .then(() => setMsg("Copied."));
                  }}
                  className="text-[10px] font-medium text-[var(--accent)] hover:underline disabled:opacity-40"
                >
                  Copy link
                </button>
                {!trackerGroupId ? (
                  <p className="text-[9px] text-[var(--text-muted)]">Loading pitch session…</p>
                ) : (
                  <div className="border-t border-[var(--border)]/60 pt-2">
                    <p className="mb-1 text-[9px] text-[var(--text-muted)]">Missed pitch (manual)</p>
                    {!batterId ? (
                      <p className="text-[9px] text-[var(--text-muted)]">
                        Select a batter on the PA form to add manual pitches.
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-end gap-1.5">
                        <select
                          value={manualType}
                          onChange={(e) => setManualType(e.target.value as PitchTrackerPitchType)}
                          className="input-tech h-7 max-w-[7.5rem] px-1 text-[10px]"
                        >
                          {PITCH_TRACKER_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {pitchTrackerAbbrev(t)}
                            </option>
                          ))}
                        </select>
                        <select
                          value={manualResult}
                          onChange={(e) =>
                            setManualResult((e.target.value || "") as PitchTrackerLogResult | "")
                          }
                          className="input-tech h-7 max-w-[9rem] px-1 text-[10px]"
                        >
                          <option value="">Res…</option>
                          {MANUAL_RESULT_OPTIONS.map(({ value, label }) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={blockedManual}
                          onClick={() => void addManualPitch()}
                          className="h-7 rounded border border-[var(--accent)] bg-[var(--accent)]/12 px-2 text-[10px] font-semibold text-[var(--accent)] disabled:opacity-40"
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {onTrackerGroupIdChange ? (
                  <button
                    type="button"
                    disabled={blockedRotate}
                    onClick={rotateGroup}
                    className="text-[9px] text-[var(--text-muted)] underline hover:text-[var(--text)]"
                  >
                    New session (new coach URL)
                  </button>
                ) : null}
              </>
            )}
          </div>
        </details>
      </div>

      {msg ? <p className="text-[10px] text-[var(--warning)]">{msg}</p> : null}
    </div>
  );
}
