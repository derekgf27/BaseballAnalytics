import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Sign in · Baseball Analytics",
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
          <h1 className="mt-3 font-display text-3xl font-semibold uppercase tracking-wider text-[var(--neo-text)]">
            Baseball Analytics
          </h1>
          <p className="mt-1 text-sm text-[var(--neo-text-muted)]">Continue with Google to sign in.</p>
        </div>

        {err === "forbidden" && (
          <p className="mt-4 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-center text-sm text-[var(--danger)]">
            This email is not allowed for this deployment.
          </p>
        )}
        {err === "auth" && (
          <p className="mt-4 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-center text-sm text-[var(--danger)]">
            Sign-in failed. Try again or request a new link.
          </p>
        )}

        <LoginForm nextPath={nextPath} />

        <p className="mt-6 text-center text-xs text-[var(--neo-text-muted)]">
          <Link href="/" className="text-[var(--neo-accent)] hover:underline">
            Home
          </Link>
        </p>
      </div>
    </div>
  );
}
