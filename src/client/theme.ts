"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import { applyTheme, THEME_COLORS, THEME_KEY, type ThemePref } from "./themeScript";

const EVENT = "synaxi:theme";
const DARK = "(prefers-color-scheme: dark)";

function readPref(): ThemePref {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system"; // storage blocked (private mode etc.)
  }
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia(DARK);
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  mq.addEventListener("change", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
    mq.removeEventListener("change", cb);
  };
}

/** The stored preference, and a setter that persists and applies it. */
export function useThemePref(): [ThemePref, (p: ThemePref) => void] {
  const pref = useSyncExternalStore(subscribe, readPref, () => "system" as const);
  const set = useCallback((p: ThemePref) => {
    try {
      if (p === "system") window.localStorage.removeItem(THEME_KEY);
      else window.localStorage.setItem(THEME_KEY, p);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [pref, set];
}

function useSystemDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DARK).matches,
    () => false,
  );
}

/** The theme actually showing. */
export function useResolvedTheme(): "light" | "dark" {
  const [pref] = useThemePref();
  const systemDark = useSystemDark();
  return pref === "dark" || (pref === "system" && systemDark) ? "dark" : "light";
}

/** Keeps <html> in step with the preference: this tab, other tabs, OS changes in System mode. */
export function ThemeSync() {
  const [pref] = useThemePref();
  const systemDark = useSystemDark();
  useEffect(() => applyTheme(pref, THEME_COLORS), [pref, systemDark]);
  return null;
}
