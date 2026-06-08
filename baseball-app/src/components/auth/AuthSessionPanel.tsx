import Link from "next/link";
import { roleBadgeClassName, roleLabel, type AppRole } from "@/lib/auth/roles";
import { SignOutButton } from "./SignOutButton";

export type SidebarPortal = "coach" | "analyst" | "admin";

const EXIT_LINK_CLASS: Record<SidebarPortal, string> = {
  coach: "sidebar-link-coach",
  analyst: "sidebar-link-analyst",
  admin: "sidebar-link-admin",
};

type AuthSessionPanelProps = {
  role: AppRole | null;
  handle: string | null;
  variant?: "sidebar" | "bar";
  portal?: SidebarPortal;
  showSignOut?: boolean;
};

export function AuthSessionPanel({
  role,
  handle,
  variant = "sidebar",
  portal = "analyst",
  showSignOut = true,
}: AuthSessionPanelProps) {
  if (variant === "bar") {
    return (
      <div className="flex items-center gap-3 text-sm text-[var(--neo-text)]">
        {role ? (
          <span className={roleBadgeClassName(role)}>{roleLabel(role)}</span>
        ) : null}
        <span className="max-w-[240px] truncate font-medium" title={handle ?? undefined}>
          {handle}
        </span>
        {showSignOut ? <SignOutButton /> : null}
      </div>
    );
  }

  const exitClass = EXIT_LINK_CLASS[portal];

  return (
    <div className="sidebar-auth mt-2 shrink-0 border-t border-[var(--border)] p-2">
      <div className="flex flex-col gap-2 px-1.5 py-2">
        <Link
          href="/"
          className={`sidebar-link ${exitClass} opacity-70`}
          title="Exit to home"
        >
          <span className="sidebar-icon" aria-hidden>
            &larr;
          </span>
          <span className="sidebar-label">Exit</span>
        </Link>

        {(role || handle) ? (
          <div className="flex min-w-0 items-center gap-2">
            {role ? (
              <span
                className={`${roleBadgeClassName(role)} sidebar-auth-badge shrink-0 truncate`}
              >
                {roleLabel(role)}
              </span>
            ) : null}
            {handle ? (
              <span
                className="sidebar-label min-w-0 flex-1 truncate text-sm font-medium text-[var(--text)]"
                title={handle}
              >
                {handle}
              </span>
            ) : null}
          </div>
        ) : null}
        {showSignOut ? (
          <SignOutButton className="w-full [&_button]:w-full [&_button]:justify-center" />
        ) : null}
      </div>
    </div>
  );
}
