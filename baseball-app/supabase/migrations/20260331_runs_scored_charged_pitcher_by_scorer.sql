-- Per-scorer pitcher credited for R/ER (inherited runners: charge prior pitcher on reliever’s PA).
-- Keys/scorers and values are player UUIDs (string form in JSON).
alter table public.plate_appearances
  add column if not exists runs_scored_charged_pitcher_by_scorer jsonb not null default '{}'::jsonb;
