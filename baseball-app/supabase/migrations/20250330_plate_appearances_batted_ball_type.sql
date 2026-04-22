-- Batted-ball trajectory (GB / LD / FB / IFF) for balls in play on Record.
alter table public.plate_appearances
  add column if not exists batted_ball_type text
  check (
    batted_ball_type is null
    or batted_ball_type in ('ground_ball', 'line_drive', 'fly_ball', 'infield_fly')
  );

comment on column public.plate_appearances.batted_ball_type is
  'Ground ball, line drive, fly ball, or infield fly (optional tagging for BIP outcomes).';
