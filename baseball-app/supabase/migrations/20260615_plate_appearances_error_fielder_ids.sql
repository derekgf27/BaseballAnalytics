-- Multiple fielding errors charged on a single plate appearance (e.g. E6 + E2 on one play).
alter table public.plate_appearances
  add column if not exists error_fielder_ids uuid[] default '{}';

-- Backfill from legacy single-field column.
update public.plate_appearances
set error_fielder_ids = array[error_fielder_id]
where error_fielder_id is not null
  and (error_fielder_ids is null or error_fielder_ids = '{}');

create index if not exists idx_pa_error_fielder_ids on public.plate_appearances using gin (error_fielder_ids);
