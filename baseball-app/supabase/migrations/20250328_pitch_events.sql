-- Per-pitch events for plate appearances (count before pitch + outcome). Enables swing/foul rate by count, etc.

create table if not exists public.pitch_events (
  id uuid primary key default gen_random_uuid(),
  pa_id uuid not null references public.plate_appearances(id) on delete cascade,
  pitch_index int not null check (pitch_index >= 1),
  balls_before int not null check (balls_before >= 0 and balls_before <= 3),
  strikes_before int not null check (strikes_before >= 0 and strikes_before <= 2),
  outcome text not null check (outcome in (
    'ball',
    'called_strike',
    'swinging_strike',
    'foul',
    'in_play',
    'hbp'
  )),
  pitch_type text,
  created_at timestamptz default now(),
  unique (pa_id, pitch_index)
);

create index if not exists idx_pitch_events_pa on public.pitch_events(pa_id);

alter table public.pitch_events enable row level security;

create policy "ba_authenticated_all"
  on public.pitch_events
  for all
  to authenticated
  using (true)
  with check (true);
