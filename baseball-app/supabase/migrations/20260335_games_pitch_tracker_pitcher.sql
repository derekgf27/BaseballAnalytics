-- Mound pitcher on Record — coach pitch pad can show game stats (mirrors pitch_tracker_batter_id pattern).

alter table public.games add column if not exists pitch_tracker_pitcher_id uuid references public.players(id) on delete set null;

comment on column public.games.pitch_tracker_pitcher_id is 'Synced from Analyst Record defensive pitcher; coach pad follows this.';
