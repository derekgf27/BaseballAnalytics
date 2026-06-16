"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ourTeamOutcomeFromFinalScore } from "@/lib/gameRecord";
import { formatDateMMDDYYYY } from "@/lib/format";
import type { Game } from "@/lib/types";
import {
  analystGameLogHref,
  analystGameReviewHref,
  analystOpponentDetailHref,
} from "@/lib/analystRoutes";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const GAMES_PER_SLATE = 2;

function getOpponentLabel(game: Game): string {
  const opponent = game.our_side === "home" ? game.away_team : game.home_team;
  return game.our_side === "home" ? `vs ${opponent}` : `@ ${opponent}`;
}

function getOpponentTeamName(game: Game): string {
  return (game.our_side === "home" ? game.away_team : game.home_team).trim();
}

function hasFinalScore(game: Game): boolean {
  const h = game.final_score_home;
  const a = game.final_score_away;
  return h != null && a != null && !Number.isNaN(h) && !Number.isNaN(a);
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function sundayDatesInMonth(year: number, month: number): string[] {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    if (new Date(year, month, d).getDay() === 0) out.push(dateKey(year, month, d));
  }
  return out;
}

function sortGamesChronologically(a: Game, b: Game): number {
  const byDate = a.date.localeCompare(b.date);
  if (byDate !== 0) return byDate;
  const ta = a.created_at ?? "";
  const tb = b.created_at ?? "";
  if (ta && tb) return ta.localeCompare(tb);
  return a.id.localeCompare(b.id);
}

function dayOfMonth(dateStr: string): number {
  return Number(dateStr.split("-")[2]);
}

function pickDefaultSunday(sundays: string[], gamesByDate: Map<string, Game[]>, today: string): string {
  if (sundays.length === 0) return "";
  if (sundays.includes(today)) return today;
  const upcoming = sundays.find((d) => d >= today);
  if (upcoming) return upcoming;
  const withGames = sundays.find((d) => (gamesByDate.get(d)?.length ?? 0) > 0);
  if (withGames) return withGames;
  return sundays[sundays.length - 1] ?? sundays[0];
}

interface ScheduleCalendarProps {
  games: Game[];
}

function GameSlot({
  game,
  slotLabel,
}: {
  game: Game | null;
  slotLabel: string;
}) {
  if (!game) {
    return (
      <div className="flex min-h-[4.5rem] flex-col rounded-md border border-dashed border-[var(--border)] bg-[var(--bg-base)]/60 px-2.5 py-2 sm:min-h-[5rem]">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
          {slotLabel}
        </span>
        <span className="mt-auto text-xs text-[var(--text-faint)]">Open slot</span>
      </div>
    );
  }

  const isHome = game.our_side === "home";
  const finalized = hasFinalScore(game);
  const outcome = finalized ? ourTeamOutcomeFromFinalScore(game) : null;
  const opponentName = getOpponentTeamName(game);
  const toneBorder = isHome ? "border-[var(--accent)]/35" : "border-[var(--danger)]/35";
  const toneBg = isHome ? "bg-[var(--accent)]/12" : "bg-[var(--danger)]/12";
  const toneText = isHome ? "text-[var(--accent)]" : "text-[var(--danger)]";

  return (
    <div
      className={`flex min-h-[4.5rem] flex-col rounded-md border px-2.5 py-2 sm:min-h-[5rem] ${toneBorder} ${toneBg}`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {slotLabel}
      </span>
      <Link
        href={analystGameLogHref(game.id)}
        className={`mt-1 text-sm font-semibold leading-snug transition hover:underline ${toneText}`}
      >
        {getOpponentLabel(game)}
      </Link>
      {finalized && outcome != null ? (
        <p className="mt-0.5 flex flex-wrap items-baseline gap-1.5 text-xs tabular-nums">
          <span
            className={
              outcome === "W"
                ? "font-bold text-[var(--success)]"
                : outcome === "L"
                  ? "font-bold text-[var(--danger)]"
                  : "font-bold text-[var(--text-muted)]"
            }
          >
            {outcome}
          </span>
          <span className="text-[var(--text-muted)]">
            ({game.final_score_away}-{game.final_score_home})
          </span>
        </p>
      ) : (
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Not finalized</p>
      )}
      <div className="mt-auto flex flex-wrap gap-x-2 gap-y-0.5 pt-1 text-[11px]">
        <Link
          href={analystGameReviewHref(game.id)}
          className="text-[var(--text-muted)] underline-offset-2 hover:text-[var(--accent)] hover:underline"
        >
          Review
        </Link>
        <Link
          href={analystOpponentDetailHref(opponentName)}
          className="text-[var(--text-muted)] underline-offset-2 hover:text-[var(--accent)] hover:underline"
        >
          Opponent
        </Link>
      </div>
    </div>
  );
}

function OffSundayGameRow({ game }: { game: Game }) {
  const isHome = game.our_side === "home";
  const finalized = hasFinalScore(game);
  const outcome = finalized ? ourTeamOutcomeFromFinalScore(game) : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm sm:px-4">
      <div className="min-w-0">
        <span className="text-xs text-[var(--text-muted)]">{formatDateMMDDYYYY(game.date)}</span>
        <Link
          href={analystGameLogHref(game.id)}
          className={`ml-2 font-medium ${isHome ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}
        >
          {getOpponentLabel(game)}
        </Link>
        {finalized && outcome != null ? (
          <span className="ml-2 text-xs tabular-nums text-[var(--text-muted)]">
            {outcome} ({game.final_score_away}-{game.final_score_home})
          </span>
        ) : null}
      </div>
      <Link
        href={analystGameReviewHref(game.id)}
        className="text-xs text-[var(--accent)] hover:underline"
      >
        Review
      </Link>
    </div>
  );
}

export function ScheduleCalendar({ games }: ScheduleCalendarProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const gamesByDate = useMemo(() => {
    const map = new Map<string, Game[]>();
    for (const g of [...games].sort(sortGamesChronologically)) {
      const list = map.get(g.date) ?? [];
      list.push(g);
      map.set(g.date, list);
    }
    return map;
  }, [games]);

  const sundays = useMemo(() => sundayDatesInMonth(year, month), [year, month]);
  const today = now.toISOString().slice(0, 10);
  const monthLabel = MONTHS[month];

  const defaultSunday = useMemo(
    () => pickDefaultSunday(sundays, gamesByDate, today),
    [sundays, gamesByDate, today]
  );

  const [selectedDate, setSelectedDate] = useState(defaultSunday);

  useEffect(() => {
    setSelectedDate(defaultSunday);
  }, [defaultSunday]);

  const selectedGames = useMemo(() => {
    const list = gamesByDate.get(selectedDate) ?? [];
    const slots: (Game | null)[] = [];
    for (let i = 0; i < GAMES_PER_SLATE; i++) slots.push(list[i] ?? null);
    return slots;
  }, [gamesByDate, selectedDate]);

  const offSundayGames = useMemo(() => {
    const sundaySet = new Set(sundays);
    return [...games]
      .filter((g) => {
        const [y, m] = g.date.split("-").map(Number);
        return y === year && m === month + 1 && !sundaySet.has(g.date);
      })
      .sort(sortGamesChronologically);
  }, [games, year, month, sundays]);

  const monthGameCount = useMemo(() => {
    let n = 0;
    for (const [dateStr, list] of gamesByDate) {
      const [y, m] = dateStr.split("-").map(Number);
      if (y === year && m === month + 1) n += list.length;
    }
    return n;
  }, [gamesByDate, year, month]);

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

  const selectedHeading = selectedDate
    ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div className="card-tech overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 sm:px-4">
        <div>
          <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text)]">
            Sunday schedule
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            Doubleheaders · {monthGameCount} game{monthGameCount === 1 ? "" : "s"} in {monthLabel}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded px-1.5 py-0.5 font-mono text-sm text-[var(--accent)] transition hover:bg-[var(--border)]"
            aria-label="Previous month"
          >
            «
          </button>
          <span className="min-w-[7rem] text-center text-xs font-semibold tabular-nums sm:text-sm">
            {monthLabel} {year}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded px-1.5 py-0.5 font-mono text-sm text-[var(--accent)] transition hover:bg-[var(--border)]"
            aria-label="Next month"
          >
            »
          </button>
        </div>
        <div
          className="mt-2 flex w-full flex-wrap items-center gap-4 text-[10px] text-[var(--text-muted)]"
          role="list"
          aria-label="Home and away colors"
        >
          <span className="flex items-center gap-1.5" role="listitem">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm border border-[var(--accent)]/30 bg-[var(--accent)]/20"
              aria-hidden
            />
            Home
          </span>
          <span className="flex items-center gap-1.5" role="listitem">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm border border-[var(--danger)]/30 bg-[var(--danger)]/20"
              aria-hidden
            />
            Away
          </span>
        </div>
      </div>

      <div className="border-b border-[var(--border)] bg-[var(--bg-base)] px-2 py-3 sm:px-3">
        <div
          className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label={`Sundays in ${monthLabel} ${year}`}
        >
          {sundays.map((dateStr) => {
            const day = dayOfMonth(dateStr);
            const count = gamesByDate.get(dateStr)?.length ?? 0;
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === today;
            const hasGames = count > 0;

            return (
              <button
                key={dateStr}
                type="button"
                role="tab"
                aria-selected={isSelected ? "true" : "false"}
                onClick={() => setSelectedDate(dateStr)}
                className={`flex min-w-[3.25rem] shrink-0 flex-col items-center rounded-lg border px-2 py-1.5 transition sm:min-w-[3.5rem] ${
                  isSelected
                    ? "border-[var(--accent)] bg-[var(--accent)]/20 shadow-[0_0_12px_rgba(var(--neo-accent-r),var(--neo-accent-g),var(--neo-accent-b),0.25)]"
                    : hasGames
                      ? "border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--accent)]/50"
                      : "border-[var(--border)]/60 bg-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <span className="text-[9px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                  Sun
                </span>
                <span
                  className={`font-display text-xl font-bold leading-none tabular-nums ${
                    isSelected ? "text-[var(--accent)]" : "text-[var(--text)]"
                  }`}
                >
                  {day}
                </span>
                {isToday ? (
                  <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-[var(--accent)]">
                    Today
                  </span>
                ) : hasGames ? (
                  <span className="mt-0.5 text-[9px] tabular-nums text-[var(--text-muted)]">
                    {count} gm
                  </span>
                ) : (
                  <span className="mt-0.5 text-[9px] text-[var(--text-faint)]">—</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate ? (
        <div
          className="p-3 sm:p-4"
          role="tabpanel"
          aria-label={selectedHeading}
        >
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <p className="font-display text-sm font-semibold text-[var(--text)]">{selectedHeading}</p>
            {selectedDate === today ? (
              <span className="rounded bg-[var(--accent)]/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                Today
              </span>
            ) : null}
            {!selectedGames.some((g) => g != null) ? (
              <span className="text-[11px] text-[var(--text-faint)]">No games scheduled</span>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <GameSlot game={selectedGames[0]} slotLabel="Game 1" />
            <GameSlot game={selectedGames[1]} slotLabel="Game 2" />
          </div>
        </div>
      ) : null}

      {offSundayGames.length > 0 ? (
        <div className="border-t border-[var(--border)]">
          <p className="bg-[var(--bg-elevated)]/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] sm:px-4">
            Other dates
          </p>
          <div className="divide-y divide-[var(--border)]/60">
            {offSundayGames.map((g) => (
              <OffSundayGameRow key={g.id} game={g} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
