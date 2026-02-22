-- Add hometown and birth_year to players (run if table already exists)
alter table public.players
  add column if not exists hometown text,
  add column if not exists birth_year int check (birth_year is null or (birth_year >= 1980 and birth_year <= 2012));
