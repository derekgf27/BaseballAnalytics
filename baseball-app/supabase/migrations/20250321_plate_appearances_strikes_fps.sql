-- Strikes thrown (for strike%) and first-pitch strike (for FPS%) per plate appearance.
alter table public.plate_appearances
  add column if not exists strikes_thrown int
    check (strikes_thrown is null or (strikes_thrown >= 0));

alter table public.plate_appearances
  add column if not exists first_pitch_strike boolean;

comment on column public.plate_appearances.strikes_thrown is
  'Total pitches that count as strikes (incl. fouls); used with pitches_seen for strike%.';
comment on column public.plate_appearances.first_pitch_strike is
  'Whether the first pitch of the PA was a strike (incl. foul); for FPS%.';
