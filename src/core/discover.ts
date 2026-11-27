import { resolveUrl } from "./text";

export interface FeedLink {
  url: string;
  title: string | null;
}

const FEED_TYPES = /^application\/(rss|atom|rdf)\+xml$|^application\/xml$|^text\/xml$/i;

/**
 * Turn what the user typed into an absolute http(s) URL, or null if it can't be one.
 * Bare hosts ("example.com/blog") get https://.
 */
export function normalizeUrlInput(input: string): string | null {
  let s = input.trim();
  if (!s || /\s/.test(s)) return null;
  if (/^feed:\/\//i.test(s)) s = "https://" + s.slice(7);
  else if (/^feed:/i.test(s)) s = s.slice(5);
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function decodeAttr(v: string): string {
  return v
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) out[m[1]!.toLowerCase()] = decodeAttr(m[2] ?? m[3] ?? m[4] ?? "");
  return out;
}

/**
 * Feeds a page advertises with <link rel="alternate" type="application/rss+xml" href=...>.
 * Resolved against the page's <base href> (if any) or its URL. Duplicates are dropped.
 */
export function discoverFeedLinks(html: string, pageUrl: string): FeedLink[] {
  const head = html.slice(0, 200_000);
  const baseTag = /<base\b[^>]*>/i.exec(head);
  const base = (baseTag && resolveUrl(attrs(baseTag[0]).href, pageUrl)) || pageUrl;
  const out: FeedLink[] = [];
  const seen = new Set<string>();
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const rel = (a.rel ?? "").toLowerCase().split(/\s+/);
    if (!rel.includes("alternate") || !FEED_TYPES.test((a.type ?? "").trim())) continue;
    const url = resolveUrl(a.href, base);
    if (!url || !/^https?:/i.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, title: a.title?.trim() || null });
  }
  // Comment feeds are rarely what's wanted; list them last.
  return [...out.filter((f) => !isCommentFeed(f)), ...out.filter((f) => isCommentFeed(f))];
}

function isCommentFeed(f: FeedLink): boolean {
  return /comment/i.test(f.title ?? "") || /\/comments\/feed\/?$/i.test(f.url);
}

/** Common feed locations to try when a page advertises none. */
export function guessFeedUrls(pageUrl: string): string[] {
  let origin: string;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return [];
  }
  return ["/feed", "/rss", "/feed.xml", "/rss.xml", "/atom.xml", "/index.xml"].map(
    (p) => origin + p,
  );
}

/** Cheap check that a response body looks like HTML rather than a feed. */
export function looksLikeHtml(body: string): boolean {
  return /^\s*(<!--[\s\S]*?-->\s*)*<(!doctype\s+html|html)\b/i.test(body.slice(0, 2000));
}
