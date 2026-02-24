-- Fix schema: remove stale/wrong column name and ensure runs_scored_player_ids exists.
-- The app uses runs_scored_player_ids (uuid[]). If team_scored_player_id exists (old/typo), drop it.
-- Then ensure runs_scored_player_ids exists so schema cache and app stay in sync.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'plate_appearances'
      AND column_name = 'team_scored_player_id'
  ) THEN
    ALTER TABLE public.plate_appearances DROP COLUMN team_scored_player_id;
  END IF;
END $$;

-- Ensure the correct column exists (idempotent).
ALTER TABLE public.plate_appearances
  ADD COLUMN IF NOT EXISTS runs_scored_player_ids uuid[] DEFAULT '{}';
