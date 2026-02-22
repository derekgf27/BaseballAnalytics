-- Pitcher handedness (L/R) and inning half (top/bottom) for each PA.
alter table public.plate_appearances
  add column if not exists pitcher_hand text check (pitcher_hand is null or pitcher_hand in ('L', 'R'));

alter table public.plate_appearances
  add column if not exists inning_half text check (inning_half is null or inning_half in ('top', 'bottom'));
