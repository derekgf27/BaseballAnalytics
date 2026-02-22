-- Hit direction: pulled, up the middle, or opposite field (for batted balls).
alter table public.plate_appearances
  add column if not exists hit_direction text
  check (hit_direction is null or hit_direction in ('pulled', 'up_the_middle', 'opposite_field'));
