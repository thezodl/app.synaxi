import "server-only";

import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import type { OpmlFeed } from "@/core/opml";

import { db } from "./db";
import { feeds, folders } from "./db/schema";
import { sealUrl } from "./keys";

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

/** Feeds to sync (followed ones), with what conditional GET needs. */
export function listFeedsForSync() {
  return db()
    .select({
      id: feeds.id,
      urlEnc: feeds.urlEnc,
      etag: feeds.etag,
      lastModified: feeds.lastModified,
    })
    .from(feeds)
    .where(isNull(feeds.removedAt));
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
