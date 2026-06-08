"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ANALYST_NAV_LINKS, isAnalystNavLinkActive } from "@/lib/analystNavLinks";
import { guardNavUntilSidebarExpanded } from "@/lib/sidebarCollapsedNav";

type AnalystNavLinksProps = {
  collapsed: boolean;
  expandOnly: () => void;
};

export function AnalystNavLinksFallback({ collapsed, expandOnly }: AnalystNavLinksProps) {
  return (
    <>
      {ANALYST_NAV_LINKS.map(({ href, label, icon }) => (
        <Link
          key={href}
          href={href}
          title={collapsed ? `Open menu — tap again for ${label}` : undefined}
          onClick={(e) => guardNavUntilSidebarExpanded(e, collapsed, expandOnly)}
          className="sidebar-link sidebar-link-analyst"
        >
          <span className="sidebar-icon" aria-hidden>
            {icon}
          </span>
          <span className="sidebar-label">{label}</span>
        </Link>
      ))}
    </>
  );
}

export function AnalystNavLinks({ collapsed, expandOnly }: AnalystNavLinksProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <>
      {ANALYST_NAV_LINKS.map(({ href, label, icon }) => {
        const active = isAnalystNavLinkActive(href, pathname, searchParams);
        return (
          <Link
            key={href}
            href={href}
            title={collapsed ? `Open menu — tap again for ${label}` : undefined}
            onClick={(e) => guardNavUntilSidebarExpanded(e, collapsed, expandOnly)}
            className={`sidebar-link sidebar-link-analyst ${active ? "[data-active=true]" : ""}`}
            data-active={active ? "true" : undefined}
          >
            <span className="sidebar-icon" aria-hidden>
              {icon}
            </span>
            <span className="sidebar-label">{label}</span>
          </Link>
        );
      })}
    </>
  );
}
