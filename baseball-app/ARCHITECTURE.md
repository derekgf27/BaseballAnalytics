# Baseball Analytics MVP — Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Next.js App                              │
├─────────────────────────────────────────────────────────────────┤
│  Analyst Mode                    │  Coach Mode                   │
│  /analyst/*                      │  /coach/*                     │
│  - Game logging UI               │  - Lineup (roles only)        │
│  - Player profiles + overrides   │  - Green-light matrix         │
│  - Charts (contact, chase, etc.) │  - Situation prompt           │
│  - Games / Players (add, edit)   │  - Alerts / substitutions    │
├──────────────────────────────────┼───────────────────────────────┤
│  Presentation Layer (React)      │  Same components, no raw data │
├──────────────────────────────────┴───────────────────────────────┤
│  Computation Layer (lib/compute/)                                 │
│  - ratingsFromEvents()  - lineupRoles()  - greenLightMatrix()     │
│  - situationPrompt()   - defensiveAlerts()                       │
│  (Pure functions; no UI, no DB writes)                           │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer (lib/db/)                                             │
│  - Supabase client  - Fetch events, players, games, ratings      │
│  - Write: PAs, defensive events, rating overrides                │
├─────────────────────────────────────────────────────────────────┤
│  Supabase (Backend)                                               │
│  - Tables: games, players, plate_appearances, defensive_events,  │
│            player_ratings                                         │
│  - RLS: coach role can only call server-side endpoints that      │
│          return computed views (no raw table access)             │
└─────────────────────────────────────────────────────────────────┘
```

## Principles

1. **Event-first:** All persisted data is either an event (PA, defensive decision) or reference (games, players). Aggregates and stats are derived.
2. **Computation separate from presentation:** `lib/compute/` has no React, no Supabase; it receives plain objects and returns recommendations/ratings.
3. **Coach sees only outputs:** Coach Mode API/pages return lineup roles, green-light labels, one-sentence situation, alerts — never raw events or decimals.
4. **Analyst can override:** Stored `player_ratings` override computed ratings when present.

## Folder Structure

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx              → mode picker or redirect
│   ├── analyst/
│   │   ├── layout.tsx
│   │   ├── page.tsx          → dashboard
│   │   ├── games/
│   │   │   ├── page.tsx
│   │   │   └── [id]/log/page.tsx
│   │   ├── players/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── charts/page.tsx
│   │   (games, players, charts)
│   ├── coach/
│   │   ├── layout.tsx
│   │   ├── page.tsx          → hub
│   │   ├── lineup/page.tsx
│   │   ├── green-light/page.tsx
│   │   ├── situation/page.tsx
│   │   └── alerts/page.tsx
│   └── api/                  → optional: computed endpoints for coach
├── components/
│   ├── analyst/              → game log form, player ratings editor, charts
│   ├── coach/                → lineup cards, green-light grid, situation result
│   └── shared/               → base state selector, player picker
├── lib/
│   ├── db/                   → Supabase client, queries
│   ├── compute/              → ratings, lineup roles, green light, situation, alerts
│   └── types.ts              → shared types
└── types.ts (or under lib)
```

## Data Flow

- **Analyst logs event:** UI → API or client mutation → Supabase insert into `plate_appearances` or `defensive_events`.
- **Analyst views chart:** Fetch events from Supabase → pass to `lib/compute` for aggregates → render chart (analyst only).
- **Analyst overrides rating:** UI → Supabase upsert `player_ratings` (with `overridden_at`).
- **Coach opens Lineup:** Fetch lineup + players → `lineupRoles(players, ratings)` → render role labels only.
- **Coach uses Situation:** Input (inning, outs, bases, batter) → `situationPrompt(context, batterRating)` → render Aggressive/Neutral/Conservative + one sentence.

## Tech Stack

- **Next.js** (App Router) + **React** + **TypeScript**
- **Tailwind** for styling
- **Supabase** for auth (optional for MVP), database, and RLS
- No ML; rule-based logic in `lib/compute`
