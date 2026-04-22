-- Batting-order slot (1–9) for current PA batter — synced from Record lineup; coach pad displays it.
alter table public.games add column if not exists pitch_tracker_batter_slot smallint;

comment on column public.games.pitch_tracker_batter_slot is 'Lineup slot 1–9 for pitch_tracker_batter_id; synced from Analyst Record batting order.';
