"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Game } from "@/lib/types";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const MONTHS = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

/** Full label for calendar: "vs Opponent" (home) or "@ Opponent" (away). */
function getOpponentLabel(game: Game): string {
  const opponent = game.our_side === "home" ? game.away_team : game.home_team;
  return game.our_side === "home" ? `vs ${opponent}` : `@ ${opponent}`;
}

function getCalendarGrid(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay();
  const daysInMonth = last.getDate();

  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) week.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

interface ScheduleCalendarProps {
  games: Game[];
}

export function ScheduleCalendar({ games }: ScheduleCalendarProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const gamesByDate = useMemo(() => {
    const map = new Map<string, Game[]>();
    const sorted = [...games].sort(
      (a, b) => a.date.localeCompare(b.date)
    );
    for (const g of sorted) {
      const list = map.get(g.date) ?? [];
      list.push(g);
      map.set(g.date, list);
    }
    return map;
  }, [games]);

  const grid = useMemo(() => getCalendarGrid(year, month), [year, month]);
  const monthLabel = MONTHS[month];
  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const today = now.toISOString().slice(0, 10);

  return (
    <div className="card-tech overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text)]">
          Schedule
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--border)] hover:text-[var(--text)]"
            aria-label="Previous month"
          >
            ←
          </button>
          <span className="min-w-[7rem] text-center text-sm font-semibold text-[var(--text)]">
            {monthLabel} {year}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--border)] hover:text-[var(--text)]"
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </div>

      <div className="p-4">
        <table className="w-full table-fixed border-collapse text-base" role="grid" aria-label={`Schedule for ${monthLabel} ${year}`}>
          <thead>
            <tr>
              {DAYS.map((d) => (
                <th
                  key={d}
                  className="border-b border-[var(--border)] py-2 text-center text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((week, wi) => (
              <tr key={wi}>
                {week.map((day, di) => {
                  const dateStr =
                    day !== null
                      ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                      : null;
                  const dayGames = dateStr ? gamesByDate.get(dateStr) ?? [] : [];
                  const isCurrentMonth = day !== null;
                  const isToday = dateStr === today;

                  return (
                    <td
                      key={di}
                      className="h-24 border-b border-[var(--border)] align-top p-0.5 sm:h-28"
                    >
                      <div
                        className={`flex h-full min-h-[5rem] flex-col rounded-lg p-1.5 sm:min-h-[6rem] ${
                          !isCurrentMonth
                            ? "bg-[var(--bg-base)] opacity-50"
                            : dayGames.length > 0
                              ? "bg-[var(--accent)]/20 border border-[var(--accent)]/30"
                              : "bg-[var(--bg-elevated)]"
                        } ${isToday ? "ring-1 ring-[var(--accent)]" : ""}`}
                      >
                        {day !== null && (
                          <span
                            className={`text-sm font-medium tabular-nums ${
                              isCurrentMonth ? "text-[var(--text)]" : "text-[var(--text-muted)]"
                            }`}
                          >
                            {day}
                          </span>
                        )}
                        {dayGames.length > 0 && (
                          <div className="mt-0.5 flex flex-1 flex-col gap-0.5">
                            {dayGames.slice(0, 2).map((game) => (
                              <Link
                                key={game.id}
                                href={`/analyst/games/${game.id}/log`}
                                className="rounded px-1 py-0.5 text-left text-sm font-medium text-[var(--text)] transition hover:bg-[var(--accent)]/30 break-words line-clamp-2"
                                title={getOpponentLabel(game)}
                              >
                                {getOpponentLabel(game)}
                              </Link>
                            ))}
                            {dayGames.length > 2 && (
                              <span className="px-1 text-sm text-[var(--text-muted)]">
                                +{dayGames.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
