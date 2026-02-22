# Baseball Analytics MVP — Design Proposal

## 1. Data Model (Event-First)

**Principle:** Store only events and game context. All stats, ratings, and recommendations are **derived** at read time or via background jobs — never stored as aggregates.

### 1.1 Core Entities

| Entity | Purpose | Key fields |
|--------|---------|------------|
| **games** | One row per game | `id`, `date`, `home_team`, `away_team`, `our_side` (home/away), `final_score_home`, `final_score_away` |
| **players** | Roster; no league IDs | `id`, `name`, `jersey`, `positions[]`, `is_active` |
| **plate_appearances** | Every PA as an event | `id`, `game_id`, `batter_id`, `inning`, `outs`, `base_state` (e.g. "100"), `score_diff`, `count_balls`, `count_strikes`, `result` (single/double/triple/hr/out/bb/hbp/so/other), `contact_quality` (optional: soft/medium/hard), `chase` (boolean), `pitches_seen`, `rbi`, `notes` (text) |
| **defensive_events** | Coach/analyst decisions in the field | `id`, `game_id`, `inning`, `outs`, `base_state`, `decision_type` (shift/steal_attempt/bunt_defense/hold_runner/etc.), `outcome` (success/fail/neutral), `notes` |
| **game_context_snapshots** | Optional: snapshot of inning/outs/bases/score at key moments | Can be derived from PAs; only add if we need “state at first pitch of inning” etc. |

**Base state:** 3-character string, runner on base (1) or not (0). Example: `"100"` = runner on first only; `"111"` = bases loaded.

**Result taxonomy (plate_appearances):**  
`single`, `double`, `triple`, `hr`, `out`, `bb`, `hbp`, `so`, `sac`, `other`

### 1.2 Internal Ratings (Derived, Not Stored in events)

Stored in **player_ratings** (overridable by analyst):

- `player_id`, `contact_reliability` (1–5), `damage_potential` (1–5), `decision_quality` (1–5), `defense_trust` (1–5)
- `overridden_at`, `overridden_by` — so we know when analyst manually set them
- If not overridden, values are **computed** from events (see computation logic below).

### 1.3 No Aggregates in DB

- No `batting_average`, `obp`, `slg` tables. These are computed from `plate_appearances` when needed (analyst charts only; never shown in Coach Mode).
- Green-light matrix, lineup roles, situation prompts — all computed from events + ratings at request time.

---

## 2. Screen Flow

### 2.1 Mode Selection (Single App)

- **Entry:** One app; URL or toggle: `/analyst` vs `/coach` (or query param `?mode=coach`).
- Analyst mode: full nav (Games, Players, Charts, Settings).
- Coach mode: minimal nav — e.g. “Lineup”, “Green light”, “Situation”, “Alerts” (no raw data links).

### 2.2 Analyst Mode Screens

1. **Dashboard (analyst)**  
   - Quick links: Log game, Edit lineup, View charts.  
   - Optional: “Last 3 games” summary (no raw stats, just W/L and “X events logged”).

2. **Game logging**  
   - Select game (or create) → **Log PA** flow:  
     - Inning, outs, base state (visual: tap bases), score diff (e.g. +2, -1).  
     - Batter (dropdown/search), count (balls/strikes), result (large buttons: Single, Double, Out, SO, BB, etc.), optional contact quality, chase (y/n), pitches seen, notes.  
   - **Log defensive event** (optional): decision type, outcome, notes.  
   - Mobile-first: big tap targets, minimal typing; dropdowns and chips.

3. **Players**  
   - List of players → select one → **Player profile**:  
     - Name, jersey, positions.  
     - **Internal ratings** (1–5 bars): Contact Reliability, Damage Potential, Decision Quality, Defense Trust.  
     - “Override” control: toggle or edit that sets `player_ratings` and sets `overridden_at`.  
     - No raw stat table on this screen (optional “Recent PAs” list with result icons only).

4. **Charts (analyst only)**  
   - Contact quality distribution (from PAs).  
   - Chase tendencies (chase rate by zone/count, from PAs).  
   - Late-game performance (e.g. 7th+ inning, split by result type).  
   - All derived from `plate_appearances` (and optional `game_context`).

5. **Settings**  
   - Roster: add/edit players.  
   - Games: add upcoming/past games.

### 2.3 Coach Mode Screens (No Tables, No Raw Stats)

1. **Lineup**  
   - Today’s lineup with **role labels** only: e.g. “Table-setter”, “Damage”, “Protection”, “Bottom”.  
   - Roles derived from internal ratings (e.g. high contact + low damage → Table-setter; high damage → Damage).  
   - No AVG/OBP/SLG, no decimals.

2. **Green-light matrix**  
   - Grid or cards:  
     - 3–0 swing (yes/no per player or per “type”).  
     - Hit-and-run (green/yellow/red or icon).  
     - Steal (green/yellow/red).  
     - Bunt (green/yellow/red).  
   - Input: player (or slot). Output: icon + one word (e.g. “Yes”, “No”, “Situational”).  
   - Logic: rule-based from ratings (e.g. Decision Quality + Contact Reliability).

3. **Situation**  
   - **Input:** Inning, outs, base state, batter (select from lineup).  
   - **Output:**  
     - One of: **Aggressive** / **Neutral** / **Conservative**.  
     - One short sentence (e.g. “Runner goes on contact; batter takes unless 3–0.”).  
   - Logic: inning/outs/score diff + base state + batter ratings → rule table.

4. **Alerts**  
   - **Defensive:** e.g. “Watch for bunt with runner on 1st” (from defensive_events trends or game context).  
   - **Late-game:** substitution suggestions (e.g. “Consider defensive sub for X in 8th”).  
   - Simple list of 3–5 items; icons and one line each.

### 2.4 UX Constraints (Coach)

- **&lt; 30 seconds:** Situation + Lineup + Green light reachable in 2–3 taps; no login friction if internal tool.  
- Icons, colors, bars; short text; **no decimals, no percentages** in Coach Mode.

---

## 3. Data Flow Summary

- **Write path:** Analyst logs **events** (PAs, defensive events) and can **override** player_ratings.  
- **Read path (analyst):** Events → computed stats → charts; ratings from DB (overridden or computed).  
- **Read path (coach):** Events + ratings → **computation layer** → lineup roles, green-light matrix, situation prompt, alerts. Coach UI only sees outputs (labels, icons, one sentence).

---

## 4. Next Steps

1. Lock schema (games, players, plate_appearances, defensive_events, player_ratings).  
2. Implement Supabase (or Firebase) schema and RLS so coach can only read derived views/API, not raw tables.  
3. Build computation module (ratings from events; lineup roles; green-light; situation; alerts).  
4. Build Analyst UI (game log, players, charts) and Coach UI (lineup, green light, situation, alerts).  
5. Phase 2: export, multi-game trends, more defensive decision types.

**Implementation:** The app lives in `baseball-app/`. See `baseball-app/ARCHITECTURE.md` and `baseball-app/README.md` for setup and Phase 2 (`TODO.md`).
