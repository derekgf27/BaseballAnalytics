-- Add sac_fly and sac_bunt for wOBA (SF in denominator; SH not). Keep 'sac' for legacy data.
ALTER TABLE public.plate_appearances
  DROP CONSTRAINT IF EXISTS plate_appearances_result_check;

ALTER TABLE public.plate_appearances
  ADD CONSTRAINT plate_appearances_result_check CHECK (result IN (
    'single', 'double', 'triple', 'hr', 'out', 'bb', 'hbp', 'so',
    'sac', 'sac_fly', 'sac_bunt', 'other'
  ));
