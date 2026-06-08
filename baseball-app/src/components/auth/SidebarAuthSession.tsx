import { fetchUserProfile, resolveUserRole } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthSessionPanel, type SidebarPortal } from "./AuthSessionPanel";

function isAuthEnforced(): boolean {
  if (process.env.AUTH_DISABLED === "true") return false;
  return process.env.AUTH_REQUIRED === "true";
}

/** Sidebar footer: exit link plus signed-in profile when auth is enforced. */
export async function SidebarAuthSession({
  variant = "sidebar",
  portal = "analyst",
}: {
  variant?: "sidebar" | "bar";
  portal?: SidebarPortal;
}) {
  if (variant === "bar") {
    if (!isAuthEnforced()) return null;

    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const role = await resolveUserRole(supabase, user);
    const profile = await fetchUserProfile(supabase, user.id);
    const handle =
      (profile?.username
        ? `@${profile.username}`
        : profile?.display_name ?? user.email) ?? null;

    return <AuthSessionPanel role={role} handle={handle} variant="bar" />;
  }

  let role = null;
  let handle: string | null = null;
  let showSignOut = false;

  if (isAuthEnforced()) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        role = await resolveUserRole(supabase, user);
        const profile = await fetchUserProfile(supabase, user.id);
        handle =
          (profile?.username
            ? `@${profile.username}`
            : profile?.display_name ?? user.email) ?? null;
        showSignOut = true;
      }
    }
  }

  return (
    <AuthSessionPanel
      role={role}
      handle={handle}
      variant="sidebar"
      portal={portal}
      showSignOut={showSignOut}
    />
  );
}
