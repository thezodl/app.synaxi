/**
 * Icon URLs to try for a feed, best first. Only the hostname is used: never the feed URL's
 * path or query, which may hold a private token. The feed's host is a fallback for feeds
 * without a site link.
 */
export function faviconCandidates(siteUrl: string | null, feedUrl: string): string[] {
  const host = hostOf(siteUrl) ?? hostOf(feedUrl);
  if (!host) return [];
  return [`https://${host}/favicon.ico`, `https://icons.duckduckgo.com/ip3/${host}.ico`];
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname || null;
  } catch {
    return null;
  }
}
