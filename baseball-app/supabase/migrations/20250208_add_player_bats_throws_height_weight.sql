-- Add bats, throws, height_in, weight_lb to players (run if table already exists)
alter table public.players
  add column if not exists bats text check (bats is null or bats in ('L', 'R', 'S')),
  add column if not exists throws text check (throws is null or throws in ('L', 'R')),
  add column if not exists height_in int check (height_in is null or (height_in >= 48 and height_in <= 96)),
  add column if not exists weight_lb int check (weight_lb is null or (weight_lb >= 80 and weight_lb <= 350));
