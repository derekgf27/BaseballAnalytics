-- Primary position, roster status, and staff notes on players
alter table public.players
  add column if not exists primary_position text,
  add column if not exists roster_status text not null default 'active'
    check (roster_status in ('active', 'injured', 'inactive', 'redshirt', 'other')),
  add column if not exists staff_notes text;

update public.players
set roster_status = 'injured'
where is_active = false and roster_status = 'active';
