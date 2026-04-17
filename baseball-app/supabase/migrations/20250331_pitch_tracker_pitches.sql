-- Real-time pitch tracker: coach logs pitch types; analyst assigns results asynchronously.
-- `tracker_group_id` correlates pitches for one at-bat before `plate_appearances` exists; link after save.
-- Future columns (not created here): e.g. velocity_mph numeric, location jsonb, spin_rate, etc.

create table if not exists public.pitches (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  at_bat_id uuid references public.plate_appearances(id) on delete set null,
  tracker_group_id uuid not null,
  pitch_number int not null check (pitch_number >= 1),
  pitch_type text not null check (pitch_type in ('fastball', 'slider', 'curveball', 'changeup')),
  result text check (result is null or result in ('ball', 'strike', 'foul', 'in_play')),
  batter_id uuid not null references public.players(id) on delete cascade,
  pitcher_id uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tracker_group_id, pitch_number)
);

create index if not exists idx_pitches_game on public.pitches(game_id);
create index if not exists idx_pitches_tracker_group on public.pitches(tracker_group_id);
create index if not exists idx_pitches_at_bat on public.pitches(at_bat_id);

comment on column public.pitches.tracker_group_id is 'Stable id for one logical AB; shared by coach URL and analyst until rows are linked to at_bat_id.';

alter table public.pitches enable row level security;

create policy "ba_authenticated_all"
  on public.pitches
  for all
  to authenticated
  using (true)
  with check (true);

create policy "ba_pitches_anon_all"
  on public.pitches
  for all
  to anon
  using (true)
  with check (true);

do $migration$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pitches'
  ) then
    alter publication supabase_realtime add table public.pitches;
  end if;
end $migration$;
