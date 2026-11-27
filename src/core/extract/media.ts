export interface VideoEmbed {
  provider: "youtube" | "vimeo";
  id: string;
  /** Thumbnail we can cache for offline display; null when the provider has no static URL. */
  posterUrl: string | null;
  /** URL to open in the browser/app. */
  watchUrl: string;
  embedUrl: string;
}

export function parseVideoEmbed(src: string | null | undefined): VideoEmbed | null {
  if (!src) return null;
  let u: URL;
  try {
    u = new URL(src, "https://x.invalid");
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  let yt: string | null = null;
  if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) {
    const m = /^\/(?:embed|shorts|v|live)\/([\w-]{6,})/.exec(u.pathname);
    yt = m?.[1] ?? (u.pathname === "/watch" ? u.searchParams.get("v") : null);
  } else if (host === "youtu.be") {
    yt = u.pathname.slice(1).split("/")[0] || null;
  }
  if (yt) {
    return {
      provider: "youtube",
      id: yt,
      posterUrl: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
      watchUrl: `https://www.youtube.com/watch?v=${yt}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&playsinline=1&rel=0`,
    };
  }
  if (host === "player.vimeo.com" || host === "vimeo.com") {
    const m = /\/(?:video\/)?(\d+)/.exec(u.pathname);
    if (m) {
      return {
        provider: "vimeo",
        id: m[1]!,
        posterUrl: null,
        watchUrl: `https://vimeo.com/${m[1]}`,
        embedUrl: `https://player.vimeo.com/video/${m[1]}?autoplay=1`,
      };
    }
  }
  return null;
}

/** Pick the widest candidate from a srcset, capped so we don't download huge originals. */
export function bestFromSrcset(srcset: string | null | undefined, maxWidth = 1600): string | null {
  if (!srcset) return null;
  const candidates = srcset
    .split(/,\s+(?=\S)/)
    .map((part) => {
      const [url, desc] = part.trim().split(/\s+/);
      const w = desc?.endsWith("w")
        ? parseInt(desc, 10)
        : desc?.endsWith("x")
          ? parseFloat(desc) * 800
          : 1;
      return { url: url ?? "", w: Number.isFinite(w) ? w : 1 };
    })
    .filter((c) => c.url);
  if (!candidates.length) return null;
  const within = candidates.filter((c) => c.w <= maxWidth);
  const pool = within.length ? within : candidates;
  return pool.reduce((a, b) => (b.w > a.w ? b : a)).url;
}
