import { LoginForm } from "./LoginForm";
import { APP_NAME, APP_TAGLINE } from "@/lib/appBrand";

export const metadata = {
  title: `Sign in · ${APP_NAME}`,
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const nextPath = sp.next && sp.next.startsWith("/") ? sp.next : "/";
  const err = sp.error;

  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center px-4 pb-16 pt-8">
      <div className="neo-card w-full max-w-md p-8">
        <div className="text-center">
          <span className="text-3xl" aria-hidden>
            ⚾
          </span>
          <h1 className="mt-3 font-display text-3xl font-semibold normal-case tracking-wider text-[var(--neo-text)]">
            {APP_NAME}
          </h1>
          <p className="mt-1 text-sm text-[var(--neo-text-muted)]">{APP_TAGLINE}</p>
          <p className="mt-3 text-sm text-[var(--neo-text-muted)]">
            Sign in with your username and password to continue.
          </p>
        </div>

        {err === "forbidden" && (
          <p className="mt-4 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-center text-sm text-[var(--danger)]">
            This email is not allowed for this deployment.
          </p>
        )}
        {err === "auth" && (
          <p className="mt-4 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-center text-sm text-[var(--danger)]">
            Sign-in failed. Check your username and password, then try again.
          </p>
        )}

        <LoginForm nextPath={nextPath} />
      </div>
    </div>
  );
}
