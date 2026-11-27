"use client";

import { useState } from "react";

import { faviconCandidates } from "@/core/favicon";
import { cn } from "@/lib/utils";

/**
 * Site icon from the feed's site URL (hostname only; never the feed URL, which may hold a token).
 * Falls back through candidates, then to a letter tile.
 */
export function Favicon({
  siteUrl,
  title,
  className,
}: {
  siteUrl: string | null;
  title: string;
  className?: string;
}) {
  // No feed URL on the client: pass "" so only the site's host is used.
  const candidates = siteUrl ? faviconCandidates(siteUrl, "") : [];
  const [i, setI] = useState(0);
  const src = candidates[i];

  if (!src) {
    return (
      <span
        aria-hidden
        className={cn(
          "bg-muted text-muted-foreground inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-[10px] font-semibold uppercase",
          className,
        )}
      >
        {title.trim()[0] ?? "?"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- third-party favicons, not optimised
    <img
      src={src}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      className={cn("size-4 shrink-0 rounded-sm", className)}
      onError={() => setI((n) => n + 1)}
    />
  );
}
