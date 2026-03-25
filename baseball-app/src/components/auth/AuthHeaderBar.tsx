import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";

/** Top bar when login is enforced and user is signed in. Hidden when AUTH_REQUIRED is not set. */
export async function AuthHeaderBar() {
  if (process.env.AUTH_DISABLED === "true") return null;
  if (process.env.AUTH_REQUIRED !== "true") return null;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return (
    <header className="flex shrink-0 items-center justify-end gap-2 border-b border-[var(--neo-border)]/50 bg-[#0d1218]/90 px-4 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-xs text-[var(--neo-text-muted)]">
        <span className="max-w-[200px] truncate" title={user.email ?? undefined}>
          {user.email}
        </span>
        <SignOutButton />
      </div>
    </header>
  );
}
