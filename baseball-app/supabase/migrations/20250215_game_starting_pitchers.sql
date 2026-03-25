-- Starting pitchers per game (home / away). Used to default Record PAs pitcher selection.
alter table public.games
  add column if not exists starting_pitcher_home_id uuid references public.players(id) on delete set null,
  add column if not exists starting_pitcher_away_id uuid references public.players(id) on delete set null;
