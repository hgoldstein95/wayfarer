import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "wayfarer-theme";

/** Read the active theme set on <html> by the inline boot script in index.html. */
function currentTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

/**
 * Theme state synced to the <html data-theme> attribute and localStorage. The
 * initial value comes from the boot script (which honors a saved choice or the
 * system preference), so there's no flash on load.
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage failures (e.g. private mode); the attribute still applies.
    }
  }, [theme]);

  return {
    theme,
    toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
  };
}
