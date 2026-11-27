import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

/**
 * Shared columns. Every table has a UUIDv7 id (generated in the app, so a future mobile client can
 * create rows offline) and an updated_at that later delta sync can pull from.
 */
export const id = () =>
  uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7());

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const timestamps = {
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Key/value settings (typography, sync state, sync lease). */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  ...timestamps,
});

export const folders = pgTable("folders", {
  id: id(),
  name: text("name").notNull().unique(),
  position: integer("position").notNull().default(0),
  ...timestamps,
});

export const feeds = pgTable(
  "feeds",
  {
    id: id(),
    /** AES-256-GCM ciphertext of the feed URL (may contain a private token). See server/crypto.ts. */
    urlEnc: text("url_enc").notNull(),
    /** HMAC of the normalised URL: uniqueness and dedupe without decrypting. */
    urlHmac: text("url_hmac").notNull().unique(),
    title: text("title").notNull(),
    siteUrl: text("site_url"),
    folderId: uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    etag: text("etag"),
    lastModified: text("last_modified"),
    lastFetchedAt: ts("last_fetched_at"),
    /** Short, URL-free message ("HTTP 404", "Timed out", "Not a feed"). */
    lastError: text("last_error"),
    /** Unfollowed, but kept while it still has bookmarked articles (like mobile). */
    removedAt: ts("removed_at"),
    ...timestamps,
  },
  (t) => [index("feeds_folder").on(t.folderId)],
);

export const articles = pgTable(
  "articles",
  {
    id: id(),
    feedId: uuid("feed_id")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    guid: text("guid").notNull(),
    url: text("url"),
    title: text("title").notNull(),
    author: text("author"),
    publishedAt: ts("published_at"),
    fetchedAt: ts("fetched_at").notNull(),
    /** min(publishedAt ?? fetchedAt, fetchedAt): what lists sort by. */
    sortAt: ts("sort_at").notNull(),
    excerpt: text("excerpt").notNull(),
    /** Raw RSS body; sanitised on read so improved rules apply to old articles too. */
    rssHtml: text("rss_html").notNull(),
    isFullText: boolean("is_full_text").notNull(),
    /** Raw Readability output for summary-only feeds. Also sanitised on read. */
    extractedHtml: text("extracted_html"),
    extractedAt: ts("extracted_at"),
    extractFailedAt: ts("extract_failed_at"),
    thumbnailUrl: text("thumbnail_url"),
    bookmarkedAt: ts("bookmarked_at"),
    bookmarkClearedAt: ts("bookmark_cleared_at"),
    ...timestamps,
  },
  (t) => [
    unique("articles_feed_guid").on(t.feedId, t.guid),
    index("articles_sort").on(t.sortAt.desc(), t.id.desc()),
    index("articles_feed_sort").on(t.feedId, t.sortAt.desc(), t.id.desc()),
    index("articles_bookmarked")
      .on(t.bookmarkedAt.desc(), t.id.desc())
      .where(sql`${t.bookmarkedAt} IS NOT NULL`),
  ],
);

export type FeedRow = typeof feeds.$inferSelect;
export type ArticleRow = typeof articles.$inferSelect;
