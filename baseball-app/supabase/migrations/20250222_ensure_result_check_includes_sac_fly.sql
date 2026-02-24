-- Ensure plate_appearances result check includes sac_fly, sac_bunt, ibb (fixes "violates check constraint" when saving SF/SH/IBB).
ALTER TABLE public.plate_appearances
  DROP CONSTRAINT IF EXISTS plate_appearances_result_check;

ALTER TABLE public.plate_appearances
  ADD CONSTRAINT plate_appearances_result_check CHECK (result IN (
    'single', 'double', 'triple', 'hr', 'out', 'bb', 'ibb', 'hbp', 'so',
    'sac', 'sac_fly', 'sac_bunt', 'other'
  ));
