-- Coach pitch pad: additional pitch categories (sinker, cutter, sweeper, splitter).
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
    'splitter'
  )
);

comment on column public.pitches.pitch_type is
  'Coach pitch category (fastball, sinker, cutter, slider, sweeper, curveball, changeup, splitter); null until logged.';
