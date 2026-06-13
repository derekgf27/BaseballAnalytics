# Queries Refactor — Before / After Comparison

## Summary

| Metric | Before (`queries.ts`) | After (`queries/` modules) |
|--------|----------------------|----------------------------|
| File structure | 1 monolithic file (~2,272 lines) | 17 domain modules + barrel `index.ts` |
| `select("*")` / bare `.select()` in query layer | **43** occurrences | **0** |
| N+1 hot paths fixed | 3 | 3 (batched) |
| Public API (`@/lib/db/queries`) | unchanged | unchanged (barrel re-exports) |

Build verified: `npm run build` passes.

---

## Module Layout (After)

```
src/lib/db/queries/
  columns.ts          — explicit column constants
  client.ts           — getSupabase, fetchFieldingErrorCountsForPlayers
  index.ts            — barrel re-exports (backward compatible)
  types.ts            — TrackedOpponentRow, PitcherOfficialTotals
  games.ts            — game CRUD + getGamesByIds
  players.ts
  lineups.ts
  plateAppearances.ts
  pitchEvents.ts
  pitchTracker.ts
  baserunning.ts
  defensive.ts
  ratings.ts
  opponents.ts
  matchup.ts
  charts.ts
  batch.ts            — getHitterReportSprayData (multi-player batch)
  stats/
    batting.ts
    pitching.ts
```

---

## Payload Reduction (Column Selection)

All table reads/writes now use explicit column lists from `columns.ts` (or inline minimal lists for junction tables).

| Table | Constant / pattern | Columns selected | Before |
|-------|-------------------|------------------|--------|
| `games` | `GAME_COLUMNS` | 22 | `select("*")` |
| `players` | `PLAYER_COLUMNS` | 18 | `select("*")` |
| `plate_appearances` | `PLATE_APPEARANCE_COLUMNS` | 27 | `select("*")` |
| `baserunning_events` | `BASERUNNING_EVENT_COLUMNS` | 10 | `select("*")` |
| `pitch_events` | `PITCH_EVENT_COLUMNS` | 7 | `select("*")` |
| `pitches` (tracker) | `PITCH_TRACKER_COLUMNS` | 9 | `select("*")` |
| `defensive_events` | `DEFENSIVE_EVENT_COLUMNS` | 9 | `select("*")` |
| `player_ratings` | `PLAYER_RATING_COLUMNS` | 7 | `select("*")` |
| `game_lineups` | inline | 5 (`game_id, side, slot, player_id, position`) | already narrow |
| `saved_lineups` | inline | 3 (`id, name, created_at`) | already narrow |
| `tracked_opponents` | inline | 2 (`id, name`) | already narrow |

**Insert/update return paths** also use explicit selects (e.g. `insertGame` → `.select(GAME_COLUMNS)` instead of `.select()`).

### Estimated row-level payload (typical read)

Assuming current schema matches the TypeScript types (no extra DB-only columns today), per-row byte savings are modest on most tables. The largest **operational** payload wins come from **not loading entire tables** when only a subset is needed (see query-count section below).

| Hot path | Before (approx.) | After (approx.) | Notes |
|----------|------------------|-----------------|-------|
| `getClubBattingMatchupPayload` (50 players, 200 games in DB, 30 games in sample) | All 200 game rows | 30 game rows | **~85% fewer game rows** transferred |
| `getClubPitchingMatchupPayload` (same scale) | All 200 game rows | ~30 game rows | **~85% fewer game rows** |
| `getGames()` | same columns | same columns | Explicit list; future-proof against schema growth |
| `getPitchEventsForPaIds` (100 events) | 7 cols | 7 cols | Was `*`; now pinned to needed fields |

---

## Query Count Reduction (N+1 Fixes)

### 1. `getClubBattingMatchupPayload`

| | Before | After |
|---|--------|-------|
| Queries | 4 parallel (`plate_appearances`, **full `games` table**, baserunning, lineups) + pitch events | 3 parallel + `getGamesByIds(referenced)` + pitch events |
| Games fetched | **Every game row** | **Only games referenced by PAs** |

**Example:** 200 games in DB, 25 games in player sample → **175 fewer game rows** per call.

### 2. `getClubPitchingMatchupPayload`

| | Before | After |
|---|--------|-------|
| Queries | 4 parallel (`plate_appearances`, **full `games` table**, home starters, away starters) + pitch events | 3 parallel + `getGamesByIds(referenced)` + pitch events |
| Games fetched | **Every game row** | **Only games referenced by PAs** |

### 3. `fetchHitterReportBundleAction` → `getHitterReportSprayData`

| | Before (N players) | After (N players, max 5) |
|---|-------------------|--------------------------|
| PA queries | **2N** (`getPlateAppearancesByBatter` + `getPlateAppearancesByPitcher` per player) | **2** (`getPlateAppearancesByBatters`, `getPlateAppearancesByPitchers`) |
| Pitch-event queries | **N** (`getPitchEventsForPaIds` per player) | **1** (batched over all batter PAs) |
| **Total spray-related** | **3N** | **3** |

| N | Before queries | After queries | Reduction |
|---|----------------|---------------|-----------|
| 1 | 3 | 3 | 0% |
| 3 | 9 | 3 | **67%** |
| 5 | 15 | 3 | **80%** |

---

## New / Modified Functions

### New

| Function | Module | Purpose |
|----------|--------|---------|
| `getGamesByIds` | `games.ts` | Fetch only referenced games (matchup optimization) |
| `getPlateAppearancesByPitchers` | `plateAppearances.ts` | Batch PA fetch by pitcher id list |
| `getHitterReportSprayData` | `batch.ts` | Batched PA + pitch events for multi-player reports |

### Modified (column selection or batching logic)

All exported query functions now use explicit column constants. Functions with **behavioral** query changes:

| Function | Change |
|----------|--------|
| `getClubBattingMatchupPayload` | Removed full-table `games` fetch; uses `getGamesByIds` |
| `getClubPitchingMatchupPayload` | Removed full-table `games` fetch; uses `getGamesByIds` |
| `fetchHitterReportBundleAction` | Uses `getHitterReportSprayData` instead of per-player loops |
| `insertGame` | `.select(GAME_COLUMNS)` on return |
| `updateGame` | `.select(GAME_COLUMNS)` on return |
| `insertPlayer` / `updatePlayer` | `.select(PLAYER_COLUMNS)` on return |
| `insertBaserunningEvent` | `.select(BASERUNNING_EVENT_COLUMNS)` on return |
| `insertPlateAppearance` / `updatePlateAppearanceRow` | `.select(PLATE_APPEARANCE_COLUMNS)` on return |
| `insertSavedLineup` | `.select("id, name, created_at")` on return |

### Unchanged API surface

All 80+ exports remain available via `@/lib/db/queries`. No UI component imports were changed.

---

## Migration Notes

- **Imports:** Continue using `@/lib/db/queries`; the barrel `index.ts` re-exports all modules.
- **Direct domain imports:** Optional (`@/lib/db/queries/games`, etc.) for tree-shaking in new code.
- **Scripts:** `scripts/split-queries*.mjs` and `post-process-queries.mjs` were used for the split; safe to keep for reference or remove.

---

## Verification

```bash
cd baseball-app
npm run build   # ✓ passes
```

No `select("*")` or bare `.select()` remain under `src/lib/db/queries/`.
