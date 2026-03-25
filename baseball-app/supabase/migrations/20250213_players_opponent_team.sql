-- Tag players who belong to an opponent organization (for roster/scouting).
alter table public.players
  add column if not exists opponent_team text;

comment on column public.players.opponent_team is 'When set, this player is tracked as part of that opponent team (not our club).';
