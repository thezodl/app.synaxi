import "server-only";

import {
  discoverFeedLinks,
  guessFeedUrls,
  looksLikeHtml,
  normalizeUrlInput,
} from "@/core/discover";
import { parseFeed } from "@/core/feeds/parse";

import { UserError } from "./errors";
import { FetchError, fetchFeed, fetchPage } from "./http";

/** Ported from mobile `sync/discover.ts`. */
export interface FoundFeed {
  url: string;
  title: string;
  siteUrl: string | null;
}

export type FindResult =
  { kind: "feed"; feed: FoundFeed } | { kind: "choices"; feeds: FoundFeed[] };

/** Shown to the user, so never includes the URL (it may hold a token). */
export class DiscoverError extends UserError {
  constructor(message: string) {
    super(message, 422);
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Feed";
  }
}

function asFeed(url: string, body: string, fallbackTitle?: string | null): FoundFeed | null {
  try {
    const p = parseFeed(body);
    return { url, title: p.title || fallbackTitle || hostOf(url), siteUrl: p.siteUrl };
  } catch {
    return null;
  }
}

async function getBody(url: string): Promise<string> {
  try {
    const r = await fetchFeed(url, null, null);
    if (r.status === "ok") return r.body;
  } catch (e) {
    // Some sites block non-browser agents on their pages; retry like a browser once.
    try {
      return await fetchPage(url, 15_000);
    } catch {
      throw new DiscoverError(e instanceof FetchError ? e.message : "Network error");
    }
  }
  throw new DiscoverError("No content");
}

/** Fetch a URL and confirm it's an RSS/Atom feed. */
export async function checkFeed(url: string, fallbackTitle?: string | null): Promise<FoundFeed> {
  const f = asFeed(url, await getBody(url), fallbackTitle);
  if (!f) throw new DiscoverError("That address isn't an RSS or Atom feed");
  return f;
}

async function firstWorking(urls: string[]): Promise<FoundFeed | null> {
  for (const u of urls) {
    try {
      return await checkFeed(u);
    } catch {
      // try the next one
    }
  }
  return null;
}

/**
 * Resolve what the user typed: a feed URL is checked directly; a web page is searched for the
 * feeds it advertises (or common feed paths). Several feeds → the user picks one.
 */
export async function findFeeds(input: string): Promise<FindResult> {
  const url = normalizeUrlInput(input);
  if (!url) throw new DiscoverError("Enter a web address, like example.com");
  const body = await getBody(url);

  const direct = asFeed(url, body);
  if (direct) return { kind: "feed", feed: direct };
  if (!looksLikeHtml(body)) throw new DiscoverError("That address isn't a feed or a web page");

  const links = discoverFeedLinks(body, url).slice(0, 8);
  if (!links.length) {
    const guessed = await firstWorking(guessFeedUrls(url));
    if (guessed) return { kind: "feed", feed: { ...guessed, siteUrl: guessed.siteUrl ?? url } };
    throw new DiscoverError("No feed found on that page");
  }

  const checked = await Promise.all(links.map((l) => checkFeed(l.url, l.title).catch(() => null)));
  const feeds = checked
    .filter((f): f is FoundFeed => !!f)
    .map((f) => ({ ...f, siteUrl: f.siteUrl ?? url }));
  if (!feeds.length) throw new DiscoverError("The page lists a feed, but it couldn't be loaded");
  return feeds.length === 1 ? { kind: "feed", feed: feeds[0]! } : { kind: "choices", feeds };
}
