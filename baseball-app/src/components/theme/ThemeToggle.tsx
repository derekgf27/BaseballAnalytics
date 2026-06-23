"use client";

import { useTheme } from "./ThemeProvider";
import type { AppTheme } from "@/lib/theme";

function SunIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

type ThemeToggleProps = {
  variant?: "sidebar" | "bar" | "icon";
  /** e.g. sidebar-link-analyst — matches portal nav styling */
  linkClassName?: string;
  className?: string;
};

export function ThemeToggle({
  variant = "sidebar",
  linkClassName = "sidebar-link sidebar-link-analyst",
  className = "",
}: ThemeToggleProps) {
  const { theme, toggleTheme, ready } = useTheme();
  const next: AppTheme = theme === "dark" ? "light" : "dark";
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  if (!ready) return null;

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`theme-toggle-icon flex h-10 w-10 items-center justify-center rounded-lg border transition ${className}`}
        aria-label={label}
        title={label}
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>
    );
  }

  if (variant === "bar") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`theme-toggle-bar inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${className}`}
        aria-label={label}
        title={label}
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        <span>{theme === "dark" ? "Light" : "Dark"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`${linkClassName} theme-toggle-sidebar ${className}`}
      aria-label={label}
      title={label}
    >
      <span className="sidebar-icon" aria-hidden>
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </span>
      <span className="sidebar-label">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
