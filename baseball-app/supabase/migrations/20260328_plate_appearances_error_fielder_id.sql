-- Fielder charged with error on reached-on-error PAs (Record form).
alter table public.plate_appearances
  add column if not exists error_fielder_id uuid references public.players(id) on delete set null;

create index if not exists idx_pa_error_fielder on public.plate_appearances(error_fielder_id);
