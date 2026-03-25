"use client";

export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="rounded border border-[var(--neo-border)] bg-transparent px-2 py-1 text-xs text-[var(--neo-text-muted)] transition hover:bg-[#151b21] hover:text-[var(--neo-text)]"
      >
        Sign out
      </button>
    </form>
  );
}
