-- Separate home/away lineups per game (for recording both teams' PAs).
ALTER TABLE public.game_lineups
  DROP CONSTRAINT IF EXISTS game_lineups_game_id_slot_key;

ALTER TABLE public.game_lineups
  ADD COLUMN IF NOT EXISTS side text CHECK (side IN ('home', 'away'));

UPDATE public.game_lineups gl
SET side = g.our_side
FROM public.games g
WHERE gl.game_id = g.id AND (gl.side IS NULL OR gl.side = '');

UPDATE public.game_lineups SET side = 'away' WHERE side IS NULL;

ALTER TABLE public.game_lineups
  ALTER COLUMN side SET NOT NULL;

ALTER TABLE public.game_lineups
  ADD CONSTRAINT game_lineups_game_side_slot_unique UNIQUE (game_id, side, slot);
