-- Portfolio demo seed — fictional Metro City Miners season sample.
-- Run in a dedicated demo Supabase project AFTER schema.sql.
-- Safe to re-run: wipes app data (not auth profiles) then inserts fresh sample data.
--
-- Usage: Supabase SQL Editor → paste → Run
-- Then deploy with NEXT_PUBLIC_DEMO_MODE=true and NEXT_PUBLIC_CLUB_TEAM_NAME=Metro City Miners

BEGIN;

TRUNCATE TABLE
  public.pitch_events,
  public.pitches,
  public.baserunning_events,
  public.defensive_events,
  public.game_lineups,
  public.plate_appearances,
  public.games,
  public.saved_lineup_slots,
  public.saved_lineups,
  public.player_ratings,
  public.players,
  public.tracked_opponents
RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------------
-- Tracked opponents
-- ---------------------------------------------------------------------------
INSERT INTO public.tracked_opponents (id, name) VALUES
  ('e0010001-0001-4000-8000-000000000001', 'Riverside Rockets'),
  ('e0010001-0002-4000-8000-000000000002', 'Harbor Hawks'),
  ('e0010001-0003-4000-8000-000000000003', 'Valley Vipers');

-- ---------------------------------------------------------------------------
-- Club roster — Metro City Miners
-- ---------------------------------------------------------------------------
INSERT INTO public.players (id, name, jersey, positions, bats, throws, primary_position, hometown) VALUES
  ('e0010101-0001-4000-8000-000000000001', 'Marcus Cole', '18', ARRAY['P'], 'R', 'R', 'P', 'Metro City'),
  ('e0010101-0002-4000-8000-000000000002', 'Jake Morrison', '27', ARRAY['P'], 'L', 'L', 'P', 'Port Harbor'),
  ('e0010101-0003-4000-8000-000000000003', 'Tyler Barnes', '33', ARRAY['P'], 'R', 'R', 'P', 'Riverside'),
  ('e0010101-0004-4000-8000-000000000004', 'Ryan Okafor', '41', ARRAY['P'], 'R', 'R', 'P', 'Metro City'),
  ('e0010101-0005-4000-8000-000000000005', 'James Rivera', '8', ARRAY['C'], 'R', 'R', 'C', 'Metro City'),
  ('e0010101-0006-4000-8000-000000000006', 'David Kim', '3', ARRAY['SS'], 'R', 'R', 'SS', 'Metro City'),
  ('e0010101-0007-4000-8000-000000000007', 'Carlos Mendez', '4', ARRAY['2B'], 'S', 'R', '2B', 'San Mateo'),
  ('e0010101-0008-4000-8000-000000000008', 'Andre Walker', '25', ARRAY['1B'], 'L', 'L', '1B', 'Oak Ridge'),
  ('e0010101-0009-4000-8000-000000000009', 'Miguel Santos', '15', ARRAY['3B'], 'R', 'R', '3B', 'Metro City'),
  ('e0010101-000a-4000-8000-00000000000a', 'Ethan Brooks', '11', ARRAY['LF'], 'L', 'L', 'LF', 'North Valley'),
  ('e0010101-000b-4000-8000-00000000000b', 'Jordan Price', '7', ARRAY['CF'], 'R', 'R', 'CF', 'Metro City'),
  ('e0010101-000c-4000-8000-00000000000c', 'Luis Vega', '22', ARRAY['RF'], 'R', 'R', 'RF', 'Bayview'),
  ('e0010101-000d-4000-8000-00000000000d', 'Noah Freeman', '9', ARRAY['DH'], 'L', 'R', 'DH', 'Metro City'),
  ('e0010101-000e-4000-8000-00000000000e', 'Chris Allen', '16', ARRAY['2B','3B'], 'R', 'R', 'UT', 'Metro City');

-- Riverside Rockets (opponent)
INSERT INTO public.players (id, name, jersey, positions, bats, throws, primary_position, opponent_team) VALUES
  ('e0010201-0001-4000-8000-000000000001', 'Tom Bradley', '12', ARRAY['P'], 'R', 'R', 'P', 'Riverside Rockets'),
  ('e0010201-0002-4000-8000-000000000002', 'Sam Ortiz', '34', ARRAY['P'], 'L', 'L', 'P', 'Riverside Rockets'),
  ('e0010201-0003-4000-8000-000000000003', 'Nick Foster', '5', ARRAY['C'], 'R', 'R', 'C', 'Riverside Rockets'),
  ('e0010201-0004-4000-8000-000000000004', 'Alex Chen', '2', ARRAY['SS'], 'R', 'R', 'SS', 'Riverside Rockets'),
  ('e0010201-0005-4000-8000-000000000005', 'Ben Torres', '7', ARRAY['2B'], 'R', 'R', '2B', 'Riverside Rockets'),
  ('e0010201-0006-4000-8000-000000000006', 'Matt Greene', '21', ARRAY['1B'], 'L', 'R', '1B', 'Riverside Rockets'),
  ('e0010201-0007-4000-8000-000000000007', 'Chris Hall', '10', ARRAY['3B'], 'R', 'R', '3B', 'Riverside Rockets'),
  ('e0010201-0008-4000-8000-000000000008', 'Drew Walsh', '14', ARRAY['LF'], 'L', 'L', 'LF', 'Riverside Rockets'),
  ('e0010201-0009-4000-8000-000000000009', 'Eric Jones', '8', ARRAY['CF'], 'R', 'R', 'CF', 'Riverside Rockets');

-- Harbor Hawks (opponent)
INSERT INTO public.players (id, name, jersey, positions, bats, throws, primary_position, opponent_team) VALUES
  ('e0010301-0001-4000-8000-000000000001', 'Luke Harris', '19', ARRAY['P'], 'R', 'R', 'P', 'Harbor Hawks'),
  ('e0010301-0002-4000-8000-000000000002', 'Mike Sullivan', '31', ARRAY['P'], 'R', 'R', 'P', 'Harbor Hawks'),
  ('e0010301-0003-4000-8000-000000000003', 'Joe Palmer', '6', ARRAY['C'], 'R', 'R', 'C', 'Harbor Hawks'),
  ('e0010301-0004-4000-8000-000000000004', 'Ryan Cooper', '1', ARRAY['SS'], 'R', 'R', 'SS', 'Harbor Hawks'),
  ('e0010301-0005-4000-8000-000000000005', 'Tyler Dunn', '4', ARRAY['2B'], 'S', 'R', '2B', 'Harbor Hawks'),
  ('e0010301-0006-4000-8000-000000000006', 'Josh Miller', '24', ARRAY['1B'], 'L', 'L', '1B', 'Harbor Hawks'),
  ('e0010301-0007-4000-8000-000000000007', 'Pat Reed', '13', ARRAY['3B'], 'R', 'R', '3B', 'Harbor Hawks'),
  ('e0010301-0008-4000-8000-000000000008', 'Sean Blake', '9', ARRAY['LF'], 'L', 'R', 'LF', 'Harbor Hawks'),
  ('e0010301-0009-4000-8000-000000000009', 'Greg Nash', '17', ARRAY['CF'], 'R', 'R', 'CF', 'Harbor Hawks');

-- ---------------------------------------------------------------------------
-- Games (9 finalized + 1 in progress for Record demo)
-- ---------------------------------------------------------------------------
INSERT INTO public.games (
  id, date, home_team, away_team, our_side,
  final_score_home, final_score_away,
  starting_pitcher_home_id, starting_pitcher_away_id,
  winning_pitcher_id, losing_pitcher_id
) VALUES
  ('e00100a1-0001-4000-8000-000000000001', '2025-03-08', 'Metro City Miners', 'Riverside Rockets', 'home', 6, 4,
    'e0010101-0001-4000-8000-000000000001', 'e0010201-0001-4000-8000-000000000001',
    'e0010101-0001-4000-8000-000000000001', 'e0010201-0001-4000-8000-000000000001'),
  ('e00100a1-0002-4000-8000-000000000002', '2025-03-15', 'Harbor Hawks', 'Metro City Miners', 'away', 3, 7,
    'e0010301-0001-4000-8000-000000000001', 'e0010101-0002-4000-8000-000000000002',
    'e0010101-0002-4000-8000-000000000002', 'e0010301-0001-4000-8000-000000000001'),
  ('e00100a1-0003-4000-8000-000000000003', '2025-03-22', 'Metro City Miners', 'Valley Vipers', 'home', 5, 2,
    'e0010101-0003-4000-8000-000000000003', 'e0010201-0002-4000-8000-000000000002',
    'e0010101-0003-4000-8000-000000000003', 'e0010201-0002-4000-8000-000000000002'),
  ('e00100a1-0004-4000-8000-000000000004', '2025-03-29', 'Riverside Rockets', 'Metro City Miners', 'away', 8, 5,
    'e0010201-0001-4000-8000-000000000001', 'e0010101-0001-4000-8000-000000000001',
    'e0010201-0001-4000-8000-000000000001', 'e0010101-0001-4000-8000-000000000001'),
  ('e00100a1-0005-4000-8000-000000000005', '2025-04-05', 'Metro City Miners', 'Harbor Hawks', 'home', 4, 3,
    'e0010101-0002-4000-8000-000000000002', 'e0010301-0001-4000-8000-000000000001',
    'e0010101-0002-4000-8000-000000000002', 'e0010301-0001-4000-8000-000000000001'),
  ('e00100a1-0006-4000-8000-000000000006', '2025-04-08', 'Valley Vipers', 'Metro City Miners', 'away', 1, 9,
    'e0010201-0002-4000-8000-000000000002', 'e0010101-0003-4000-8000-000000000003',
    'e0010101-0003-4000-8000-000000000003', 'e0010201-0002-4000-8000-000000000002'),
  ('e00100a1-0007-4000-8000-000000000007', '2025-04-10', 'Metro City Miners', 'Riverside Rockets', 'home', 7, 6,
    'e0010101-0001-4000-8000-000000000001', 'e0010201-0001-4000-8000-000000000001',
    'e0010101-0004-4000-8000-000000000004', 'e0010201-0002-4000-8000-000000000002'),
  ('e00100a1-0008-4000-8000-000000000008', '2025-04-12', 'Harbor Hawks', 'Metro City Miners', 'away', 2, 3,
    'e0010301-0002-4000-8000-000000000002', 'e0010101-0002-4000-8000-000000000002',
    'e0010101-0002-4000-8000-000000000002', 'e0010301-0002-4000-8000-000000000002'),
  ('e00100a1-0009-4000-8000-000000000009', '2025-04-14', 'Metro City Miners', 'Harbor Hawks', 'home', 11, 4,
    'e0010101-0003-4000-8000-000000000003', 'e0010301-0001-4000-8000-000000000001',
    'e0010101-0003-4000-8000-000000000003', 'e0010301-0001-4000-8000-000000000001'),
  -- In-progress game (no final score) — linked from portfolio tour
  ('e00100a1-000a-4000-8000-00000000000a', '2025-04-15', 'Metro City Miners', 'Harbor Hawks', 'home', NULL, NULL,
    'e0010101-0001-4000-8000-000000000001', 'e0010301-0002-4000-8000-000000000002',
    NULL, NULL);

-- ---------------------------------------------------------------------------
-- Default lineups (club batting order 1–9)
-- ---------------------------------------------------------------------------
INSERT INTO public.game_lineups (game_id, side, slot, player_id, position)
SELECT g.id, g.our_side, s.slot, s.player_id, s.pos
FROM public.games g
CROSS JOIN (
  VALUES
    (1, 'e0010101-0006-4000-8000-000000000006'::uuid, 'SS'),
    (2, 'e0010101-0007-4000-8000-000000000007'::uuid, '2B'),
    (3, 'e0010101-0008-4000-8000-000000000008'::uuid, '1B'),
    (4, 'e0010101-000a-4000-8000-00000000000a'::uuid, 'LF'),
    (5, 'e0010101-000b-4000-8000-00000000000b'::uuid, 'CF'),
    (6, 'e0010101-000c-4000-8000-00000000000c'::uuid, 'RF'),
    (7, 'e0010101-000d-4000-8000-00000000000d'::uuid, 'DH'),
    (8, 'e0010101-0005-4000-8000-000000000005'::uuid, 'C'),
    (9, 'e0010101-000e-4000-8000-00000000000e'::uuid, 'UT')
) AS s(slot, player_id, pos);

-- Opponent lineups per game (away when we're home, home when we're away)
INSERT INTO public.game_lineups (game_id, side, slot, player_id, position)
SELECT g.id,
  CASE WHEN g.our_side = 'home' THEN 'away'::text ELSE 'home'::text END,
  s.slot, s.player_id, s.pos
FROM public.games g
CROSS JOIN (
  VALUES
    (1, 'e0010201-0004-4000-8000-000000000004'::uuid, 'SS'),
    (2, 'e0010201-0005-4000-8000-000000000005'::uuid, '2B'),
    (3, 'e0010201-0006-4000-8000-000000000006'::uuid, '1B'),
    (4, 'e0010201-0008-4000-8000-000000000008'::uuid, 'LF'),
    (5, 'e0010201-0009-4000-8000-000000000009'::uuid, 'CF'),
    (6, 'e0010201-0007-4000-8000-000000000007'::uuid, '3B'),
    (7, 'e0010201-0003-4000-8000-000000000003'::uuid, 'C'),
    (8, 'e0010201-0001-4000-8000-000000000001'::uuid, 'P'),
    (9, 'e0010201-0002-4000-8000-000000000002'::uuid, 'P')
) AS s(slot, player_id, pos)
WHERE g.away_team IN ('Riverside Rockets', 'Valley Vipers')
   OR g.home_team IN ('Riverside Rockets', 'Valley Vipers');

INSERT INTO public.game_lineups (game_id, side, slot, player_id, position)
SELECT g.id,
  CASE WHEN g.our_side = 'home' THEN 'away'::text ELSE 'home'::text END,
  s.slot, s.player_id, s.pos
FROM public.games g
CROSS JOIN (
  VALUES
    (1, 'e0010301-0004-4000-8000-000000000004'::uuid, 'SS'),
    (2, 'e0010301-0005-4000-8000-000000000005'::uuid, '2B'),
    (3, 'e0010301-0006-4000-8000-000000000006'::uuid, '1B'),
    (4, 'e0010301-0008-4000-8000-000000000008'::uuid, 'LF'),
    (5, 'e0010301-0009-4000-8000-000000000009'::uuid, 'CF'),
    (6, 'e0010301-0007-4000-8000-000000000007'::uuid, '3B'),
    (7, 'e0010301-0003-4000-8000-000000000003'::uuid, 'C'),
    (8, 'e0010301-0001-4000-8000-000000000001'::uuid, 'P'),
    (9, 'e0010301-0002-4000-8000-000000000002'::uuid, 'P')
) AS s(slot, player_id, pos)
WHERE g.away_team = 'Harbor Hawks' OR g.home_team = 'Harbor Hawks';

-- ---------------------------------------------------------------------------
-- Plate appearances — club hitters vs opponent SP, 6 PAs per batter per finalized game
-- ---------------------------------------------------------------------------
INSERT INTO public.plate_appearances (
  game_id, batter_id, pitcher_id, inning, inning_half, outs, base_state, score_diff,
  count_balls, count_strikes, result, contact_quality, chase, pitches_seen,
  hit_direction, batted_ball_type, rbi
)
SELECT
  g.id,
  b.id,
  CASE
    WHEN g.away_team = 'Harbor Hawks' OR g.home_team = 'Harbor Hawks' THEN 'e0010301-0001-4000-8000-000000000001'::uuid
    ELSE 'e0010201-0001-4000-8000-000000000001'::uuid
  END,
  1 + floor(random() * 8)::int,
  CASE WHEN g.our_side = 'home' THEN 'bottom' ELSE 'top' END,
  floor(random() * 3)::int,
  (ARRAY['000','100','010','001','110','101','011','111'])[1 + floor(random() * 8)::int],
  floor(random() * 5)::int - 2,
  floor(random() * 4)::int,
  floor(random() * 3)::int,
  res.result,
  cq.quality,
  random() < 0.28,
  3 + floor(random() * 5)::int,
  hd.dir,
  bb.type,
  CASE res.result WHEN 'hr' THEN 1 + floor(random() * 3)::int WHEN 'single' THEN CASE WHEN random() < 0.25 THEN 1 ELSE 0 END ELSE 0 END
FROM public.games g
CROSS JOIN public.players b
CROSS JOIN generate_series(1, 6) AS n
CROSS JOIN LATERAL (
  SELECT (ARRAY['single','double','triple','hr','out','out','out','bb','hbp','so','so','other'])[1 + floor(random() * 12)::int] AS result
) res
CROSS JOIN LATERAL (
  SELECT (ARRAY['soft','medium','hard'])[1 + floor(random() * 3)::int] AS quality
) cq
CROSS JOIN LATERAL (
  SELECT (ARRAY['pulled','up_the_middle','opposite_field'])[1 + floor(random() * 3)::int] AS dir
) hd
CROSS JOIN LATERAL (
  SELECT (ARRAY['ground_ball','line_drive','fly_ball'])[1 + floor(random() * 3)::int] AS type
) bb
WHERE g.final_score_home IS NOT NULL
  AND b.id IN (
    'e0010101-0005-4000-8000-000000000005',
    'e0010101-0006-4000-8000-000000000006',
    'e0010101-0007-4000-8000-000000000007',
    'e0010101-0008-4000-8000-000000000008',
    'e0010101-0009-4000-8000-000000000009',
    'e0010101-000a-4000-8000-00000000000a',
    'e0010101-000b-4000-8000-00000000000b',
    'e0010101-000c-4000-8000-00000000000c',
    'e0010101-000d-4000-8000-00000000000d',
    'e0010101-000e-4000-8000-00000000000e'
  );

-- In-progress game PAs (partial game — inning 5)
INSERT INTO public.plate_appearances (
  game_id, batter_id, pitcher_id, inning, inning_half, outs, base_state, score_diff,
  count_balls, count_strikes, result, contact_quality, pitches_seen, rbi
) VALUES
  ('e00100a1-000a-4000-8000-00000000000a', 'e0010101-0006-4000-8000-000000000006', 'e0010301-0002-4000-8000-000000000002', 1, 'bottom', 0, '000', 0, 2, 1, 'single', 'medium', 4, 0),
  ('e00100a1-000a-4000-8000-00000000000a', 'e0010101-0007-4000-8000-000000000007', 'e0010301-0002-4000-8000-000000000002', 1, 'bottom', 0, '100', 0, 1, 2, 'out', 'soft', 5, 0),
  ('e00100a1-000a-4000-8000-00000000000a', 'e0010101-0008-4000-8000-000000000008', 'e0010301-0002-4000-8000-000000000002', 1, 'bottom', 1, '100', 0, 3, 2, 'bb', NULL, 6, 0),
  ('e00100a1-000a-4000-8000-00000000000a', 'e0010101-000a-4000-8000-00000000000a', 'e0010301-0002-4000-8000-000000000002', 1, 'bottom', 1, '110', 0, 0, 1, 'double', 'hard', 3, 1),
  ('e00100a1-000a-4000-8000-00000000000a', 'e0010101-000b-4000-8000-00000000000b', 'e0010301-0002-4000-8000-000000000002', 1, 'bottom', 1, '110', 1, 1, 1, 'single', 'medium', 4, 1),
  ('e00100a1-000a-4000-8000-00000000000a', 'e0010101-000c-4000-8000-00000000000c', 'e0010301-0002-4000-8000-000000000002', 1, 'bottom', 1, '111', 2, 2, 2, 'so', NULL, 5, 0),
  ('e00100a1-000a-4000-8000-00000000000a', 'e0010101-000d-4000-8000-00000000000d', 'e0010301-0002-4000-8000-000000000002', 2, 'bottom', 0, '000', 2, 0, 0, 'hr', 'hard', 2, 1),
  ('e00100a1-000a-4000-8000-00000000000a', 'e0010101-0005-4000-8000-000000000005', 'e0010301-0002-4000-8000-000000000002', 2, 'bottom', 0, '000', 3, 1, 2, 'out', 'soft', 4, 0),
  ('e00100a1-000a-4000-8000-00000000000a', 'e0010101-000e-4000-8000-00000000000e', 'e0010301-0002-4000-8000-000000000002', 2, 'bottom', 1, '000', 3, 2, 1, 'single', 'medium', 5, 0),
  ('e00100a1-000a-4000-8000-00000000000a', 'e0010101-0006-4000-8000-000000000006', 'e0010301-0002-4000-8000-000000000002', 2, 'bottom', 1, '100', 3, 3, 2, 'bb', NULL, 7, 0),
  ('e00100a1-000a-4000-8000-00000000000a', 'e0010101-0007-4000-8000-000000000007', 'e0010301-0002-4000-8000-000000000002', 2, 'bottom', 1, '110', 3, 1, 0, 'out', 'medium', 3, 0),
  ('e00100a1-000a-4000-8000-00000000000a', 'e0010101-0008-4000-8000-000000000008', 'e0010301-0002-4000-8000-000000000002', 3, 'bottom', 0, '010', 3, 0, 1, 'out', 'soft', 4, 0),
  ('e00100a1-000a-4000-8000-00000000000a', 'e0010101-000a-4000-8000-00000000000a', 'e0010301-0001-4000-8000-000000000001', 4, 'bottom', 1, '000', 3, 2, 2, 'so', NULL, 6, 0),
  ('e00100a1-000a-4000-8000-00000000000a', 'e0010101-000b-4000-8000-00000000000b', 'e0010301-0001-4000-8000-000000000001', 4, 'bottom', 2, '000', 3, 1, 1, 'triple', 'hard', 4, 0),
  ('e00100a1-000a-4000-8000-00000000000a', 'e0010101-000c-4000-8000-00000000000c', 'e0010301-0001-4000-8000-000000000001', 5, 'bottom', 0, '000', 3, 1, 0, 'single', 'hard', 3, 0);

-- Pitch events for a sample of recent PAs (charts / pitch mix)
INSERT INTO public.pitch_events (pa_id, pitch_index, balls_before, strikes_before, outcome, pitch_type)
SELECT pa.id, pi.idx, pi.balls, pi.strikes, pi.outcome, pi.ptype
FROM public.plate_appearances pa
CROSS JOIN LATERAL (
  VALUES
    (1, 0, 0, 'called_strike', 'fastball'),
    (2, 0, 1, 'ball', 'slider'),
    (3, 1, 1, 'foul', 'fastball'),
    (4, 1, 2, 'in_play', 'changeup')
) AS pi(idx, balls, strikes, outcome, ptype)
WHERE pa.game_id IN ('e00100a1-0008-4000-8000-000000000008', 'e00100a1-0009-4000-8000-000000000009')
  AND pa.pitches_seen >= 4
  AND random() < 0.35;

-- Baserunning sample
INSERT INTO public.baserunning_events (game_id, inning, inning_half, outs, runner_id, event_type, from_base)
SELECT g.id, 3 + floor(random() * 4)::int,
  CASE WHEN g.our_side = 'home' THEN 'bottom' ELSE 'top' END,
  1,
  (ARRAY[
    'e0010101-0006-4000-8000-000000000006'::uuid,
    'e0010101-0007-4000-8000-000000000007'::uuid,
    'e0010101-000b-4000-8000-00000000000b'::uuid
  ])[1 + floor(random() * 3)::int],
  CASE WHEN random() < 0.72 THEN 'sb' ELSE 'cs' END,
  1
FROM public.games g
WHERE g.final_score_home IS NOT NULL
LIMIT 12;

-- Analyst rating overrides (sample)
INSERT INTO public.player_ratings (player_id, contact_reliability, damage_potential, decision_quality, defense_trust, overridden_at, overridden_by)
VALUES
  ('e0010101-0008-4000-8000-000000000008', 5, 5, 4, 4, now(), 'demo'),
  ('e0010101-0006-4000-8000-000000000006', 4, 3, 5, 5, now(), 'demo'),
  ('e0010101-000a-4000-8000-00000000000a', 4, 4, 3, 3, now(), 'demo'),
  ('e0010101-000b-4000-8000-00000000000b', 3, 4, 4, 4, now(), 'demo');

-- Saved lineup template
INSERT INTO public.saved_lineups (id, name) VALUES
  ('e0010401-0001-4000-8000-000000000001', 'Opening Day');

INSERT INTO public.saved_lineup_slots (lineup_id, slot, player_id, position)
VALUES
  ('e0010401-0001-4000-8000-000000000001', 1, 'e0010101-0006-4000-8000-000000000006', 'SS'),
  ('e0010401-0001-4000-8000-000000000001', 2, 'e0010101-0007-4000-8000-000000000007', '2B'),
  ('e0010401-0001-4000-8000-000000000001', 3, 'e0010101-0008-4000-8000-000000000008', '1B'),
  ('e0010401-0001-4000-8000-000000000001', 4, 'e0010101-000a-4000-8000-00000000000a', 'LF'),
  ('e0010401-0001-4000-8000-000000000001', 5, 'e0010101-000b-4000-8000-00000000000b', 'CF'),
  ('e0010401-0001-4000-8000-000000000001', 6, 'e0010101-000c-4000-8000-00000000000c', 'RF'),
  ('e0010401-0001-4000-8000-000000000001', 7, 'e0010101-000d-4000-8000-00000000000d', 'DH'),
  ('e0010401-0001-4000-8000-000000000001', 8, 'e0010101-0005-4000-8000-000000000005', 'C'),
  ('e0010401-0001-4000-8000-000000000001', 9, 'e0010101-000e-4000-8000-00000000000e', 'UT');

COMMIT;
