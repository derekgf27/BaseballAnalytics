-- Run this in Supabase SQL Editor if saved_lineups / saved_lineup_slots are missing.
-- Fixes: "Could not find the table 'public.saved_lineups' in the schema cache"

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

alter table public.saved_lineups enable row level security;
alter table public.saved_lineup_slots enable row level security;

create policy "Allow all for internal tool" on public.saved_lineups for all using (true) with check (true);
create policy "Allow all for internal tool" on public.saved_lineup_slots for all using (true) with check (true);
