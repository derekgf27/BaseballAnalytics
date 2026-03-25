"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { fetchCoachGamePasAction } from "@/app/coach/actions";
import { CoachMiniLinescore } from "@/components/coach/CoachMiniLinescore";
import { formatDateMMDDYYYY } from "@/lib/format";
import type { TodayGameInfo } from "@/app/coach/CoachTodayClient";
import type { PlateAppearance } from "@/lib/types";

const POLL_MS = 25_000;

export function CoachCurrentGameBar({
  game,
  initialPas,
}: {
  game: TodayGameInfo;
  initialPas: PlateAppearance[];
}) {
  const [pas, setPas] = useState<PlateAppearance[]>(initialPas);

  useEffect(() => {
    setPas(initialPas);
  }, [game.id, initialPas]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await fetchCoachGamePasAction(game.id);
        if (!cancelled) setPas(next);
      } catch {
        /* ignore transient network errors */
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [game.id]);

  const ourClub = game.ourSide === "home" ? game.homeTeam : game.awayTeam;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-5"
    >
      <div className="min-w-0 shrink-0 lg:max-w-[16rem]">
        <div className="section-label">Current game</div>
        <p className="mt-1 text-sm text-[var(--neo-text-muted)]">
          <span className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--neo-accent)]">
            {game.venue}
          </span>
          <span className="text-[var(--neo-text-muted)]"> · {formatDateMMDDYYYY(game.date)}</span>
          {game.startTime ? (
            <span className="text-[var(--neo-text-muted)]"> · {game.startTime}</span>
          ) : null}
        </p>
        <p className="mt-0.5 text-base font-semibold leading-snug text-[var(--neo-text)]">
          {ourClub} vs {game.opponent}
        </p>
      </div>
      <div className="flex w-full min-w-0 justify-end lg:flex-1">
        <CoachMiniLinescore
          awayTeam={game.awayTeam}
          homeTeam={game.homeTeam}
          pas={pas}
        />
      </div>
    </motion.div>
  );
}
