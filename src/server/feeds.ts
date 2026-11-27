import "server-only";

import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import type { OpmlFeed } from "@/core/opml";

import { db } from "./db";
import { UserError } from "./errors";
import { articles, feeds, folders } from "./db/schema";
import { assertKeyMatchesDb, hmacUrl, openUrl, sealUrl } from "./keys";

export interface FolderDto {
  id: string;
  name: string;
}

/** What the browser sees about a feed. Never the URL. */
export interface FeedDto {
  id: string;
  title: string;
  folderId: string | null;
  siteUrl: string | null;
  lastFetchedAt: number | null;
  lastError: string | null;
}

export async function listTree(): Promise<{ folders: FolderDto[]; feeds: FeedDto[] }> {
  const [fs, fds] = await Promise.all([
    db()
      .select({ id: folders.id, name: folders.name })
      .from(folders)
      .orderBy(asc(folders.position), sql`lower(${folders.name})`),
    db()
      .select({
        id: feeds.id,
        title: feeds.title,
        folderId: feeds.folderId,
        siteUrl: feeds.siteUrl,
        lastFetchedAt: feeds.lastFetchedAt,
        lastError: feeds.lastError,
      })
      .from(feeds)
      .where(isNull(feeds.removedAt))
      .orderBy(asc(feeds.position), sql`lower(${feeds.title})`),
  ]);
  return {
    folders: fs,
    feeds: fds.map((f) => ({ ...f, lastFetchedAt: f.lastFetchedAt?.getTime() ?? null })),
  };
}

/** Feeds to sync (followed ones, or just one), with what conditional GET needs. */
export function listFeedsForSync(onlyId?: string) {
  return db()
    .select({
      id: feeds.id,
      urlEnc: feeds.urlEnc,
      etag: feeds.etag,
      lastModified: feeds.lastModified,
      lastFetchedAt: feeds.lastFetchedAt,
    })
    .from(feeds)
    .where(onlyId ? and(isNull(feeds.removedAt), eq(feeds.id, onlyId)) : isNull(feeds.removedAt));
}

export async function updateFetchState(
  id: string,
  s: {
    etag?: string | null;
    lastModified?: string | null;
    siteUrl?: string | null;
    error: string | null;
  },
) {
  await db()
    .update(feeds)
    .set({
      ...(s.etag !== undefined && { etag: s.etag }),
      ...(s.lastModified !== undefined && { lastModified: s.lastModified }),
      ...(s.siteUrl && { siteUrl: sql`coalesce(${feeds.siteUrl}, ${s.siteUrl})` }),
      lastFetchedAt: new Date(),
      lastError: s.error,
    })
    .where(eq(feeds.id, id));
}

/**
 * Insert OPML feeds, creating folders as needed. Feeds already followed are left alone; feeds
 * that were unfollowed (but kept for their bookmarks) are followed again. Mirrors mobile.
 */
export async function importFeeds(list: OpmlFeed[]): Promise<{ added: number; skipped: number }> {
  if (!list.length) return { added: 0, skipped: 0 };
  await assertKeyMatchesDb();

  const names = [...new Set(list.map((f) => f.folder).filter((n): n is string => !!n))];
  const folderIds = new Map<string, string>();
  if (names.length) {
    await db()
      .insert(folders)
      .values(names.map((name) => ({ name })))
      .onConflictDoNothing({ target: folders.name });
    const rows = await db()
      .select({ id: folders.id, name: folders.name })
      .from(folders)
      .where(inArray(folders.name, names));
    for (const r of rows) folderIds.set(r.name, r.id);
  }

  const values = list.map((f) => ({
    ...sealUrl(f.url),
    title: f.title,
    siteUrl: f.siteUrl,
    folderId: f.folder ? (folderIds.get(f.folder) ?? null) : null,
  }));

  let added = 0;
  for (let i = 0; i < values.length; i += 100) {
    const rows = await db()
      .insert(feeds)
      .values(values.slice(i, i + 100))
      .onConflictDoUpdate({
        target: feeds.urlHmac,
        // Revive an unfollowed feed; followed ones match nothing here and aren't returned.
        set: {
          removedAt: null,
          title: sql`excluded.title`,
          siteUrl: sql`coalesce(excluded.site_url, ${feeds.siteUrl})`,
          folderId: sql`excluded.folder_id`,
          etag: null,
          lastModified: null,
          lastError: null,
        },
        setWhere: isNotNull(feeds.removedAt),
      })
      .returning({ id: feeds.id });
    added += rows.length;
  }
  return { added, skipped: list.length - added };
}

/** Feeds that are gone and have no articles left (bookmarks kept them around). */
export async function deleteOrphanedRemovedFeeds() {
  await db()
    .delete(feeds)
    .where(
      and(
        isNotNull(feeds.removedAt),
        sql`not exists (select 1 from articles a where a.feed_id = ${feeds.id})`,
      ),
    );
}

/** A user-facing error (409/400/404), never containing a URL. */
export class FeedError extends UserError {}

async function folderExists(id: string) {
  const [r] = await db().select({ id: folders.id }).from(folders).where(eq(folders.id, id));
  return !!r;
}

/**
 * Follow a feed found by discovery. Reviving an unfollowed feed (kept for its bookmarks) counts as
 * adding it. Throws FeedError 409 if it's already followed.
 */
export async function addFeed(f: {
  url: string;
  title: string;
  siteUrl: string | null;
  folderId: string | null;
}): Promise<string> {
  await assertKeyMatchesDb();
  if (f.folderId && !(await folderExists(f.folderId))) throw new FeedError("No such folder", 404);
  const rows = await db()
    .insert(feeds)
    .values({ ...sealUrl(f.url), title: f.title, siteUrl: f.siteUrl, folderId: f.folderId })
    .onConflictDoUpdate({
      target: feeds.urlHmac,
      set: {
        removedAt: null,
        title: sql`excluded.title`,
        siteUrl: sql`coalesce(excluded.site_url, ${feeds.siteUrl})`,
        folderId: sql`excluded.folder_id`,
        etag: null,
        lastModified: null,
        lastError: null,
      },
      setWhere: isNotNull(feeds.removedAt),
    })
    .returning({ id: feeds.id });
  if (!rows[0]) throw new FeedError("You already follow this feed", 409);
  return rows[0].id;
}

/** Is this URL already followed? (HMAC lookup; no decryption.) */
export async function isFollowed(url: string): Promise<boolean> {
  await assertKeyMatchesDb();
  const [r] = await db()
    .select({ id: feeds.id })
    .from(feeds)
    .where(and(eq(feeds.urlHmac, hmacUrl(url)), isNull(feeds.removedAt)));
  return !!r;
}

export async function updateFeed(id: string, patch: { title?: string; folderId?: string | null }) {
  if (patch.folderId && !(await folderExists(patch.folderId))) {
    throw new FeedError("No such folder", 404);
  }
  const rows = await db()
    .update(feeds)
    .set({
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.folderId !== undefined && { folderId: patch.folderId }),
    })
    .where(and(eq(feeds.id, id), isNull(feeds.removedAt)))
    .returning({ id: feeds.id });
  if (!rows[0]) throw new FeedError("Feed not found", 404);
}

/**
 * Unfollow (mirrors mobile). Articles are deleted except bookmarked ones, which stay in
 * Bookmarks; the feed row stays hidden until they're gone (see deleteOrphanedRemovedFeeds).
 */
export async function removeFeed(id: string): Promise<{ keptBookmarks: number }> {
  const [feed] = await db()
    .select({ id: feeds.id })
    .from(feeds)
    .where(and(eq(feeds.id, id), isNull(feeds.removedAt)));
  if (!feed) throw new FeedError("Feed not found", 404);

  await db()
    .delete(articles)
    .where(and(eq(articles.feedId, id), isNull(articles.bookmarkedAt)));
  const [{ n }] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(articles)
    .where(eq(articles.feedId, id));
  if (n) {
    await db()
      .update(feeds)
      .set({ removedAt: new Date(), folderId: null, etag: null, lastModified: null })
      .where(eq(feeds.id, id));
  } else {
    await db().delete(feeds).where(eq(feeds.id, id));
  }
  return { keptBookmarks: n };
}

export async function createFolder(name: string): Promise<FolderDto> {
  const rows = await db()
    .insert(folders)
    .values({ name })
    .onConflictDoNothing({ target: folders.name })
    .returning({ id: folders.id, name: folders.name });
  if (!rows[0]) throw new FeedError("A folder with that name already exists", 409);
  return rows[0];
}

export async function renameFolder(id: string, name: string) {
  try {
    const rows = await db()
      .update(folders)
      .set({ name })
      .where(eq(folders.id, id))
      .returning({ id: folders.id });
    if (!rows[0]) throw new FeedError("Folder not found", 404);
  } catch (e) {
    if (e instanceof FeedError) throw e;
    // Unique violation on name.
    if ((e as { code?: string; cause?: { code?: string } }).cause?.code === "23505") {
      throw new FeedError("A folder with that name already exists", 409);
    }
    throw e;
  }
}

/** Delete a folder; its feeds become ungrouped (FK ON DELETE SET NULL). */
export async function deleteFolder(id: string) {
  const rows = await db().delete(folders).where(eq(folders.id, id)).returning({ id: folders.id });
  if (!rows[0]) throw new FeedError("Folder not found", 404);
}

/** Everything OPML export needs. The only place feed URLs are decrypted for output. */
export async function listForExport() {
  await assertKeyMatchesDb();
  const [fs, fds] = await Promise.all([
    db()
      .select({ id: folders.id, name: folders.name })
      .from(folders)
      .orderBy(asc(folders.position), sql`lower(${folders.name})`),
    db()
      .select({
        urlEnc: feeds.urlEnc,
        title: feeds.title,
        siteUrl: feeds.siteUrl,
        folderId: feeds.folderId,
      })
      .from(feeds)
      .where(isNull(feeds.removedAt))
      .orderBy(asc(feeds.position), sql`lower(${feeds.title})`),
  ]);
  const names = new Map(fs.map((f) => [f.id, f.name]));
  return {
    folders: fs.map((f) => f.name),
    feeds: fds.map((f) => ({
      url: openUrl(f.urlEnc),
      title: f.title,
      siteUrl: f.siteUrl,
      folder: f.folderId ? (names.get(f.folderId) ?? null) : null,
    })),
  };
}
