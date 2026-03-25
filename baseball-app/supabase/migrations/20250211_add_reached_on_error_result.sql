-- Explicit ROE result for box-score errors (charged to the fielding team).
-- Existing rows with result `other` are unchanged; new ROE should use `reached_on_error`.
ALTER TABLE public.plate_appearances
  DROP CONSTRAINT IF EXISTS plate_appearances_result_check;

ALTER TABLE public.plate_appearances
  ADD CONSTRAINT plate_appearances_result_check CHECK (result IN (
    'single', 'double', 'triple', 'hr', 'out', 'bb', 'ibb', 'hbp', 'so', 'so_looking',
    'sac', 'sac_fly', 'sac_bunt', 'other', 'gidp', 'fielders_choice', 'reached_on_error'
  ));
