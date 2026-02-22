-- Fix existing plate appearances: give them a realistic mix of results (hits, outs, BB, SO, HBP)
-- so that AVG, OBP, SLG, BB, SO, H, etc. show up. Run once in Supabase SQL editor.

-- Distribution: mostly outs, then singles, BB, SO, fewer 2B/HR/HBP/other (12 options, weighted by index)
with pa_result as (
  select
    id,
    (array[
      'out', 'out', 'out', 'out', 'out', 'out',           -- 6 outs
      'single', 'single', 'single', 'single',             -- 4 single
      'double', 'double',                                  -- 2 double
      'triple',                                           -- 1 triple
      'hr',                                               -- 1 hr
      'bb', 'bb', 'bb',                                   -- 3 bb
      'so', 'so', 'so', 'so',                             -- 4 so
      'hbp',                                              -- 1 hbp
      'other'                                             -- 1 other
    ])[1 + floor(random() * 23)::int] as new_result
  from public.plate_appearances
)
update public.plate_appearances pa
set
  result = pr.new_result,
  rbi = case pr.new_result
    when 'hr' then greatest(1, floor(random() * 4 + 1)::int)
    when 'single' then case when random() < 0.25 then 1 else 0 end
    when 'double' then case when random() < 0.3 then 1 else 0 end
    when 'triple' then case when random() < 0.4 then 1 else 0 end
    else 0
  end
from pa_result pr
where pa.id = pr.id;
