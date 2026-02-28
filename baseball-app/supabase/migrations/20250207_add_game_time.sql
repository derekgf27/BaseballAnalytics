-- Optional game time (e.g. 19:05 for 7:05 PM).
alter table public.games add column if not exists game_time time;
