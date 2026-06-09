-- Role-based RLS for production (run after auth migrations 20260608–20260610).
--
-- Before: anon key could read/write all stats (open "Allow all for internal tool" policies).
-- After:  no JWT → no data access. Coach = read stats + pitch pad + lineup templates.
--         Analyst/Admin = full read/write on stats tables.
--
-- Requires AUTH_REQUIRED=true and signed-in staff accounts with profiles.role set.
-- Admin user management still uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).

-- ---------------------------------------------------------------------------
-- Helpers (security definer — read role from profiles for auth.uid())
-- ---------------------------------------------------------------------------

create or replace function public.ba_current_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.ba_is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role in ('coach', 'analyst', 'admin') from public.profiles where id = auth.uid()),
    false
  )
$$;

create or replace function public.ba_can_write_stats()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role in ('analyst', 'admin') from public.profiles where id = auth.uid()),
    false
  )
$$;

create or replace function public.ba_can_write_pitch_tracker()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role in ('coach', 'analyst', 'admin') from public.profiles where id = auth.uid()),
    false
  )
$$;

revoke all on function public.ba_current_role() from public;
revoke all on function public.ba_is_staff() from public;
revoke all on function public.ba_can_write_stats() from public;
revoke all on function public.ba_can_write_pitch_tracker() from public;
grant execute on function public.ba_current_role() to authenticated;
grant execute on function public.ba_is_staff() to authenticated;
grant execute on function public.ba_can_write_stats() to authenticated;
grant execute on function public.ba_can_write_pitch_tracker() to authenticated;

-- ---------------------------------------------------------------------------
-- Remove all existing permissive policies (MVP + anon overrides)
-- ---------------------------------------------------------------------------

do $drop$
declare
  r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'players',
        'games',
        'plate_appearances',
        'pitch_events',
        'game_lineups',
        'saved_lineups',
        'saved_lineup_slots',
        'player_ratings',
        'defensive_events',
        'baserunning_events',
        'pitches',
        'tracked_opponents',
        'profiles'
      ])
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end
$drop$;

-- ---------------------------------------------------------------------------
-- Ensure RLS is on
-- ---------------------------------------------------------------------------

alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.plate_appearances enable row level security;
alter table public.pitch_events enable row level security;
alter table public.game_lineups enable row level security;
alter table public.saved_lineups enable row level security;
alter table public.saved_lineup_slots enable row level security;
alter table public.player_ratings enable row level security;
alter table public.defensive_events enable row level security;
alter table public.baserunning_events enable row level security;
alter table public.pitches enable row level security;
alter table public.tracked_opponents enable row level security;
alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- profiles — users read their own row (role resolution in middleware / app)
-- ---------------------------------------------------------------------------

create policy "ba_profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Macro: analyst/admin stats tables (coach read-only)
-- ---------------------------------------------------------------------------

create policy "ba_staff_select"
  on public.players
  for select
  to authenticated
  using (public.ba_is_staff());

create policy "ba_stats_write_insert"
  on public.players
  for insert
  to authenticated
  with check (public.ba_can_write_stats());

create policy "ba_stats_write_update"
  on public.players
  for update
  to authenticated
  using (public.ba_can_write_stats())
  with check (public.ba_can_write_stats());

create policy "ba_stats_write_delete"
  on public.players
  for delete
  to authenticated
  using (public.ba_can_write_stats());

-- plate_appearances
create policy "ba_staff_select"
  on public.plate_appearances
  for select
  to authenticated
  using (public.ba_is_staff());

create policy "ba_stats_write_insert"
  on public.plate_appearances
  for insert
  to authenticated
  with check (public.ba_can_write_stats());

create policy "ba_stats_write_update"
  on public.plate_appearances
  for update
  to authenticated
  using (public.ba_can_write_stats())
  with check (public.ba_can_write_stats());

create policy "ba_stats_write_delete"
  on public.plate_appearances
  for delete
  to authenticated
  using (public.ba_can_write_stats());

-- pitch_events
create policy "ba_staff_select"
  on public.pitch_events
  for select
  to authenticated
  using (public.ba_is_staff());

create policy "ba_stats_write_insert"
  on public.pitch_events
  for insert
  to authenticated
  with check (public.ba_can_write_stats());

create policy "ba_stats_write_update"
  on public.pitch_events
  for update
  to authenticated
  using (public.ba_can_write_stats())
  with check (public.ba_can_write_stats());

create policy "ba_stats_write_delete"
  on public.pitch_events
  for delete
  to authenticated
  using (public.ba_can_write_stats());

-- defensive_events
create policy "ba_staff_select"
  on public.defensive_events
  for select
  to authenticated
  using (public.ba_is_staff());

create policy "ba_stats_write_insert"
  on public.defensive_events
  for insert
  to authenticated
  with check (public.ba_can_write_stats());

create policy "ba_stats_write_update"
  on public.defensive_events
  for update
  to authenticated
  using (public.ba_can_write_stats())
  with check (public.ba_can_write_stats());

create policy "ba_stats_write_delete"
  on public.defensive_events
  for delete
  to authenticated
  using (public.ba_can_write_stats());

-- player_ratings
create policy "ba_staff_select"
  on public.player_ratings
  for select
  to authenticated
  using (public.ba_is_staff());

create policy "ba_stats_write_insert"
  on public.player_ratings
  for insert
  to authenticated
  with check (public.ba_can_write_stats());

create policy "ba_stats_write_update"
  on public.player_ratings
  for update
  to authenticated
  using (public.ba_can_write_stats())
  with check (public.ba_can_write_stats());

create policy "ba_stats_write_delete"
  on public.player_ratings
  for delete
  to authenticated
  using (public.ba_can_write_stats());

-- baserunning_events
create policy "ba_staff_select"
  on public.baserunning_events
  for select
  to authenticated
  using (public.ba_is_staff());

create policy "ba_stats_write_insert"
  on public.baserunning_events
  for insert
  to authenticated
  with check (public.ba_can_write_stats());

create policy "ba_stats_write_update"
  on public.baserunning_events
  for update
  to authenticated
  using (public.ba_can_write_stats())
  with check (public.ba_can_write_stats());

create policy "ba_stats_write_delete"
  on public.baserunning_events
  for delete
  to authenticated
  using (public.ba_can_write_stats());

-- tracked_opponents
create policy "ba_staff_select"
  on public.tracked_opponents
  for select
  to authenticated
  using (public.ba_is_staff());

create policy "ba_stats_write_insert"
  on public.tracked_opponents
  for insert
  to authenticated
  with check (public.ba_can_write_stats());

create policy "ba_stats_write_update"
  on public.tracked_opponents
  for update
  to authenticated
  using (public.ba_can_write_stats())
  with check (public.ba_can_write_stats());

create policy "ba_stats_write_delete"
  on public.tracked_opponents
  for delete
  to authenticated
  using (public.ba_can_write_stats());

-- ---------------------------------------------------------------------------
-- games — staff read; analyst/admin create/delete; all staff may update
-- (coach sets pitch_tracker_group_id on pitch pad; analyst updates tracker sync)
-- ---------------------------------------------------------------------------

create policy "ba_staff_select"
  on public.games
  for select
  to authenticated
  using (public.ba_is_staff());

create policy "ba_stats_write_insert"
  on public.games
  for insert
  to authenticated
  with check (public.ba_can_write_stats());

create policy "ba_staff_update"
  on public.games
  for update
  to authenticated
  using (public.ba_is_staff())
  with check (public.ba_is_staff());

create policy "ba_stats_write_delete"
  on public.games
  for delete
  to authenticated
  using (public.ba_can_write_stats());

-- ---------------------------------------------------------------------------
-- game_lineups + saved templates — coach may edit (lineup page)
-- ---------------------------------------------------------------------------

create policy "ba_staff_select"
  on public.game_lineups
  for select
  to authenticated
  using (public.ba_is_staff());

create policy "ba_staff_write_insert"
  on public.game_lineups
  for insert
  to authenticated
  with check (public.ba_is_staff());

create policy "ba_staff_write_update"
  on public.game_lineups
  for update
  to authenticated
  using (public.ba_is_staff())
  with check (public.ba_is_staff());

create policy "ba_staff_write_delete"
  on public.game_lineups
  for delete
  to authenticated
  using (public.ba_is_staff());

create policy "ba_staff_select"
  on public.saved_lineups
  for select
  to authenticated
  using (public.ba_is_staff());

create policy "ba_staff_write_insert"
  on public.saved_lineups
  for insert
  to authenticated
  with check (public.ba_is_staff());

create policy "ba_staff_write_update"
  on public.saved_lineups
  for update
  to authenticated
  using (public.ba_is_staff())
  with check (public.ba_is_staff());

create policy "ba_staff_write_delete"
  on public.saved_lineups
  for delete
  to authenticated
  using (public.ba_is_staff());

create policy "ba_staff_select"
  on public.saved_lineup_slots
  for select
  to authenticated
  using (public.ba_is_staff());

create policy "ba_staff_write_insert"
  on public.saved_lineup_slots
  for insert
  to authenticated
  with check (public.ba_is_staff());

create policy "ba_staff_write_update"
  on public.saved_lineup_slots
  for update
  to authenticated
  using (public.ba_is_staff())
  with check (public.ba_is_staff());

create policy "ba_staff_write_delete"
  on public.saved_lineup_slots
  for delete
  to authenticated
  using (public.ba_is_staff());

-- ---------------------------------------------------------------------------
-- pitches — coach + analyst + admin (pitch pad)
-- ---------------------------------------------------------------------------

create policy "ba_staff_select"
  on public.pitches
  for select
  to authenticated
  using (public.ba_is_staff());

create policy "ba_pitch_tracker_write_insert"
  on public.pitches
  for insert
  to authenticated
  with check (public.ba_can_write_pitch_tracker());

create policy "ba_pitch_tracker_write_update"
  on public.pitches
  for update
  to authenticated
  using (public.ba_can_write_pitch_tracker())
  with check (public.ba_can_write_pitch_tracker());

create policy "ba_pitch_tracker_write_delete"
  on public.pitches
  for delete
  to authenticated
  using (public.ba_can_write_pitch_tracker());
