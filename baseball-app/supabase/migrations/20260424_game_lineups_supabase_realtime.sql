-- Coach pitch pad reloads opponent lineup on slot changes; ensure realtime receives row changes.
do $migration$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_lineups'
  ) then
    alter publication supabase_realtime add table public.game_lineups;
  end if;
end $migration$;
