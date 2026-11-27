"use client";

import { useCallback, useSyncExternalStore } from "react";

const LG = "(min-width: 1024px)";

/** True at Tailwind's `lg` breakpoint and up. Prerenders as desktop (the main target). */
export function useIsLarge(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(LG);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(LG).matches,
    () => true,
  );
}

const EVENT = "synaxi:pref";

function read(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback; // storage blocked (private mode etc.)
  }
}

/** A boolean UI preference in localStorage (per browser; not worth a DB round trip). */
export function usePersistentFlag(key: string, fallback: boolean): [boolean, (v: boolean) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      const on = (e: Event) => (e as CustomEvent).detail === key && cb();
      window.addEventListener(EVENT, on);
      window.addEventListener("storage", cb);
      return () => {
        window.removeEventListener(EVENT, on);
        window.removeEventListener("storage", cb);
      };
    },
    () => read(key, fallback),
    () => fallback,
  );
  const set = useCallback(
    (v: boolean) => {
      try {
        window.localStorage.setItem(key, v ? "1" : "0");
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
    },
    [key],
  );
  return [value, set];
}
