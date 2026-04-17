-- Batter currently being recorded on the PA form (coach pitch pad follows this).

alter table public.games add column if not exists pitch_tracker_batter_id uuid references public.players(id) on delete set null;

comment on column public.games.pitch_tracker_batter_id is 'Synced from Analyst Record batter dropdown; coach pad uses this (no manual batter pick).';
