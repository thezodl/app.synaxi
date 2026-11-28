/**
 * Theme preference (per browser, in localStorage). Shared by the pre-paint <head> script and
 * the client hook, so it has no "use client" (a server component needs the real string).
 */
export type ThemePref = "light" | "dark" | "system";

export const THEME_KEY = "synaxi:theme";

/** Light/dark browser chrome colours; keep in sync with `viewport.themeColor` in layout.tsx. */
export const THEME_COLORS = { light: "#ffffff", dark: "#0a0a0a" } as const;

/**
 * Applies a preference to <html>: the `dark` class (Tailwind's dark variant), `color-scheme`
 * (scrollbars, form controls) and the theme-color metas. Self-contained so it can be inlined.
 */
export function applyTheme(pref: string | null, colors: { light: string; dark: string }): void {
  const dark =
    pref === "dark" ||
    (pref !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  const system = pref !== "light" && pref !== "dark";
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const media = m.getAttribute("data-media") ?? m.getAttribute("media");
    if (media) m.setAttribute("data-media", media);
    if (system && media) m.setAttribute("media", media);
    else m.removeAttribute("media");
    m.setAttribute(
      "content",
      system
        ? media?.includes("dark")
          ? colors.dark
          : colors.light
        : dark
          ? colors.dark
          : colors.light,
    );
  });
}

/** Runs before first paint, so a forced theme doesn't flash the system one. */
export const themeInitScript = `try{(${applyTheme.toString()})(localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)}),${JSON.stringify(THEME_COLORS)})}catch(e){}`;
