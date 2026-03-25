-- Baserunning events: SB / CS per runner, saved independently of plate appearances.

create table if not exists public.baserunning_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  inning int not null check (inning >= 1),
  inning_half text check (inning_half is null or inning_half in ('top', 'bottom')),
  outs int check (outs is null or (outs >= 0 and outs <= 2)),
  runner_id uuid not null references public.players(id) on delete cascade,
  event_type text not null check (event_type in ('sb', 'cs')),
  batter_id uuid references public.players(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_baserunning_game on public.baserunning_events(game_id);
create index if not exists idx_baserunning_runner on public.baserunning_events(runner_id);

alter table public.baserunning_events enable row level security;

create policy "Allow all for internal tool" on public.baserunning_events for all using (true) with check (true);
