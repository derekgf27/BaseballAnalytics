import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/theme";

/** Runs before paint to avoid a flash of the wrong theme. */
export function ThemeScript() {
  const script = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);var theme=t==="light"?"light":${JSON.stringify(DEFAULT_THEME)};var el=document.documentElement;el.setAttribute("data-theme",theme);el.style.colorScheme=theme;}catch(e){var el=document.documentElement;el.setAttribute("data-theme",${JSON.stringify(DEFAULT_THEME)});el.style.colorScheme=${JSON.stringify(DEFAULT_THEME)};}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
