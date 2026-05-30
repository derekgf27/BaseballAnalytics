-- Drop redshirt roster status (remap existing rows first)
update public.players
set roster_status = 'inactive'
where roster_status = 'redshirt';

alter table public.players drop constraint if exists players_roster_status_check;

alter table public.players
  add constraint players_roster_status_check
  check (roster_status in ('active', 'injured', 'inactive', 'other'));
