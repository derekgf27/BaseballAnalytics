-- Baseball Analytics MVP — Event-first schema
-- Run in Supabase SQL editor. No aggregates stored; stats derived from events.

-- Games
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  home_team text not null,
  away_team text not null,
  our_side text not null check (our_side in ('home', 'away')),
  game_time time,
  final_score_home int,
  final_score_away int,
  created_at timestamptz default now()
);

-- Players (roster; no league IDs)
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  jersey text,
  positions text[] default '{}',
  bats text check (bats is null or bats in ('L', 'R', 'S')),
  throws text check (throws is null or throws in ('L', 'R')),
  height_in int check (height_in is null or (height_in >= 48 and height_in <= 96)),
  weight_lb int check (weight_lb is null or (weight_lb >= 80 and weight_lb <= 350)),
  hometown text,
  birth_date date,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Plate appearance events (core)
create table if not exists public.plate_appearances (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  batter_id uuid not null references public.players(id),
  inning int not null check (inning >= 1),
  outs int not null check (outs >= 0 and outs <= 2),
  base_state text not null check (char_length(base_state) = 3 and base_state ~ '^[01]{3}$'),
  score_diff int not null,
  count_balls int not null check (count_balls >= 0 and count_balls <= 3),
  count_strikes int not null check (count_strikes >= 0 and count_strikes <= 2),
  result text not null check (result in (
    'single', 'double', 'triple', 'hr', 'out', 'bb', 'ibb', 'hbp', 'so', 'sac', 'sac_fly', 'sac_bunt', 'other'
  )),
  contact_quality text check (contact_quality is null or contact_quality in ('soft', 'medium', 'hard')),
  chase boolean,
  pitches_seen int check (pitches_seen is null or pitches_seen >= 0),
  rbi int default 0,
  runs_scored_player_ids uuid[] default '{}',
  stolen_bases int default 0 check (stolen_bases is null or (stolen_bases >= 0 and stolen_bases <= 10)),
  hit_direction text check (hit_direction is null or hit_direction in ('pulled', 'up_the_middle', 'opposite_field')),
  pitcher_hand text check (pitcher_hand is null or pitcher_hand in ('L', 'R')),
  inning_half text check (inning_half is null or inning_half in ('top', 'bottom')),
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_pa_game on public.plate_appearances(game_id);
create index if not exists idx_pa_batter on public.plate_appearances(batter_id);
create index if not exists idx_pa_game_batter on public.plate_appearances(game_id, batter_id);

-- Defensive decision events
create table if not exists public.defensive_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  inning int not null,
  outs int not null,
  base_state text not null check (char_length(base_state) = 3 and base_state ~ '^[01]{3}$'),
  decision_type text not null,
  outcome text check (outcome in ('success', 'fail', 'neutral')),
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_def_game on public.defensive_events(game_id);

-- Internal ratings (overridable by analyst; computed when overridden_at is null)
create table if not exists public.player_ratings (
  player_id uuid primary key references public.players(id) on delete cascade,
  contact_reliability int check (contact_reliability >= 1 and contact_reliability <= 5),
  damage_potential int check (damage_potential >= 1 and damage_potential <= 5),
  decision_quality int check (decision_quality >= 1 and decision_quality <= 5),
  defense_trust int check (defense_trust >= 1 and defense_trust <= 5),
  overridden_at timestamptz,
  overridden_by text,
  updated_at timestamptz default now()
);

-- Optional: lineup for a given game (slot 1-9, player_id). Allows "today's lineup" for coach.
create table if not exists public.game_lineups (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  slot int not null check (slot >= 1 and slot <= 9),
  player_id uuid not null references public.players(id),
  unique(game_id, slot)
);

create index if not exists idx_lineup_game on public.game_lineups(game_id);

-- Saved lineup templates (reusable; attach one when creating a game)
create table if not exists public.saved_lineups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.saved_lineup_slots (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references public.saved_lineups(id) on delete cascade,
  slot int not null check (slot >= 1 and slot <= 9),
  player_id uuid not null references public.players(id),
  position text,
  unique(lineup_id, slot)
);

create index if not exists idx_saved_lineup_slots_lineup on public.saved_lineup_slots(lineup_id);

-- RLS (example: allow anon or authenticated; restrict coach to read-only computed views in app layer)
alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.plate_appearances enable row level security;
alter table public.defensive_events enable row level security;
alter table public.player_ratings enable row level security;
alter table public.game_lineups enable row level security;
alter table public.saved_lineups enable row level security;
alter table public.saved_lineup_slots enable row level security;

-- Policy: allow all for MVP (internal tool). Tighten later with roles.
create policy "Allow all for internal tool" on public.games for all using (true) with check (true);
create policy "Allow all for internal tool" on public.players for all using (true) with check (true);
create policy "Allow all for internal tool" on public.plate_appearances for all using (true) with check (true);
create policy "Allow all for internal tool" on public.defensive_events for all using (true) with check (true);
create policy "Allow all for internal tool" on public.player_ratings for all using (true) with check (true);
create policy "Allow all for internal tool" on public.game_lineups for all using (true) with check (true);
create policy "Allow all for internal tool" on public.saved_lineups for all using (true) with check (true);
create policy "Allow all for internal tool" on public.saved_lineup_slots for all using (true) with check (true);
