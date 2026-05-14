-- Pitcher credited with the win (Rule 9.17); set when finalizing from Record.
alter table public.games
  add column if not exists winning_pitcher_id uuid references public.players(id) on delete set null;

create index if not exists idx_games_winning_pitcher on public.games(winning_pitcher_id)
  where winning_pitcher_id is not null;
