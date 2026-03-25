-- Fix RLS: previous policy was TO authenticated only; server inserts with anon key need a permissive policy.
drop policy if exists "ba_tracked_opponents_authenticated_all" on public.tracked_opponents;

drop policy if exists "Allow all for internal tool" on public.tracked_opponents;

create policy "Allow all for internal tool" on public.tracked_opponents for all using (true) with check (true);
