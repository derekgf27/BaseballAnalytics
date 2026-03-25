-- Run once in Supabase SQL Editor after Auth is enabled.
-- Locks tables to signed-in users (JWT). Tweak policies for multi-tenant data later.

alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.plate_appearances enable row level security;
alter table public.game_lineups enable row level security;
alter table public.saved_lineups enable row level security;
alter table public.saved_lineup_slots enable row level security;
alter table public.player_ratings enable row level security;
alter table public.defensive_events enable row level security;

create policy "ba_authenticated_all" on public.players for all to authenticated using (true) with check (true);
create policy "ba_authenticated_all" on public.games for all to authenticated using (true) with check (true);
create policy "ba_authenticated_all" on public.plate_appearances for all to authenticated using (true) with check (true);
create policy "ba_authenticated_all" on public.game_lineups for all to authenticated using (true) with check (true);
create policy "ba_authenticated_all" on public.saved_lineups for all to authenticated using (true) with check (true);
create policy "ba_authenticated_all" on public.saved_lineup_slots for all to authenticated using (true) with check (true);
create policy "ba_authenticated_all" on public.player_ratings for all to authenticated using (true) with check (true);
create policy "ba_authenticated_all" on public.defensive_events for all to authenticated using (true) with check (true);

-- Policy names must be unique per table; if you re-run, drop policies first or rename.
