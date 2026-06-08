import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchUserProfile, resolveUserRole } from "@/lib/auth/profile";
import type { AppRole } from "@/lib/auth/roles";
import type { User } from "@supabase/supabase-js";

export type SessionWithRole = {
  user: User;
  role: AppRole;
  username: string | null;
  displayName: string | null;
};

function isAuthEnforced(): boolean {
  if (process.env.AUTH_DISABLED === "true") return false;
  return process.env.AUTH_REQUIRED === "true";
}

/** Signed-in user + role for server components and server actions. */
export async function getSessionWithRole(): Promise<SessionWithRole | null> {
  if (!isAuthEnforced()) return null;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const role = await resolveUserRole(supabase, user);
  if (!role) return null;

  const profile = await fetchUserProfile(supabase, user.id);

  return {
    user,
    role,
    username: profile?.username ?? null,
    displayName: profile?.display_name ?? null,
  };
}
