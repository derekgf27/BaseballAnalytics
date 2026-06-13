-- Coach pitch pad offense mode: coarse opponent-pitch buckets (fastball, off_speed, breaking_ball).
alter table public.pitches drop constraint if exists pitches_pitch_type_check;

alter table public.pitches add constraint pitches_pitch_type_check check (
  pitch_type is null
  or pitch_type in (
    'fastball',
    'sinker',
    'cutter',
    'slider',
    'sweeper',
    'curveball',
    'changeup',
    'splitter',
    'off_speed',
    'breaking_ball'
  )
);

comment on column public.pitches.pitch_type is
  'Coach pitch category: detailed types on defense; fastball / off_speed / breaking_ball when logging opponent mix on offense.';
