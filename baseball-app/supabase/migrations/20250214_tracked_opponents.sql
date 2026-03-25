-- Standalone opponent names (no game required) for Analyst → Opponents list.
create table if not exists public.tracked_opponents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now() not null
);

-- One row per normalized name (case-insensitive, trimmed).
create unique index if not exists tracked_opponents_name_normalized_idx
  on public.tracked_opponents (lower(trim(name)));

alter table public.tracked_opponents enable row level security;

-- Match other MVP tables (games, players): allow anon + authenticated with anon key (see schema.sql).
create policy "Allow all for internal tool" on public.tracked_opponents for all using (true) with check (true);
