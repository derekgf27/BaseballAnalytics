-- Foul pop / line out (distinct from generic `out` for game log and spray).
ALTER TABLE public.plate_appearances
  DROP CONSTRAINT IF EXISTS plate_appearances_result_check;

ALTER TABLE public.plate_appearances
  ADD CONSTRAINT plate_appearances_result_check CHECK (result IN (
    'single', 'double', 'triple', 'hr', 'out', 'foul_out', 'bb', 'ibb', 'hbp', 'so', 'so_looking',
    'sac', 'sac_fly', 'sac_bunt', 'other', 'gidp', 'fielders_choice', 'reached_on_error'
  ));
