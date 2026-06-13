-- Mound pitcher on Record (opponent when we hit, our arm on defense) — coach pad offense panel.
alter table public.games add column if not exists pitch_tracker_mound_pitcher_id uuid references public.players(id) on delete set null;

comment on column public.games.pitch_tracker_mound_pitcher_id is
  'Pitcher on the mound from Analyst Record PA form; coach pad shows this arm''s stats while we hit.';
