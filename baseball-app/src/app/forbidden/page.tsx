import Link from "next/link";
import { defaultHomePathForRole } from "@/lib/auth/roles";
import { getSessionWithRole } from "@/lib/auth/session";
import { APP_NAME } from "@/lib/appBrand";

export const metadata = {
  title: `Access denied · ${APP_NAME}`,
};

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSessionWithRole();
  const homeHref = session ? defaultHomePathForRole(session.role) : "/login";

  const message =
    sp.error === "no_role"
      ? "Your account is signed in but has no role assigned yet. Ask your admin to set your role in Supabase (profiles table)."
      : sp.error === "role"
        ? "You don't have permission to view that page."
        : "You don't have permission to access this area.";

  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center px-4 pb-16 pt-8">
      <div className="neo-card w-full max-w-md p-8 text-center">
        <span className="text-3xl" aria-hidden>
          🔒
        </span>
        <h1 className="mt-3 font-display text-2xl font-semibold uppercase tracking-wider text-[var(--neo-text)]">
          Access denied
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--neo-text-muted)]">{message}</p>
        {sp.from ? (
          <p className="mt-2 text-xs text-[var(--neo-text-faint)]">
            Requested: <span className="font-mono text-[var(--neo-text-muted)]">{sp.from}</span>
          </p>
        ) : null}
        <Link
          href={homeHref}
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[var(--neo-border)] bg-[var(--neo-bg-base)] px-5 text-sm font-semibold text-[var(--neo-accent)] transition hover:bg-[#151b21]"
        >
          {session ? "Go to your portal" : "Sign in"}
        </Link>
      </div>
    </div>
  );
}
