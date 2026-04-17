-- Split generic `strike` into called vs swinging for coach/analyst pitch tracker rows.

alter table public.pitches drop constraint if exists pitches_result_check;

update public.pitches set result = 'swinging_strike' where result = 'strike';

alter table public.pitches add constraint pitches_result_check check (
  result is null or result in ('ball', 'called_strike', 'swinging_strike', 'foul', 'in_play')
);

comment on column public.pitches.result is 'Pitch outcome from analyst (or manual on Record): ball, called_strike, swinging_strike, foul, in_play.';
