import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/profile";
import { canSeeAnalystPortal, type AppRole } from "@/lib/auth/roles";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

function isAuthEnforced(): boolean {
  if (process.env.AUTH_DISABLED === "true") return false;
  return process.env.AUTH_REQUIRED === "true";
}

async function requireSignedInRole(): Promise<{ userId: string; role: AppRole }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new AuthError("Supabase is not configured.");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AuthError("Sign in required.");

  const role = await resolveUserRole(supabase, user);
  if (!role) throw new AuthError("No role assigned for this account.");

  return { userId: user.id, role };
}

/** Use at the top of analyst server actions when AUTH_REQUIRED is on. */
export async function requireAnalystAccess(): Promise<AppRole> {
  if (!isAuthEnforced()) return "analyst";

  const { role } = await requireSignedInRole();
  if (!canSeeAnalystPortal(role)) {
    throw new AuthError("Analyst access required.");
  }

  return role;
}

/** Use at the top of admin server actions when AUTH_REQUIRED is on. */
export async function requireAdminAccess(): Promise<{ userId: string; role: AppRole }> {
  if (!isAuthEnforced()) {
    return { userId: "dev-admin", role: "admin" };
  }

  const session = await requireSignedInRole();
  if (session.role !== "admin") {
    throw new AuthError("Admin access required.");
  }

  return session;
}
