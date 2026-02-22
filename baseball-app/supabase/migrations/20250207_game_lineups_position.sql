-- Position for each player in the game lineup (e.g. "LF", "3B") for this game only.
alter table public.game_lineups
  add column if not exists position text;
