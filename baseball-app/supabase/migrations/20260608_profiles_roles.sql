-- Phase 2: user profiles + coach / analyst / admin roles.
-- Run in Supabase SQL Editor (or via migration tooling).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'coach' check (role in ('coach', 'analyst', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- New sign-ups: default coach unless app_metadata.role is set at invite time.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
begin
  assigned_role := coalesce(new.raw_app_meta_data ->> 'role', 'coach');
  if assigned_role not in ('coach', 'analyst', 'admin') then
    assigned_role := 'coach';
  end if;

  insert into public.profiles (id, email, role)
  values (new.id, new.email, assigned_role)
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Backfill existing auth users (safe default: coach — promote analysts in Table Editor).
insert into public.profiles (id, email, role)
select u.id, u.email, coalesce(u.raw_app_meta_data ->> 'role', 'coach')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- Normalize invalid backfilled roles.
update public.profiles
set role = 'coach'
where role not in ('coach', 'analyst', 'admin');
