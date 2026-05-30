-- Track which base the runner stole from (0=1st, 1=2nd, 2=3rd) for SB/CS display.

alter table public.baserunning_events
  add column if not exists from_base smallint
  check (from_base is null or (from_base >= 0 and from_base <= 2));

comment on column public.baserunning_events.from_base is
  'Base occupied at attempt: 0=1st (stole 2nd), 1=2nd (stole 3rd), 2=3rd (stole home).';
