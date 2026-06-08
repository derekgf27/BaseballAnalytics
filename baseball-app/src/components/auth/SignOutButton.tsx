"use client";

type SignOutButtonProps = {
  className?: string;
};

export function SignOutButton({ className }: SignOutButtonProps) {
  return (
    <form action="/auth/signout" method="post" className={className}>
      <button
        type="submit"
        className="flex items-center justify-center rounded-md border border-[var(--neo-border)] bg-transparent px-3 py-1.5 text-sm font-medium text-[var(--neo-text-muted)] transition hover:bg-[#151b21] hover:text-[var(--neo-text)]"
      >
        <span data-signout-label>Sign out</span>
        <span data-signout-icon aria-hidden>
          ⎋
        </span>
      </button>
    </form>
  );
}
