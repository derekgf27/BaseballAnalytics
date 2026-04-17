-- Outs (0–2) on Record mirrored for coach pitch pad (same pattern as pitch_tracker_batter_id).

alter table public.games add column if not exists pitch_tracker_outs smallint not null default 0;

comment on column public.games.pitch_tracker_outs is 'Synced from Analyst Record outs (0–2); coach pad follows this.';
