/**
 * Email magic-link sign-in (not wired on /login right now — use when you re-enable email UI).
 * Call from a client component with getSupabaseBrowserClient().
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function signInWithEmailMagicLink(
  supabase: SupabaseClient,
  email: string,
  nextPath: string
): Promise<{ error: Error | null }> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath || "/")}`,
    },
  });
  return { error: error ? new Error(error.message) : null };
}
