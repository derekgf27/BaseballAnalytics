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

/** Opponent club name for links to Analyst → Opponents. */
function getOpponentTeamName(game: Game): string {
  return (game.our_side === "home" ? game.away_team : game.home_team).trim();
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
    <div className="card-tech overflow-hidden rounded-lg border">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 gap-y-2 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2">
        <h2 className="justify-self-start font-display text-xs font-semibold uppercase tracking-wider text-[var(--text)]">
          Schedule
        </h2>
        <div
          className="flex items-center justify-center gap-3 text-[10px] text-white"
          role="list"
          aria-label="Day cell colors: home and away"
        >
          <span className="flex items-center gap-1.5" role="listitem">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm border border-[var(--accent)]/30 bg-[var(--accent)]/20"
              aria-hidden
            />
            <span className="whitespace-nowrap">Home</span>
          </span>
          <span className="flex items-center gap-1.5" role="listitem">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm border border-[var(--danger)]/30 bg-[var(--danger)]/20"
              aria-hidden
            />
            <span className="whitespace-nowrap">Away</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end justify-self-end gap-1 sm:gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded px-1 py-0.5 font-mono text-[11px] text-[var(--accent)] transition hover:bg-[var(--border)] sm:text-xs"
            aria-label="Previous month"
            title="Previous month"
          >
            «
          </button>
          <span className="min-w-[7rem] text-center text-[11px] font-semibold uppercase tracking-wide tabular-nums text-[var(--text)] sm:min-w-[8.5rem] sm:text-xs">
            {monthLabel} {year}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded px-1 py-0.5 font-mono text-[11px] text-[var(--accent)] transition hover:bg-[var(--border)] sm:text-xs"
            aria-label="Next month"
            title="Next month"
          >
            »
          </button>
        </div>
      </div>

      <div className="p-2 sm:p-3">
        <table className="w-full table-fixed border-collapse text-xs" role="grid" aria-label={`Schedule for ${monthLabel} ${year}`}>
          <thead>
            <tr>
              {DAYS.map((d) => (
                <th
                  key={d}
                  className="font-display border-b border-[var(--border)] py-1 text-center text-[10px] font-semibold uppercase leading-none tracking-wider text-[var(--text-muted)]">
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
                  const homeCount = dayGames.filter((g) => g.our_side === "home").length;
                  const awayCount = dayGames.filter((g) => g.our_side === "away").length;
                  const dayCellTone =
                    dayGames.length === 0
                      ? ""
                      : homeCount > 0 && awayCount === 0
                        ? "bg-[var(--accent)]/20 border border-[var(--accent)]/30"
                        : awayCount > 0 && homeCount === 0
                          ? "bg-[var(--danger)]/20 border border-[var(--danger)]/30"
                          : "bg-[var(--bg-elevated)] border border-[var(--border)]";

                  return (
                    <td
                      key={di}
                      className="h-14 border-b border-[var(--border)] align-top p-px sm:h-16"
                    >
                      <div
                        className={`flex h-full min-h-[2.75rem] flex-col rounded-md p-1 sm:min-h-[3.25rem] ${
                          !isCurrentMonth
                            ? "bg-[var(--bg-base)] opacity-50"
                            : dayGames.length > 0
                              ? dayCellTone
                              : "bg-[var(--bg-elevated)]"
                        } ${isToday ? "ring-1 ring-[var(--accent)]" : ""}`}
                      >
                        {day !== null && (
                          <span
                            className={`text-[11px] font-medium leading-none tabular-nums ${
                              isCurrentMonth ? "text-[var(--text)]" : "text-[var(--text-muted)]"
                            }`}
                          >
                            {day}
                          </span>
                        )}
                        {dayGames.length > 0 && (
                          <div className="mt-0.5 flex flex-1 flex-col gap-px overflow-hidden">
                            {dayGames.slice(0, 2).map((game) => {
                              const isHome = game.our_side === "home";
                              return (
                                <Link
                                  key={game.id}
                                  href={`/analyst/opponents/${encodeURIComponent(getOpponentTeamName(game))}`}
                                  className={`rounded px-0.5 py-px text-left text-[10px] font-medium leading-tight transition break-words line-clamp-2 sm:text-[11px] ${
                                    isHome
                                      ? "text-[var(--accent)] hover:bg-[var(--accent)]/25"
                                      : "text-[var(--danger)] hover:bg-[var(--danger)]/25"
                                  }`}
                                  title={`${getOpponentLabel(game)} — opponent roster & stats`}
                                >
                                  {getOpponentLabel(game)}
                                </Link>
                              );
                            })}
                            {dayGames.length > 2 && (
                              <span className="px-0.5 text-[10px] leading-none text-[var(--text-muted)]">
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
