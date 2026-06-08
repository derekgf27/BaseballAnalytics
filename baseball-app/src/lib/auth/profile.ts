import type { SupabaseClient, User } from "@supabase/supabase-js";
import { parseAppRole, type AppRole } from "@/lib/auth/roles";

export type UserProfile = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  role: AppRole;
};

/** Role from JWT app_metadata (set when provisioning users in Supabase). */
export function roleFromUserMetadata(user: User): AppRole | null {
  const meta = user.app_metadata as { role?: string } | undefined;
  return parseAppRole(meta?.role);
}

export async function fetchProfileRole(
  supabase: SupabaseClient,
  userId: string
): Promise<AppRole | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return parseAppRole((data as { role?: string }).role);
}

/** Prefer `profiles` table; fall back to JWT app_metadata. */
export async function resolveUserRole(supabase: SupabaseClient, user: User): Promise<AppRole | null> {
  const fromProfile = await fetchProfileRole(supabase, user.id);
  if (fromProfile) return fromProfile;
  return roleFromUserMetadata(user);
}

export async function fetchUserProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, username, display_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  const role = parseAppRole((data as { role?: string }).role);
  if (!role) return null;

  const row = data as {
    id: string;
    email: string | null;
    username: string | null;
    display_name: string | null;
  };

  return {
    id: row.id,
    email: row.email,
    username: row.username,
    display_name: row.display_name,
    role,
  };
}
