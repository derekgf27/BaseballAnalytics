"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { ConfidenceBar, ConfidenceSegment } from "@/components/ui/ConfidenceBar";
import { PlayerTagList } from "@/components/ui/PlayerTag";
import type { Player, Ratings } from "@/lib/types";
import type { Confidence } from "@/data/mock";

const TREND_STYLES = {
  hot: "bg-[var(--decision-hot-dim)] text-[var(--decision-hot)] border-[var(--decision-hot)]/30",
  cold: "bg-[var(--decision-red-dim)] text-[var(--decision-red)] border-[var(--decision-red)]/30",
  neutral: "bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border)]",
} as const;

/** Map rating 1–5 to confidence for situational display. */
function ratingToConfidence(r: number): Confidence {
  if (r >= 4) return "high";
  if (r >= 3) return "medium";
  if (r >= 1) return "low";
  return "none";
}

interface CoachPlayerDetailClientProps {
  player: Player;
  ratings: Ratings;
}

export function CoachPlayerDetailClient({ player, ratings }: CoachPlayerDetailClientProps) {
  const router = useRouter();
  const trend = "neutral";
  const trendStyle = TREND_STYLES[trend];
  const trendLabel = "Neutral";

  const risp = ratingToConfidence(ratings.contact_reliability);
  const lateInnings = ratingToConfidence(ratings.damage_potential);
  const defense = ratingToConfidence(ratings.defense_trust);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-[var(--text-muted)] hover:text-[var(--text)]"
          aria-label="Back"
        >
          ←
        </button>
        <Link href="/coach/players" className="text-sm text-[var(--accent-coach)]">
          Players
        </Link>
      </div>

      <header className="card-tech rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
            {player.name}
          </h1>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${trendStyle}`}
          >
            {trendLabel}
          </span>
        </div>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {(player.positions?.length ? player.positions.join(", ") : "—")} · Bats {player.bats ?? "—"} / Throws {player.throws ?? "—"}
        </p>
        <div className="mt-2">
          <PlayerTagList tags={[]} />
        </div>
      </header>

      <Card>
        <CardTitle>Strengths & weaknesses</CardTitle>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Add notes in Analyst → Players for strengths and watch list.
        </p>
      </Card>

      <Card>
        <CardTitle>Situational value</CardTitle>
        <p className="mt-1 text-xs text-[var(--text-faint)]">
          From contact, damage, and defense ratings (Analyst).
        </p>
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-24 text-xs text-[var(--text-muted)]">RISP</span>
            <div className="flex flex-1 gap-0.5">
              <ConfidenceSegment confidence={risp} />
            </div>
            <ConfidenceBar confidence={risp} size="sm" />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-24 text-xs text-[var(--text-muted)]">Late innings</span>
            <div className="flex flex-1 gap-0.5">
              <ConfidenceSegment confidence={lateInnings} />
            </div>
            <ConfidenceBar confidence={lateInnings} size="sm" />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-24 text-xs text-[var(--text-muted)]">Defense</span>
            <div className="flex flex-1 gap-0.5">
              <ConfidenceSegment confidence={defense} />
            </div>
            <ConfidenceBar confidence={defense} size="sm" />
          </div>
        </div>
      </Card>
    </div>
  );
}
