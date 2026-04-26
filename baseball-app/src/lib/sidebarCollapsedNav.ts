import type { MouseEvent } from "react";

/**
 * Collapsed rail: first click only expands the sidebar; second click follows the link.
 */
export function guardNavUntilSidebarExpanded(
  e: MouseEvent<HTMLAnchorElement>,
  collapsed: boolean,
  expand: () => void
): void {
  if (collapsed) {
    e.preventDefault();
    expand();
  }
}
