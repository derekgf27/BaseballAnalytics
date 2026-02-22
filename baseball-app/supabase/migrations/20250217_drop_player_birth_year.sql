-- Remove birth_year; age is computed from birth_date only
alter table public.players
  drop column if exists birth_year;
