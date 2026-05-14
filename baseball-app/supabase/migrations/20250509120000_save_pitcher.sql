-- Official save pitcher per game (MLB-style; set when finalizing / editing game).
alter table public.games
  add column if not exists save_pitcher_id uuid references public.players(id) on delete set null;

create index if not exists idx_games_save_pitcher on public.games(save_pitcher_id)
  where save_pitcher_id is not null;
