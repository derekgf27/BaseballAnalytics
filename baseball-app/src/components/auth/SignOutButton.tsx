"use client";

type SignOutButtonProps = {
  className?: string;
  /** Sidebar footer: text button expanded, icon-only when rail is collapsed. */
  sidebar?: boolean;
};

function SignOutIcon() {
  return (
    <svg
      className="sidebar-auth-signout-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function SignOutButton({ className, sidebar = false }: SignOutButtonProps) {
  const buttonClass = sidebar
    ? "sidebar-auth-signout-btn flex w-full items-center justify-center gap-2 rounded-md border border-[var(--neo-border)] bg-transparent px-3 py-1.5 text-sm font-medium text-[var(--neo-text-muted)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--neo-text)]"
    : "auth-signout-btn flex items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium transition";

  return (
    <form action="/auth/signout" method="post" className={className}>
      <button
        type="submit"
        className={buttonClass}
        title={sidebar ? "Sign out" : undefined}
        aria-label={sidebar ? "Sign out" : undefined}
      >
        {sidebar ? <SignOutIcon /> : null}
        <span className={sidebar ? "sidebar-auth-signout-label" : undefined}>Sign out</span>
      </button>
    </form>
  );
}
