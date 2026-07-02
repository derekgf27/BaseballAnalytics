import Link from "next/link";
import { roleBadgeClassName, roleLabel, type AppRole } from "@/lib/auth/roles";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SignOutButton } from "./SignOutButton";

export type SidebarPortal = "coach" | "analyst" | "admin";

const EXIT_LINK_CLASS: Record<SidebarPortal, string> = {
  coach: "sidebar-link-coach",
  analyst: "sidebar-link-analyst",
  admin: "sidebar-link-admin",
};

function ExitIcon() {
  return (
    <svg
      className="sidebar-auth-exit-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5z" />
    </svg>
  );
}

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
  /** Coach accounts only use /coach; admin/analyst need Exit even inside the coach portal. */
  const showExit = role !== "coach";

  return (
    <div className="sidebar-auth mt-2 shrink-0 border-t border-[var(--border)] p-2">
      <div className="flex flex-col gap-2 px-1.5 py-2">
        {showExit ? (
          <Link
            href="/"
            className={`sidebar-link sidebar-auth-exit ${exitClass}`}
            title="Exit to home"
            aria-label="Exit to home"
          >
            <ExitIcon />
            <span className="sidebar-label">Exit</span>
          </Link>
        ) : null}

        <ThemeToggle linkClassName={`sidebar-link ${exitClass}`} />

        {(role || handle) ? (
          <div className="sidebar-auth-expanded flex min-w-0 items-center gap-2">
            {role ? (
              <span
                className={`${roleBadgeClassName(role)} sidebar-auth-badge shrink-0 truncate`}
              >
                {roleLabel(role)}
              </span>
            ) : null}
            {handle ? (
              <span
                className="sidebar-label min-w-0 flex-1 truncate text-sm font-medium"
                title={handle}
              >
                {handle}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
