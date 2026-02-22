"use client";

import Link from "next/link";
import { formatHeight } from "@/lib/height";
import type { BattingStats, BattingStatsWithSplits, Player, Ratings } from "@/lib/types";

interface PlayerProfileClientProps {
  player: Player;
  ratings: Ratings;
  isOverridden: boolean;
  battingSplits: BattingStatsWithSplits | null;
}

/** Parse YYYY-MM-DD as local date to avoid UTC-off-by-one when displaying. */
function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatAvg(n: number): string {
  return n.toFixed(3);
}

export function PlayerProfileClient({
  player,
  battingSplits,
}: PlayerProfileClientProps) {
  const today = new Date();
  const age =
    player.birth_date != null && player.birth_date !== ""
      ? (() => {
          const b = parseLocalDate(player.birth_date);
          let a = today.getFullYear() - b.getFullYear();
          if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) a--;
          return a;
        })()
      : null;

  const formatBirthDate = (d: string) => {
    const date = parseLocalDate(d);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const info = {
    jersey: player.jersey != null && player.jersey !== "" ? `#${player.jersey}` : null,
    positions: player.positions?.length ? player.positions.join(", ") : null,
    batsThrows:
      player.bats != null || player.throws != null
        ? `${player.bats ?? "—"}/${player.throws ?? "—"}`
        : null,
    heightWeight:
      player.height_in != null || player.weight_lb != null
        ? `${player.height_in != null ? formatHeight(player.height_in) : ""}${player.height_in != null && player.weight_lb != null ? " " : ""}${player.weight_lb != null ? `${player.weight_lb} lb` : ""}`.trim()
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
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link
          href="/analyst/players"
          className="text-base font-medium text-[var(--accent)] hover:underline"
        >
          ← Players
        </Link>
      </div>

      <div className="card-tech flex flex-col gap-6 p-6 sm:flex-row">
        <div className="flex shrink-0 flex-col items-center gap-3 sm:w-40">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--accent-dim)] text-2xl font-bold text-[var(--accent)]">
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
        </div>
      </div>

      {battingSplits && (battingSplits.overall.pa ?? 0) > 0 && (
        <div className="card-tech rounded-lg border border-[var(--border)] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Batting splits
          </h2>
          <p className="mt-1 text-xs text-[var(--text-faint)]">
            Record pitcher hand when recording PAs to see vs LHP / vs RHP.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
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
    </div>
  );
}
