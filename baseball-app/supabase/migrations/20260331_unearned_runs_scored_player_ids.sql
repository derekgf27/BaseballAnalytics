-- Per-scorer unearned runs (subset of runs_scored_player_ids); used for pitcher ER / ERA.
alter table public.plate_appearances
  add column if not exists unearned_runs_scored_player_ids uuid[] default '{}';
