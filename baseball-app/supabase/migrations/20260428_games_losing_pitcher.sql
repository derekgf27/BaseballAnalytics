-- Pitcher credited with the loss (Rule 9.17); set when finalizing from Record.
alter table public.games
  add column if not exists losing_pitcher_id uuid references public.players(id) on delete set null;

create index if not exists idx_games_losing_pitcher on public.games(losing_pitcher_id)
  where losing_pitcher_id is not null;
