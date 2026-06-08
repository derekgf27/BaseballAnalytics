-- Lets sign-in resolve username → auth email without the service role key.
-- Callable by anon (pre-login). Returns only the email for an exact username match.

create or replace function public.get_login_email_for_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  found_email text;
begin
  if p_username is null or length(trim(p_username)) < 3 then
    return null;
  end if;

  select email into found_email
  from public.profiles
  where lower(username) = lower(trim(p_username))
  limit 1;

  return nullif(trim(found_email), '');
end;
$$;

revoke all on function public.get_login_email_for_username(text) from public;
grant execute on function public.get_login_email_for_username(text) to anon, authenticated, service_role;
