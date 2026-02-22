-- Seed games and plate appearances so all existing players get stats.
-- Run in Supabase SQL editor after you have players in public.players.
-- Uses the last 10 games created (so run multiple times to add more games + PAs).

-- 1) Insert 10 games
insert into public.games (date, home_team, away_team, our_side)
values
  ('2025-03-01', 'Ponce', 'Opponent', 'home'),
  ('2025-03-06', 'Ponce', 'Opponent', 'away'),
  ('2025-03-08', 'Ponce', 'Opponent', 'home'),
  ('2025-03-12', 'Ponce', 'Opponent', 'away'),
  ('2025-03-15', 'Ponce', 'Opponent', 'home'),
  ('2025-03-20', 'Ponce', 'Opponent', 'away'),
  ('2025-03-22', 'Ponce', 'Opponent', 'home'),
  ('2025-03-25', 'Ponce', 'Opponent', 'away'),
  ('2025-03-28', 'Ponce', 'Opponent', 'home'),
  ('2025-04-01', 'Ponce', 'Opponent', 'away');

-- 2) Add lineup (first 9 players by name in slots 1–9) for each of the 10 games we just inserted
insert into public.game_lineups (game_id, slot, player_id, position)
select g.id, p.rn, p.id, (array['P','C','1B','2B','3B','SS','LF','CF','RF'])[p.rn]
from (select id, row_number() over (order by name) as rn from public.players) p
cross join (select id from public.games order by created_at desc limit 10) g(id)
where p.rn between 1 and 9;

-- 3) Add plate appearances: 8 PAs per player per game = 80 PAs per player (10 games)
insert into public.plate_appearances (
  game_id,
  batter_id,
  inning,
  outs,
  base_state,
  score_diff,
  count_balls,
  count_strikes,
  result,
  rbi
)
select
  g.id,
  p.id,
  1 + floor(random() * 9)::int,
  floor(random() * 3)::int,
  (array['000','100','010','001','110','101','011','111'])[1 + floor(random() * 8)::int],
  0,
  floor(random() * 4)::int,
  floor(random() * 3)::int,
  res.result,
  case res.result
    when 'hr' then 1 + floor(random() * 4)::int
    when 'single' then case when random() < 0.2 then 1 else 0 end
    when 'double' then case when random() < 0.2 then 1 else 0 end
    else 0
  end
from public.players p
cross join (select id from public.games order by created_at desc limit 10) g(id)
cross join generate_series(1, 8) _
cross join lateral (
  select (array['single','double','triple','hr','out','out','out','bb','hbp','so','so','other'])[1 + floor(random() * 12)::int] as result
) res;
