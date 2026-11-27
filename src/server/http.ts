import "server-only";

import { classifyFetchError } from "./fetcherror";

/**
 * Outbound HTTP for feeds and article pages. Errors NEVER include the URL (it may hold a private
 * token): they're short labels ("HTTP n", "Timed out", "Host not found", "Too large", …).
 */
const FEED_UA = "Synaxi/0.1 (personal RSS reader; +https://synaxi.app)";
/** Some sites serve stubs or block unknown agents for article pages. */
const PAGE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
/** Guard against huge or endless responses. */
const MAX_BYTES = 5 * 1024 * 1024;

export class FetchError extends Error {}

/**
 * A fully read response. Deliberately NOT a `Response`: Node's constructor rejects a body on
 * null-body statuses (304!), which broke every conditional GET after a feed's first fetch.
 */
interface Fetched {
  status: number;
  ok: boolean;
  headers: Headers;
  body: string;
}

async function fetchOnce(url: string, init: RequestInit, timeoutMs: number): Promise<Fetched> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, redirect: "follow" });
    // Read the body here so the timeout covers it too.
    const body = await readCapped(res);
    return { status: res.status, ok: res.ok, headers: res.headers, body };
  } finally {
    clearTimeout(t);
  }
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new FetchError("Too large");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** `http://x` → `https://x`, or null if the URL isn't plain http. */
export function httpsUpgrade(url: string): string | null {
  return /^http:\/\//i.test(url) ? "https://" + url.slice(7) : null;
}

/** fetch with a timeout. Plain-http URLs (common in OPML exports) are tried over https first. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Fetched> {
  const { timeoutMs = 20_000, ...rest } = init;
  try {
    const secure = httpsUpgrade(url);
    if (secure) {
      try {
        return await fetchOnce(secure, rest, Math.min(timeoutMs, 12_000));
      } catch {
        // fall through to http
      }
    }
    return await fetchOnce(url, rest, timeoutMs);
  } catch (e) {
    if (e instanceof FetchError) throw e;
    throw new FetchError(classifyFetchError(e));
  }
}

export type FeedFetch =
  | { status: "not-modified" }
  | { status: "ok"; body: string; etag: string | null; lastModified: string | null };

/** Conditional GET for a feed. Throws FetchError with a short, URL-free message. */
export async function fetchFeed(
  url: string,
  etag: string | null,
  lastModified: string | null,
): Promise<FeedFetch> {
  const headers: Record<string, string> = {
    "User-Agent": FEED_UA,
    Accept:
      "application/rss+xml, application/atom+xml, application/rdf+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
  };
  if (etag) headers["If-None-Match"] = etag;
  if (lastModified) headers["If-Modified-Since"] = lastModified;
  const res = await fetchWithTimeout(url, { headers });
  if (res.status === 304) return { status: "not-modified" };
  if (!res.ok) throw new FetchError(`HTTP ${res.status}`);
  return {
    status: "ok",
    body: res.body,
    etag: res.headers.get("etag"),
    lastModified: res.headers.get("last-modified"),
  };
}

/** Fetch an article page for Readability. */
export async function fetchPage(url: string, timeoutMs = 10_000): Promise<string> {
  const res = await fetchWithTimeout(url, {
    headers: { "User-Agent": PAGE_UA, Accept: "text/html,application/xhtml+xml" },
    timeoutMs,
  });
  if (!res.ok) throw new FetchError(`HTTP ${res.status}`);
  return res.body;
}
