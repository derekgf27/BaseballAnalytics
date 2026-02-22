-- Add birth_date (full date) to players
alter table public.players
  add column if not exists birth_date date;
