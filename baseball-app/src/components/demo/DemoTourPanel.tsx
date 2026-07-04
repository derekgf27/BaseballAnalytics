import Link from "next/link";
import { isDemoMode } from "@/lib/demoMode";

const TOUR_STEPS = [
  {
    title: "Coach — Today & lineup",
    href: "/coach/today",
    detail: "Decision-first game board with recommended lineup, alerts, and matchup bullets.",
  },
  {
    title: "Coach — Pitch pad",
    href: "/coach/pitch-tracker",
    detail: "Live pitch-type tracker synced with the analyst Record screen.",
  },
  {
    title: "Analyst — Dashboard & stats",
    href: "/analyst",
    detail: "Team batting/pitching summary, schedule, and players to watch.",
  },
  {
    title: "Analyst — Stats & charts",
    href: "/analyst/stats",
    detail: "Full stat sheets with splits, plus spray and discipline charts.",
  },
  {
    title: "Analyst — Reports",
    href: "/analyst/reports",
    detail: "Pre-game scouting packets, post-game snapshots, and PDF export.",
  },
  {
    title: "Analyst — Record (in-progress game)",
    href: "/analyst/record?gameId=e00100a1-000a-4000-8000-00000000000a",
    detail: "Plate appearance logging UI — read-only in this demo, but fully interactive to explore.",
  },
] as const;

export function DemoTourPanel() {
  if (!isDemoMode()) return null;

  return (
    <section
      aria-labelledby="demo-tour-heading"
      className="demo-tour-panel mx-auto mb-8 max-w-3xl rounded-xl border border-amber-600/30 bg-amber-50 px-5 py-5 text-left dark:border-amber-500/25 dark:bg-amber-500/5 sm:px-6"
    >
      <h2
        id="demo-tour-heading"
        className="font-orbitron text-lg font-semibold text-amber-950 dark:text-amber-100"
      >
        Portfolio demo tour
      </h2>
      <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-100/80">
        Sample team:{" "}
        <span className="font-medium text-amber-950 dark:text-amber-50">Metro City Miners</span>. Data
        is read-only — explore every screen below.
      </p>
      <ol className="mt-4 space-y-3">
        {TOUR_STEPS.map((step, index) => (
          <li key={step.href} className="flex gap-3 text-sm">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200/90 text-xs font-semibold text-amber-950 dark:bg-amber-500/20 dark:text-amber-200">
              {index + 1}
            </span>
            <div className="min-w-0">
              <Link
                href={step.href}
                className="font-semibold text-amber-950 hover:underline dark:text-amber-100"
              >
                {step.title}
              </Link>
              <p className="mt-0.5 text-amber-900/80 dark:text-amber-100/70">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
