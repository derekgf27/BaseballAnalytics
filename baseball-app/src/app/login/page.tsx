import { LoginForm } from "./LoginForm";
import { LoginStadiumLights } from "./LoginStadiumLights";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
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
    <div className="login-night-page relative flex min-h-[100dvh] flex-col items-center justify-center px-4 pb-10 pt-8">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle variant="icon" />
      </div>
      <LoginStadiumLights />

      <div className="login-form-reveal relative z-10 w-full max-w-xl">
        <div className="login-night-card neo-card border border-[var(--neo-border)]/80 p-10 sm:p-12 shadow-[var(--shadow-accent-glow)] backdrop-blur-sm">
          <div className="text-center">
            <h1 className="home-title-glow font-display text-4xl font-semibold normal-case tracking-wider text-[var(--neo-text)] sm:text-[2.75rem]">
              {APP_NAME}
            </h1>
            <p className="mt-2 text-base text-[var(--neo-text-muted)] sm:text-lg">{APP_TAGLINE}</p>
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
    </div>
  );
}
