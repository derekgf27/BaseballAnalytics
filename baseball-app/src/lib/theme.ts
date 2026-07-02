export type AppTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "ba-theme";

export const DEFAULT_THEME: AppTheme = "dark";

/** User preference from storage; anything except explicit `"light"` resolves to dark. */
export function resolveStoredTheme(stored: string | null | undefined): AppTheme {
  return stored === "light" ? "light" : DEFAULT_THEME;
}

export function isAppTheme(value: string | null | undefined): value is AppTheme {
  return value === "light" || value === "dark";
}

export function themeColorFor(theme: AppTheme): string {
  return theme === "light" ? "#eef1f5" : "#0a0e12";
}

export function applyThemeToDocument(theme: AppTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", themeColorFor(theme));
}
