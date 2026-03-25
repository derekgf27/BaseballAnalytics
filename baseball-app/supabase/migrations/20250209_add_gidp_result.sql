-- Ground into double play (GIDP): two outs on one PA; requires at least one runner (app-validated).
ALTER TABLE public.plate_appearances
  DROP CONSTRAINT IF EXISTS plate_appearances_result_check;

ALTER TABLE public.plate_appearances
  ADD CONSTRAINT plate_appearances_result_check CHECK (result IN (
    'single', 'double', 'triple', 'hr', 'out', 'bb', 'ibb', 'hbp', 'so', 'so_looking',
    'sac', 'sac_fly', 'sac_bunt', 'other', 'gidp'
  ));
