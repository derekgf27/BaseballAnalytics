-- Allow PA-only pitch rows (outcome from Record before coach picks FB/SL/etc. on iPad).
alter table public.pitches drop constraint if exists pitches_pitch_type_check;
alter table public.pitches alter column pitch_type drop not null;
alter table public.pitches add constraint pitches_pitch_type_check check (
  pitch_type is null or pitch_type in ('fastball', 'slider', 'curveball', 'changeup')
);

comment on column public.pitches.pitch_type is 'Coach pitch category; null until iPad logs type (result may already be set from Record pitch log).';
