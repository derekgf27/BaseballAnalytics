-- PA count on Record — coach pitch pad mirrors this (same pattern as pitch_tracker_outs).
alter table public.games add column if not exists pitch_tracker_balls smallint not null default 0;
alter table public.games add column if not exists pitch_tracker_strikes smallint not null default 0;

comment on column public.games.pitch_tracker_balls is 'Synced from Analyst Record PA balls (0–3); coach pad count display.';
comment on column public.games.pitch_tracker_strikes is 'Synced from Analyst Record PA strikes (0–3); coach pad count display.';
