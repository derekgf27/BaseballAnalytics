-- App uses NEXT_PUBLIC_SUPABASE_ANON_KEY without a JWT unless user signs in.
-- plate_appearances often allows anon; pitch_events only had `to authenticated`, which blocks inserts.
-- This policy lets anon role insert/select/update/delete like other MVP tables.

create policy "ba_pitch_events_anon_all"
  on public.pitch_events
  for all
  to anon
  using (true)
  with check (true);
