-- Pitcher credited on each PA (for pitching stats). Nullable for legacy rows.
alter table public.plate_appearances
  add column if not exists pitcher_id uuid references public.players(id) on delete set null;

create index if not exists idx_pa_pitcher on public.plate_appearances(pitcher_id);
