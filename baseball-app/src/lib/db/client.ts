/**
 * Env check for Supabase. Server data access uses @/lib/supabase/server (cookie session).
 */

export function hasSupabase(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
