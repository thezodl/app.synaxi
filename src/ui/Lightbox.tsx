"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

export interface LightboxImage {
  src: string;
  alt: string;
  caption: string | null;
}

/**
 * Full-screen image viewer: arrows / swipe to move between the article's images, click (or z)
 * to toggle zoom, scroll/drag to pan when zoomed, Esc to close.
 */
export function Lightbox({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: LightboxImage[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const open = index !== null && !!images[index];
  const [zoomed, setZoomed] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const img = open ? images[index!]! : null;

  const go = (d: number) => {
    if (index === null) return;
    const next = index + d;
    if (next >= 0 && next < images.length) {
      setZoomed(false);
      onIndex(next);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "j") go(1);
      else if (e.key === "ArrowLeft" || e.key === "k") go(-1);
      else if (e.key === "z") setZoomed((z) => !z);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    // Capture so the app's own j/k shortcuts don't also fire.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setZoomed(false);
          onClose();
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/90" />
        <DialogPrimitive.Popup
          className="fixed inset-0 z-50 flex flex-col text-white outline-none"
          aria-label="Image viewer"
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t && !zoomed) touch.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            const start = touch.current;
            const t = e.changedTouches[0];
            touch.current = null;
            if (!start || !t) return;
            const dx = t.clientX - start.x;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(t.clientY - start.y))
              go(dx < 0 ? 1 : -1);
          }}
        >
          <div className="flex items-center justify-between p-3 text-sm">
            <span className="tabular-nums opacity-70">
              {index !== null ? index + 1 : 0} / {images.length}
            </span>
            <DialogPrimitive.Close className="rounded-md p-2 hover:bg-white/10" aria-label="Close">
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <div
            className={
              zoomed
                ? "min-h-0 flex-1 overflow-auto"
                : "flex min-h-0 flex-1 items-center justify-center p-4"
            }
          >
            {img && (
              // eslint-disable-next-line @next/next/no-img-element -- remote article image
              <img
                src={img.src}
                alt={img.alt}
                onClick={() => setZoomed((z) => !z)}
                className={
                  zoomed
                    ? "max-w-none cursor-zoom-out"
                    : "max-h-full max-w-full cursor-zoom-in object-contain"
                }
              />
            )}
          </div>
          {img?.caption && (
            <p className="px-4 pb-4 text-center text-sm opacity-80">{img.caption}</p>
          )}
          {index !== null && index > 0 && (
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/40 p-2 hover:bg-black/60"
              aria-label="Previous image"
            >
              <ChevronLeft className="size-6" />
            </button>
          )}
          {index !== null && index < images.length - 1 && (
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/40 p-2 hover:bg-black/60"
              aria-label="Next image"
            >
              <ChevronRight className="size-6" />
            </button>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
