import type { LastSavedPaSummary } from "@/lib/record/recordPageTypes";

export function RecordLastPaSummary({ summary }: { summary: LastSavedPaSummary }) {
  return (
    <section
      className="rounded-lg border border-[var(--accent)]/35 bg-[var(--accent-dim)]/25 px-3 py-2.5"
      aria-label="Last saved plate appearance — who scored"
    >
      <p className="font-display text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Last PA saved — verify
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-[var(--text)]">
          <span className="font-semibold">Batter:</span>{" "}
          <span className="text-[var(--accent)]">{summary.batterName}</span>
        </span>
        <span className="text-[var(--text)]">
          <span className="font-semibold">Result:</span>{" "}
          <span className="text-[var(--accent)]">{summary.resultLabel}</span>
        </span>
        {summary.errorFielderNames.length > 0 && (
          <span className="text-[var(--text)]">
            <span className="font-semibold">
              Error{summary.errorFielderNames.length > 1 ? "s" : ""} charged to:
            </span>{" "}
            <span className="text-[var(--accent)]">{summary.errorFielderNames.join(", ")}</span>
          </span>
        )}
        <span className="text-[var(--text)]">
          <span className="font-semibold">Hit direction:</span>{" "}
          <span className="text-[var(--accent)]">{summary.hitDirectionLabel ?? "—"}</span>
        </span>
        {summary.rbi > 0 && (
          <span className="text-[var(--text)]">
            <span className="font-semibold">RBI:</span>{" "}
            <span className="text-[var(--accent)]">{summary.rbi}</span>
          </span>
        )}
        <span className="text-[var(--text)]">
          <span className="font-semibold">Pitcher:</span>{" "}
          <span className="text-[var(--accent)]">{summary.pitcherName}</span>
        </span>
        <span className="text-[var(--text)]">
          <span className="font-semibold">Count:</span>{" "}
          <span className="text-[var(--accent)]">{summary.countLabel}</span>
        </span>
        <span className="text-[var(--text)]">
          <span className="font-semibold">Pitches:</span>{" "}
          <span className="text-[var(--accent)]">{summary.pitchLine}</span>
        </span>
        <span className="text-[var(--text)]">
          <span className="font-semibold">Scored:</span>{" "}
          <span className="text-[var(--accent)]">
            {summary.runsScoredNames.length > 0 ? summary.runsScoredNames.join(", ") : "None"}
          </span>
        </span>
        {summary.unearnedRunsScoredNames.length > 0 && (
          <span className="text-[var(--text)]">
            <span className="font-semibold">Unearned (vs ERA):</span>{" "}
            <span className="text-amber-200/95">{summary.unearnedRunsScoredNames.join(", ")}</span>
          </span>
        )}
        {summary.notes && (
          <span className="min-w-0 text-[var(--text-muted)]">
            <span className="font-semibold">Play/Notes:</span>{" "}
            <span className="text-[var(--accent)]">{summary.notes}</span>
          </span>
        )}
      </div>
    </section>
  );
}
