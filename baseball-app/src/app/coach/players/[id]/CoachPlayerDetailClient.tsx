"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { ConfidenceBar, ConfidenceSegment } from "@/components/ui/ConfidenceBar";
import { PlayerTagList } from "@/components/ui/PlayerTag";
import { formatHeight } from "@/lib/height";
import type { Player, Ratings, BattingStatsWithSplits } from "@/lib/types";
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
  battingSplits: BattingStatsWithSplits | null;
}

/** Parse YYYY-MM-DD as local date to avoid UTC-off-by-one when displaying. */
function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function normalizeHand(hand: string | null | undefined): string | null {
  if (hand == null || hand === "") return null;
  const code = hand.toUpperCase();
  if (code.startsWith("L")) return "Left";
  if (code.startsWith("R")) return "Right";
  if (code.startsWith("S")) return "Switch";
  return hand;
}

function formatAvg(n: number): string {
  const s = n.toFixed(3);
  return s.startsWith("0.") ? s.slice(1) : s;
}

export function CoachPlayerDetailClient({ player, ratings, battingSplits }: CoachPlayerDetailClientProps) {
  const router = useRouter();
  const trend = "neutral";
  const trendStyle = TREND_STYLES[trend];
  const trendLabel = "Neutral";

  const risp = ratingToConfidence(ratings.contact_reliability);
  const lateInnings = ratingToConfidence(ratings.damage_potential);
  const defense = ratingToConfidence(ratings.defense_trust);

  const today = new Date();
  const age =
    player.birth_date != null && player.birth_date !== ""
      ? (() => {
          const b = parseLocalDate(player.birth_date);
          let a = today.getFullYear() - b.getFullYear();
          if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate()))
            a--;
          return a;
        })()
      : null;

  const formatBirthDate = (d: string) => {
    const date = parseLocalDate(d);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const batsLabel = normalizeHand(player.bats);
  const throwsLabel = normalizeHand(player.throws);

  const info = {
    jersey: player.jersey != null && player.jersey !== "" ? `#${player.jersey}` : null,
    positions: player.positions?.length ? player.positions.join(", ") : null,
    batsThrows:
      batsLabel != null || throwsLabel != null
        ? `${batsLabel ?? "—"} / ${throwsLabel ?? "—"}`
        : null,
    heightWeight:
      player.height_in != null || player.weight_lb != null
        ? `${player.height_in != null ? formatHeight(player.height_in) : ""}${
            player.height_in != null && player.weight_lb != null ? " " : ""
          }${player.weight_lb != null ? `${player.weight_lb} lb` : ""}`.trim()
        : null,
    hometown: player.hometown?.trim() || null,
    birthday: player.birth_date ? formatBirthDate(player.birth_date) : null,
    age: age != null ? `${age} yrs` : null,
  };

  const rows = [
    info.jersey && { label: "Jersey", value: info.jersey },
    info.positions && { label: "Positions", value: info.positions },
    info.batsThrows && { label: "Bats / Throws", value: info.batsThrows },
    info.heightWeight && { label: "Height · Weight", value: info.heightWeight },
    info.hometown && { label: "Hometown", value: info.hometown },
    info.birthday && { label: "Birthday", value: info.birthday },
    info.age && { label: "Age", value: info.age },
  ].filter(Boolean) as { label: string; value: string }[];

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

      {/* Profile header – mirror Analyst player profile layout */}
      <section className="card-tech flex flex-col gap-6 p-6 sm:flex-row">
        <div className="flex shrink-0 flex-col items-center gap-3 sm:w-40">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--accent-coach-dim)] text-2xl font-bold text-[var(--accent-coach)]">
            {player.name
              .split(/\s+/)
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <p className="text-center text-lg font-semibold text-[var(--text)] sm:text-xl">
            {player.name}
          </p>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${trendStyle}`}
          >
            {trendLabel}
          </span>
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          {rows.map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                {label}
              </p>
              <p className="mt-0.5 text-base font-semibold text-[var(--text)]">{value}</p>
            </div>
          ))}
          <div className="mt-1">
            <PlayerTagList tags={[]} />
          </div>
        </div>
      </section>

      {/* Season stats summary row (same columns as batting stats table) */}
      {battingSplits && (
        <section className="card-tech rounded-lg border border-[var(--border)] p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
            Season line
          </h2>
          <p className="mt-1 text-xs text-[var(--text-faint)]">
            Same columns as the full batting stats view, for this player only.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text)]">
                  <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wider">PA</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">AB</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">H</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">2B</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">3B</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">HR</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">RBI</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">R</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">SB</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">BB</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">IBB</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">HBP</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">SO</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">K%</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">BB%</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">AVG</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">OBP</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">SLG</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">OPS</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">OPS+</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">wOBA</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 pr-3 text-left tabular-nums text-[var(--text)]">
                    {battingSplits.overall.pa ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.ab ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.h ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.double ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.triple ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.hr ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.rbi ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.r ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.sb ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.bb ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.ibb ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.hbp ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.so ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.kPct != null ? `${(battingSplits.overall.kPct * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.bbPct != null ? `${(battingSplits.overall.bbPct * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {formatAvg(battingSplits.overall.avg)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {formatAvg(battingSplits.overall.obp)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {formatAvg(battingSplits.overall.slg)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {formatAvg(battingSplits.overall.ops)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {battingSplits.overall.opsPlus ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {formatAvg(battingSplits.overall.woba)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Strengths and situational cards */}
      <Card>
        <CardTitle>Strengths & weaknesses</CardTitle>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Add notes in Analyst → Players for strengths and watch list.
        </p>
      </Card>

      {/* Batting splits table (same as Analyst view) */}
      {battingSplits && (
        <div className="card-tech rounded-lg border border-[var(--border)] p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
            Batting splits
          </h2>
          <p className="mt-1 text-xs text-[var(--text-faint)]">
            Record pitcher hand when recording PAs to see vs LHP / vs RHP.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text)]">
                  <th className="py-2 pr-4 font-semibold">Split</th>
                  <th className="py-2 px-2 text-right">PA</th>
                  <th className="py-2 px-2 text-right">AVG</th>
                  <th className="py-2 px-2 text-right">OBP</th>
                  <th className="py-2 px-2 text-right">SLG</th>
                  <th className="py-2 px-2 text-right">OPS</th>
                  <th className="py-2 px-2 text-right">wOBA</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Overall", s: battingSplits.overall },
                  { label: "vs LHP", s: battingSplits.vsL },
                  { label: "vs RHP", s: battingSplits.vsR },
                ].map(({ label, s }) => (
                  <tr key={label} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 pr-4 font-medium text-[var(--text)]">{label}</td>
                    {s ? (
                      <>
                        <td className="py-2 px-2 text-right tabular-nums text-[var(--text)]">{s.pa ?? "—"}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-[var(--text)]">{formatAvg(s.avg)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-[var(--text)]">{formatAvg(s.obp)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-[var(--text)]">{formatAvg(s.slg)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-[var(--text)]">{formatAvg(s.ops)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-[var(--text)]">{formatAvg(s.woba)}</td>
                      </>
                    ) : (
                      <>
                        <td colSpan={6} className="py-2 px-2 text-right text-[var(--text-faint)]">
                          No PAs
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
