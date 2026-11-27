import "server-only";

import { and, desc, eq, gte, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";

import { groupCarousels } from "@/core/extract/carousel";
import { extractFromPage, needsFullPage, prepareArticle } from "@/core/extract/pipeline";
import { sanitizeArticleHtml } from "@/core/extract/sanitize";
import { isFullText } from "@/core/feeds/fulltext";
import type { ParsedEntry } from "@/core/feeds/types";
import { isIngestable, retentionCutoff } from "@/core/retention";
import { excerpt } from "@/core/text";
import type { View } from "@/core/views";

import { db } from "./db";
import { articles, feeds } from "./db/schema";
import { FetchError, fetchPage } from "./http";

/** Don't retry a failed full-page extraction for this long. */
const EXTRACT_RETRY_MS = 6 * 60 * 60_000;
export const PAGE_SIZE = 50;

export interface ArticleListItem {
  id: string;
  feedId: string;
  feedTitle: string;
  siteUrl: string | null;
  title: string;
  url: string | null;
  sortAt: number;
  excerpt: string;
  thumbnailUrl: string | null;
  bookmarkedAt: number | null;
}

export interface ArticleDetail extends ArticleListItem {
  author: string | null;
  publishedAt: number | null;
  /** Sanitised body to show. */
  html: string;
  /** Where `html` came from. */
  source: "rss" | "extracted";
  /** The other version, for the view-original toggle (null when there's only one). */
  altHtml: string | null;
}

const listCols = {
  id: articles.id,
  feedId: articles.feedId,
  feedTitle: feeds.title,
  siteUrl: feeds.siteUrl,
  title: articles.title,
  url: articles.url,
  sortAt: articles.sortAt,
  excerpt: articles.excerpt,
  thumbnailUrl: articles.thumbnailUrl,
  bookmarkedAt: articles.bookmarkedAt,
};

type ListRow = { [K in keyof typeof listCols]: unknown } & {
  sortAt: Date;
  bookmarkedAt: Date | null;
};

function toItem(r: ListRow): ArticleListItem {
  return {
    ...(r as unknown as ArticleListItem),
    sortAt: r.sortAt.getTime(),
    bookmarkedAt: r.bookmarkedAt?.getTime() ?? null,
  };
}

/** Opaque keyset cursor: `<ms>_<uuid>` of the last row's sort key. */
export function encodeCursor(ms: number, id: string): string {
  return `${ms}_${id}`;
}
function decodeCursor(c: string | null): { at: Date; id: string } | null {
  const m = /^(\d+)_([0-9a-f-]{36})$/i.exec(c ?? "");
  return m ? { at: new Date(Number(m[1])), id: m[2]! } : null;
}

export async function listArticles(
  view: View,
  opts: { cursor: string | null; todayStart: number | null; limit?: number },
): Promise<{ items: ArticleListItem[]; nextCursor: string | null }> {
  const size = opts.limit ?? PAGE_SIZE;
  const bookmarks = view.kind === "bookmarks";
  const key = bookmarks ? articles.bookmarkedAt : articles.sortAt;
  const where: (SQL | undefined)[] = [];

  switch (view.kind) {
    case "bookmarks":
      // Bookmarks include articles kept from unfollowed feeds; other views hide those feeds.
      where.push(isNotNull(articles.bookmarkedAt));
      break;
    case "today":
      where.push(gte(articles.sortAt, new Date(opts.todayStart ?? Date.now() - 86_400_000)));
      break;
    case "folder":
      where.push(eq(feeds.folderId, view.id));
      break;
    case "feed":
      where.push(eq(articles.feedId, view.id));
      break;
  }
  if (!bookmarks) where.push(isNull(feeds.removedAt));

  const cursor = decodeCursor(opts.cursor);
  if (cursor) {
    where.push(or(lt(key, cursor.at), and(eq(key, cursor.at), lt(articles.id, cursor.id))));
  }

  const rows = (await db()
    .select(listCols)
    .from(articles)
    .innerJoin(feeds, eq(feeds.id, articles.feedId))
    .where(and(...where))
    .orderBy(desc(key), desc(articles.id))
    .limit(size + 1)) as ListRow[];

  const page = rows.slice(0, size).map(toItem);
  const last = page.at(-1);
  const nextCursor =
    rows.length > size && last
      ? encodeCursor((bookmarks ? last.bookmarkedAt : last.sortAt)!, last.id)
      : null;
  return { items: page, nextCursor };
}

/** Insert new entries for a feed; existing (feed, guid) pairs are left alone. Returns count added. */
export async function insertEntries(feedId: string, entries: ParsedEntry[]): Promise<number> {
  const now = new Date();
  const values = entries
    .filter((e) => isIngestable(e.publishedAt, now.getTime()))
    .map((e) => ({
      feedId,
      guid: e.guid,
      url: e.url,
      title: e.title,
      author: e.author,
      publishedAt: e.publishedAt != null ? new Date(e.publishedAt) : null,
      fetchedAt: now,
      // Clamp future dates so mis-dated posts don't pin themselves to the top.
      sortAt: new Date(Math.min(e.publishedAt ?? now.getTime(), now.getTime())),
      excerpt: excerpt(e.html),
      rssHtml: e.html,
      isFullText: isFullText(e.html),
      thumbnailUrl: e.thumbnailUrl,
    }));

  let added = 0;
  // Chunked: bodies can be large and the HTTP driver sends one request per statement.
  for (let i = 0; i < values.length; i += 25) {
    const rows = await db()
      .insert(articles)
      .values(values.slice(i, i + 25))
      .onConflictDoNothing({ target: [articles.feedId, articles.guid] })
      .returning({ id: articles.id });
    added += rows.length;
  }
  return added;
}

async function loadArticle(id: string) {
  const [row] = await db()
    .select({
      ...listCols,
      author: articles.author,
      publishedAt: articles.publishedAt,
      rssHtml: articles.rssHtml,
      isFullText: articles.isFullText,
      extractedHtml: articles.extractedHtml,
      extractFailedAt: articles.extractFailedAt,
    })
    .from(articles)
    .innerJoin(feeds, eq(feeds.id, articles.feedId))
    .where(eq(articles.id, id));
  return row ?? null;
}

/**
 * Fetch + extract the full page when the RSS only has a summary. Idempotent; HTTP errors
 * (paywall, 403) are recorded and not retried for a while; network drops retry next open.
 */
export async function ensureExtracted(id: string): Promise<void> {
  const a = await loadArticle(id);
  if (!a || !needsFullPage(a)) return;
  if (a.extractFailedAt && Date.now() - a.extractFailedAt.getTime() < EXTRACT_RETRY_MS) return;

  let html: string | null;
  try {
    html = extractFromPage(await fetchPage(a.url!), a.url!);
  } catch (e) {
    if (!(e instanceof FetchError) || !e.message.startsWith("HTTP")) return;
    html = null;
  }
  await db()
    .update(articles)
    .set(
      html
        ? { extractedHtml: html, extractedAt: new Date(), extractFailedAt: null }
        : { extractFailedAt: new Date() },
    )
    .where(eq(articles.id, id));
}

export async function getArticle(id: string): Promise<ArticleDetail | null> {
  await ensureExtracted(id);
  const a = await loadArticle(id);
  if (!a) return null;

  const usingExtracted = !a.isFullText && !!a.extractedHtml;
  const html = groupCarousels(prepareArticle(a).html);
  const altHtml = usingExtracted
    ? groupCarousels(sanitizeArticleHtml(a.rssHtml, a.url, { author: a.author }).html)
    : null;
  return {
    ...toItem(a as unknown as ListRow),
    author: a.author,
    publishedAt: a.publishedAt?.getTime() ?? null,
    html,
    source: usingExtracted ? "extracted" : "rss",
    altHtml,
  };
}

/** Bookmark (optionally restoring an earlier timestamp, for Undo) or clear a bookmark. */
export async function setBookmarked(id: string, on: boolean, restoreAt?: number) {
  const rows = await db()
    .update(articles)
    .set(
      on
        ? { bookmarkedAt: new Date(restoreAt ?? Date.now()), bookmarkClearedAt: null }
        : { bookmarkedAt: null, bookmarkClearedAt: new Date() },
    )
    .where(eq(articles.id, id))
    .returning({ bookmarkedAt: articles.bookmarkedAt });
  return rows[0] ? { bookmarkedAt: rows[0].bookmarkedAt?.getTime() ?? null } : null;
}

/** Mirror of core/retention.isPurgeable. Returns the number of articles deleted. */
export async function purgeExpired(now = Date.now()): Promise<number> {
  const cutoff = new Date(retentionCutoff(now));
  const rows = await db()
    .delete(articles)
    .where(
      and(
        isNull(articles.bookmarkedAt),
        sql`coalesce(${articles.bookmarkClearedAt}, ${articles.publishedAt}, ${articles.fetchedAt}) < ${cutoff}`,
      ),
    )
    .returning({ id: articles.id });
  return rows.length;
}
