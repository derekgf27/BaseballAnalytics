-- Wipe all baseball app data for a fresh season / testing reset.
-- KEEPS: auth.users, public.profiles (logins and roles).
-- REMOVES: games, roster, opponents, lineups, PAs, pitches, events, ratings.
--
-- Run in Supabase SQL Editor, or:
--   supabase db query --project-ref <ref> --file supabase/scripts/wipe-app-data.sql
--
-- After running, clear browser localStorage on each device (Record drafts, pitch tracker session ids):
--   DevTools → Application → Local Storage → your app origin → Clear all
--   Or run in the browser console on your app:
--     Object.keys(localStorage).filter(k => k.startsWith('record-') || k.startsWith('pitch-tracker') || k.startsWith('postgame-')).forEach(k => localStorage.removeItem(k));

BEGIN;

TRUNCATE TABLE
  public.pitch_events,
  public.pitches,
  public.baserunning_events,
  public.defensive_events,
  public.game_lineups,
  public.plate_appearances,
  public.games,
  public.saved_lineup_slots,
  public.saved_lineups,
  public.player_ratings,
  public.players,
  public.tracked_opponents
RESTART IDENTITY CASCADE;

COMMIT;
