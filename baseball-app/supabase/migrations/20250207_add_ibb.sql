-- Add IBB (intentional walk) for wOBA: denominator uses (BB - IBB).
ALTER TABLE public.plate_appearances
  DROP CONSTRAINT IF EXISTS plate_appearances_result_check;

ALTER TABLE public.plate_appearances
  ADD CONSTRAINT plate_appearances_result_check CHECK (result IN (
    'single', 'double', 'triple', 'hr', 'out', 'bb', 'ibb', 'hbp', 'so',
    'sac', 'sac_fly', 'sac_bunt', 'other'
  ));
