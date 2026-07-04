"use client";

import { useEffect, useMemo, useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { fetchMatchupPriorPasAction } from "@/app/analyst/record/actions";
import {
  batterGlanceFromPas,
  handednessLabel,
  mergeMatchupPas,
  pasForMatchup,
  type BatterGlanceSlice,
} from "@/lib/compute/matchupGlance";
import type { PlateAppearance, Player } from "@/lib/types";

const COUNT_STATS: {
  key: keyof Pick<BatterGlanceSlice, "pa" | "ab" | "h" | "bb" | "so" | "hr" | "rbi">;
  label: string;
}[] = [
  { key: "pa", label: "PA" },
  { key: "ab", label: "AB" },
  { key: "h", label: "H" },
  { key: "bb", label: "BB" },
  { key: "so", label: "K" },
  { key: "hr", label: "HR" },
  { key: "rbi", label: "RBI" },
];

function playerLabel(p: Player | null | undefined, fallback: string): string {
  if (!p) return fallback;
  const name = p.name?.trim() || fallback;
  const j = p.jersey?.trim();
  return j ? `${name} #${j}` : name;
}

function RateCell({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 rounded-lg px-3 py-2.5 ${
        emphasize
          ? "bg-[color-mix(in_srgb,var(--accent)_14%,var(--bg-elevated))] ring-1 ring-[var(--accent)]/35"
          : "bg-[var(--bg-elevated)]"
      }`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </span>
      <span
        className={`tabular-nums font-bold text-[var(--accent)] ${
          emphasize ? "text-lg sm:text-xl" : "text-base sm:text-lg"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function MatchupGlanceModal({
  open,
  batter,
  pitcher,
  gamePas,
  onClose,
}: {
  open: boolean;
  batter: Player | null;
  pitcher: Player | null;
  gamePas: PlateAppearance[];
  onClose: () => void;
}) {
  const dialogRef = useFocusTrap(open);
  const [careerPas, setCareerPas] = useState<PlateAppearance[]>([]);
  const [loading, setLoading] = useState(false);

  const batterId = batter?.id ?? null;
  const pitcherId = pitcher?.id ?? null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !batterId || !pitcherId) {
      setCareerPas([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchMatchupPriorPasAction(batterId, pitcherId).then((rows) => {
      if (cancelled) return;
      setCareerPas(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, batterId, pitcherId]);

  const hands = useMemo(
    () => handednessLabel(batter?.bats, pitcher?.throws),
    [batter?.bats, pitcher?.throws]
  );

  const gameMatchupPas = useMemo(() => {
    if (!batterId || !pitcherId) return [];
    return pasForMatchup(gamePas, batterId, pitcherId);
  }, [gamePas, batterId, pitcherId]);

  const allMatchupPas = useMemo(() => {
    if (!batterId || !pitcherId) return [];
    return mergeMatchupPas(careerPas, gamePas, batterId, pitcherId);
  }, [careerPas, gamePas, batterId, pitcherId]);

  const career = useMemo(() => batterGlanceFromPas(allMatchupPas), [allMatchupPas]);
  const today = useMemo(() => batterGlanceFromPas(gameMatchupPas), [gameMatchupPas]);

  const showTodayCareerSplit =
    today != null && career != null && career.pa > today.pa;

  if (!open) return null;

  const batterName = playerLabel(batter, "Batter");
  const pitcherName = playerLabel(pitcher, "Pitcher");
  const canShow = Boolean(batterId && pitcherId);

  const rateRows: { label: string; value: string; emphasize?: boolean }[] = [];
  if (career) {
    rateRows.push(
      { label: "AVG", value: career.avgLabel },
      { label: "OBP", value: career.obpLabel },
      { label: "SLG", value: career.slgLabel },
      { label: "OPS", value: career.opsLabel, emphasize: true }
    );
    if (career.fpsLabel !== "—") rateRows.push({ label: "FPS", value: career.fpsLabel });
    if (career.ppaLabel !== "—") rateRows.push({ label: "P/PA", value: career.ppaLabel });
    // Pair RISP with K% so the 2-col grid never ends on a lone RISP cell.
    if (career.rispHab !== "—") {
      rateRows.push(
        { label: "K%", value: career.kPctLabel },
        { label: "RISP", value: career.rispHab }
      );
    }
  }

  return (
    <div
      className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="matchup-glance-title"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-[var(--bg-elevated)] px-5 pb-4 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-card)] hover:text-[var(--text)]"
            aria-label="Close"
          >
            ✕
          </button>

          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Head to head
          </p>

          <div
            id="matchup-glance-title"
            className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3"
          >
            <div className="min-w-0 text-right">
              <p className="truncate font-display text-base font-bold text-[var(--accent)] sm:text-lg">
                {batterName}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                {hands.batter}
              </p>
            </div>
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]"
              aria-hidden
            >
              vs
            </span>
            <div className="min-w-0 text-left">
              <p className="truncate font-display text-base font-bold text-[var(--accent)] sm:text-lg">
                {pitcherName}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                {hands.pitcher}
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          {!canShow ? (
            <p className="py-4 text-center text-sm text-[var(--text-muted)]">
              Select a batter and pitcher to see head-to-head stats.
            </p>
          ) : loading && !career ? (
            <p className="py-4 text-center text-sm text-[var(--text-muted)]">Loading…</p>
          ) : !career ? (
            <p className="py-4 text-center text-sm text-[var(--text-muted)]">
              No plate appearances logged between these two.
            </p>
          ) : (
            <div className="space-y-4">
              <table
                className="w-full border-collapse text-center"
                aria-label="Head-to-head counting stats"
              >
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {COUNT_STATS.map(({ key, label }) => (
                      <th
                        key={key}
                        scope="col"
                        className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {COUNT_STATS.map(({ key }) => (
                      <td
                        key={key}
                        className="px-1 pt-2.5 tabular-nums text-xl font-bold text-[var(--accent)]"
                      >
                        {career[key]}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>

              <div
                className="grid grid-cols-2 gap-2"
                role="group"
                aria-label="Head-to-head rates"
              >
                {rateRows.map(({ label, value, emphasize }) => (
                  <RateCell key={label} label={label} value={value} emphasize={emphasize} />
                ))}
              </div>

              {showTodayCareerSplit && today ? (
                <p className="text-center text-xs font-medium tabular-nums text-[var(--text-muted)]">
                  {`Today ${today.hab} · Career ${career.hab}`}
                </p>
              ) : null}

              {career.line !== "—" ? (
                <p className="border-t border-[var(--border)] pt-3 text-center text-sm font-medium tabular-nums text-[var(--text)]">
                  {career.line}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
