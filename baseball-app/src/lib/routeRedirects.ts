/**
 * Short URL → real App Router paths. Keeps bookmarks like `/games` from 404ing
 * (all Analyst features live under `/analyst/...`, Coach under `/coach/...`).
 *
 * Full route inventory (verify when adding pages):
 * - `/`, `/login`
 * - `/reports` (Reports hub), `/analyst`, `/analyst/roster`, `/analyst/roster/[id]`, `/analyst/stats`, `/analyst/games`,
 *   `/analyst/games/[id]/log`, `/analyst/games/[id]/review`, `/analyst/opponents`, `/analyst/opponents/[slug]`,
 *   `/analyst/lineup`, `/analyst/charts`, `/analyst/record`, `/analyst/run-expectancy`, `/analyst/compare-players`
 * - `/coach`, `/coach/stats`, `/coach/lineup`, `/coach/players`, `/coach/players/[id]`, `/coach/pitch-tracker`
 * - `/coach/today` → redirects to `/coach` (see `app/coach/today/page.tsx`)
 * - `/auth/callback`, API routes under `/api/*`
 */
export const SHORTLINK_REDIRECTS: { source: string; destination: string; permanent: boolean }[] = [
  // Analyst (sidebar: analystNavLinks.ts)
  { source: "/stats", destination: "/analyst/stats", permanent: false },
  { source: "/games", destination: "/analyst/games", permanent: false },
  { source: "/players", destination: "/analyst/roster", permanent: false },
  { source: "/analyst/players", destination: "/analyst/roster", permanent: false },
  {
    source: "/analyst/players/compare",
    destination: "/analyst/compare-players",
    permanent: false,
  },
  {
    source: "/analyst/players/:id",
    destination: "/analyst/roster/:id",
    permanent: false,
  },
  { source: "/record", destination: "/analyst/record", permanent: false },
  { source: "/opponents", destination: "/analyst/opponents", permanent: false },
  { source: "/charts", destination: "/analyst/charts", permanent: false },
  { source: "/analyst/reports", destination: "/reports", permanent: false },
  { source: "/lineup", destination: "/analyst/lineup", permanent: false },
  { source: "/run-expectancy", destination: "/analyst/run-expectancy", permanent: false },
  { source: "/dashboard", destination: "/analyst", permanent: false },

  // Coach (sidebar: CoachNav.tsx — "Today" is `/coach`)
  { source: "/today", destination: "/coach", permanent: false },
  { source: "/situation", destination: "/coach", permanent: false },
  { source: "/green-light", destination: "/coach/stats", permanent: false },
  { source: "/coach/green-light", destination: "/coach/stats", permanent: false },
];
