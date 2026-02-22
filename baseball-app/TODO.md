# Phase 2 TODO

## Data & backend
- [x] **Games & Players UI** — Add/edit games and players from Analyst → Games and Analyst → Players (Settings page removed).
- [ ] **Game lineup table** — Use `game_lineups` so Coach Lineup shows today’s game lineup, not “first 9 players”.
- [ ] **RLS** — Restrict coach to read-only; e.g. coach role can only call API routes that return computed views (no direct table select).
- [ ] **Optional auth** — Simple login (e.g. Supabase Auth) to separate analyst vs coach if needed.

## Analyst mode
- [ ] **Rating overrides** — Form on player profile to edit 1–5 and call `upsertPlayerRating` (with overridden_at/overridden_by).
- [ ] **Charts** — Implement from events:
  - Contact quality distribution (count by contact_quality).
  - Chase tendencies (chase rate by count or zone if you add zone later).
  - Late-game performance (inning ≥ 7, result distribution).
- [ ] **Defensive event logging** — UI to log defensive_events (decision_type, outcome) from game log page.
- [ ] **Mobile-first polish** — Larger tap targets, optional PWA for field use.

## Coach mode
- [ ] **Situation: batter ratings** — Pass real ratings for selected batter into situationPrompt (fetch in page, pass to client or compute in API).
- [ ] **Alerts** — Tie substitution alerts to lineup + defense_trust + inning/score (e.g. “Consider defensive sub for X in 8th”).
- [ ] **Green-light** — Optional: filter by “today’s lineup” only.

## Product
- [ ] **Export** — CSV/Excel export of events for backup or external analysis.
- [ ] **Multi-game trends** — Simple “last 5 games” or date-range filters for analyst charts.
- [ ] **Defense_trust computation** — Derive from defensive_events outcomes when that data exists.
