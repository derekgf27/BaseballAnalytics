"use client";

import { useState } from "react";
import { signInWithUsernameAction } from "@/app/auth/signin/actions";
import { resolvePostLoginPath } from "@/lib/auth/roles";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "err">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setStatus("submitting");

    const res = await signInWithUsernameAction(username, password);
    if (!res.ok) {
      setStatus("err");
      setMessage(res.error);
      return;
    }

    const destination = res.role
      ? resolvePostLoginPath(nextPath, res.role)
      : nextPath?.startsWith("/")
        ? nextPath
        : "/";
    window.location.href = destination;
  }

  return (
    <form onSubmit={handleSignIn} className="mx-auto mt-8 max-w-sm space-y-4">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--neo-text-muted)]">
          Username
        </span>
        <input
          type="text"
          name="username"
          required
          autoComplete="username"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={status === "submitting"}
          className="mt-1 h-11 w-full rounded-lg border border-[var(--neo-border)] bg-[var(--neo-bg-base)] px-3 text-sm text-[var(--neo-text)] focus:border-[var(--neo-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]/20"
          placeholder="e.g. coach.rivera"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--neo-text-muted)]">
          Password
        </span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={status === "submitting"}
          className="mt-1 h-11 w-full rounded-lg border border-[var(--neo-border)] bg-[var(--neo-bg-base)] px-3 text-sm text-[var(--neo-text)] focus:border-[var(--neo-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]/20"
        />
      </label>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="flex h-12 w-full items-center justify-center rounded-lg bg-[var(--neo-accent)] text-sm font-bold text-[#0d1218] transition hover:brightness-110 disabled:opacity-50"
      >
        {status === "submitting" ? "Signing in…" : "Sign in"}
      </button>

      {message ? (
        <p
          className={`text-center text-sm ${status === "err" ? "text-[var(--danger)]" : "text-[var(--neo-text-muted)]"}`}
          role={status === "err" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}

      <p className="text-center text-xs text-[var(--neo-text-faint)]">
        Accounts are created by your admin. Contact them if you need access.
      </p>
    </form>
  );
}
