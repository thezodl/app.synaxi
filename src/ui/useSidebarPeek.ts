"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

const OPEN_DELAY = 120;
const CLOSE_DELAY = 300;

const menuOpen = () => !!document.querySelector("[data-open][role=menu]");

/**
 * Hovering the "show sidebar" button (with a mouse) slides the sidebar in as an overlay. It stays
 * while the pointer is over it (or one of its menus) and slides away shortly after it leaves.
 * Clicking the button still pins it as a column.
 */
export function useSidebarPeek(enabled: boolean) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
  }, []);
  const close = useCallback(() => {
    cancel();
    setOpen(false);
  }, [cancel]);

  const peeking = enabled && open;

  useEffect(() => {
    if (!peeking) return;
    const scheduleClose = () => {
      if (timer.current !== undefined) return;
      timer.current = window.setTimeout(() => {
        timer.current = undefined;
        // An open menu (portalled outside the panel) keeps it; the next move after it closes decides.
        if (!menuOpen()) setOpen(false);
      }, CLOSE_DELAY);
    };
    const onMove = (e: globalThis.PointerEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      if (panelRef.current?.contains(t) || t?.closest("[role=menu]")) cancel();
      else scheduleClose();
    };
    const root = document.documentElement;
    document.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", scheduleClose);
    return () => {
      document.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", scheduleClose);
      cancel();
    };
  }, [peeking, cancel]);

  useEffect(() => cancel, [cancel]);

  const triggerProps = useMemo(
    () => ({
      onPointerEnter: (e: PointerEvent) => {
        if (!enabled || e.pointerType !== "mouse") return;
        cancel();
        timer.current = window.setTimeout(() => {
          timer.current = undefined;
          setOpen(true);
        }, OPEN_DELAY);
      },
      onPointerLeave: () => {
        if (!open) cancel();
      },
    }),
    [enabled, open, cancel],
  );

  return { peeking, close, panelRef, triggerProps };
}
