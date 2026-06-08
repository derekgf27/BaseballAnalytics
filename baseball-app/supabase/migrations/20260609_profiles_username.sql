-- Usernames for login (displayed to coaches/analysts; Supabase still stores a synthetic email).

alter table public.profiles add column if not exists username text;

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null;

-- Backfill usernames from legacy email local-parts where possible.
update public.profiles
set username = lower(
  regexp_replace(
    regexp_replace(split_part(coalesce(email, ''), '@', 1), '[^a-zA-Z0-9._]', '_', 'g'),
    '^[._]+|[._]+$',
    '',
    'g'
  )
)
where username is null
  and email is not null
  and split_part(email, '@', 1) <> '';

-- Drop empty or invalid backfills.
update public.profiles
set username = null
where username is not null
  and (length(username) < 3 or username !~ '^[a-z0-9][a-z0-9._]{2,31}$');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
  assigned_username text;
  login_email text;
begin
  assigned_role := coalesce(new.raw_app_meta_data ->> 'role', 'coach');
  if assigned_role not in ('coach', 'analyst', 'admin') then
    assigned_role := 'coach';
  end if;

  assigned_username := lower(trim(coalesce(new.raw_app_meta_data ->> 'username', '')));
  if assigned_username = '' then
    assigned_username := null;
  end if;

  login_email := coalesce(nullif(trim(new.email), ''), '');

  insert into public.profiles (id, email, username, role)
  values (new.id, login_email, assigned_username, assigned_role)
  on conflict (id) do update
    set email = excluded.email,
        username = coalesce(excluded.username, public.profiles.username),
        updated_at = now();

  return new;
end;
$$;
