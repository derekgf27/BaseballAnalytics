export type AppTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "ba-theme";

export const DEFAULT_THEME: AppTheme = "dark";

export function isAppTheme(value: string | null | undefined): value is AppTheme {
  return value === "light" || value === "dark";
}

export function themeColorFor(theme: AppTheme): string {
  return theme === "light" ? "#eef1f5" : "#0a0e12";
}
