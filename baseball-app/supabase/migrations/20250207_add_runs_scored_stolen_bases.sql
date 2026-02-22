-- Runs scored: who scored on this PA (batter or baserunners). R = count of times player in this array.
alter table public.plate_appearances
  add column if not exists runs_scored_player_ids uuid[] default '{}';

-- Stolen bases by the batter on this PA (e.g. singled then stole second).
alter table public.plate_appearances
  add column if not exists stolen_bases int default 0 check (stolen_bases is null or (stolen_bases >= 0 and stolen_bases <= 10));
