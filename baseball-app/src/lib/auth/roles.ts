/** App roles stored in `public.profiles.role` (and optional JWT app_metadata). */
export type AppRole = "coach" | "analyst" | "admin";

const VALID_ROLES = new Set<AppRole>(["coach", "analyst", "admin"]);

export function parseAppRole(raw: string | null | undefined): AppRole | null {
  if (!raw) return null;
  const norm = raw.trim().toLowerCase();
  return VALID_ROLES.has(norm as AppRole) ? (norm as AppRole) : null;
}

/** Default landing path after sign-in. Coaches go straight to the coach portal. */
export function defaultHomePathForRole(role: AppRole): string {
  if (role === "coach") return "/coach";
  return "/";
}

/** Admin user-management dashboard. */
export function isAdminOnlyPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** Analyst portal + reports — coaches must not access. */
export function isAnalystOnlyPath(pathname: string): boolean {
  return pathname === "/analyst" || pathname.startsWith("/analyst/") || pathname === "/reports" || pathname.startsWith("/reports/");
}

/** Coach portal routes. */
export function isCoachPath(pathname: string): boolean {
  return pathname === "/coach" || pathname.startsWith("/coach/");
}

export function isPathAllowedForRole(pathname: string, role: AppRole): boolean {
  if (isAdminOnlyPath(pathname)) return role === "admin";
  if (role === "admin" || role === "analyst") return true;
  if (pathname === "/forbidden") return true;
  if (pathname === "/" || isCoachPath(pathname)) return true;
  if (pathname.startsWith("/auth/") || pathname === "/login") return true;
  if (isAnalystOnlyPath(pathname)) return false;
  if (pathname.startsWith("/api/")) return false;
  return false;
}

/** Post-login redirect: honor `next` only when the role may access it. */
export function resolvePostLoginPath(next: string | null | undefined, role: AppRole): string {
  const fallback = defaultHomePathForRole(role);
  if (!next?.startsWith("/") || next.startsWith("//")) return fallback;
  if (!isPathAllowedForRole(next.split("?")[0] ?? next, role)) return fallback;
  return next;
}

export function canSeeAnalystPortal(role: AppRole | null): boolean {
  return role === "analyst" || role === "admin";
}

/** Coach portal tile on home — admin and analyst only (coaches land on /coach directly). */
export function canSeeCoachPortal(role: AppRole | null): boolean {
  return role === "analyst" || role === "admin";
}

export function canSeeAdminPortal(role: AppRole | null): boolean {
  return role === "admin";
}

export function roleLabel(role: AppRole): string {
  if (role === "admin") return "Admin";
  if (role === "analyst") return "Analyst";
  return "Coach";
}

export function roleBadgeClassName(role: AppRole): string {
  const base =
    "role-badge rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide sm:text-sm";
  if (role === "coach") {
    return `${base} role-badge--coach border-yellow-500/80 bg-yellow-400 text-[#0d1218]`;
  }
  if (role === "admin") {
    return `${base} role-badge--admin`;
  }
  return `${base} role-badge--analyst border-[var(--neo-border)] bg-[var(--neo-bg-card)] text-[var(--neo-text)]`;
}
