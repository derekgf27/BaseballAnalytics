-- Shared pitch-tracker session id for a game (coach iPad + analyst Record stay in sync without pasting groupId).

alter table public.games add column if not exists pitch_tracker_group_id uuid;

comment on column public.games.pitch_tracker_group_id is 'Active pitch-tracker session UUID; coach pad and analyst Record subscribe to the same `pitches.tracker_group_id`.';
