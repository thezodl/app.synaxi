import "server-only";

import { eq, sql } from "drizzle-orm";

import { parseFeed } from "@/core/feeds/parse";
import { mapPool } from "@/core/pool";

import { insertEntries } from "./articles";
import { db } from "./db";
import { settings } from "./db/schema";
import { listFeedsForSync, updateFetchState } from "./feeds";
import { FetchError, fetchFeed } from "./http";
import { assertKeyMatchesDb, openUrl } from "./keys";

const CONCURRENCY = 6;
/** Skip automatic (on-open) syncs if we synced this recently. Manual refresh always runs. */
const AUTO_SYNC_MIN_INTERVAL = 15 * 60_000;
/** A crashed sync releases its lease after this long. Longer than the function's max duration. */
const LEASE_MS = 6 * 60_000;

export interface SyncState {
  lastStartedAt: number | null;
  lastFinishedAt: number | null;
  lastAdded: number;
  failedFeeds: number;
  totalFeeds: number;
}

const EMPTY: SyncState = {
  lastStartedAt: null,
  lastFinishedAt: null,
  lastAdded: 0,
  failedFeeds: 0,
  totalFeeds: 0,
};

export async function getSyncState(): Promise<SyncState> {
  const [row] = await db().select().from(settings).where(eq(settings.key, "sync"));
  return { ...EMPTY, ...(row?.value as Partial<SyncState> | undefined) };
}

async function saveSyncState(s: SyncState) {
  await db()
    .insert(settings)
    .values({ key: "sync", value: s })
    .onConflictDoUpdate({ target: settings.key, set: { value: s, updatedAt: new Date() } });
}

/**
 * Claim the sync lease atomically: one statement, so it works on the stateless HTTP driver
 * (session advisory locks don't). Returns false if another sync holds it.
 */
async function acquireLease(now: number): Promise<boolean> {
  const value = { until: now + LEASE_MS };
  const rows = await db()
    .insert(settings)
    .values({ key: "sync_lease", value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
      setWhere: sql`(${settings.value}->>'until')::bigint < ${now}`,
    })
    .returning({ key: settings.key });
  return rows.length > 0;
}

async function releaseLease() {
  await db()
    .update(settings)
    .set({ value: { until: 0 }, updatedAt: new Date() })
    .where(eq(settings.key, "sync_lease"));
}

export type SyncResult =
  | { status: "skipped"; reason: "recent" | "running"; state: SyncState }
  | { status: "done"; state: SyncState };

/** Fetch every followed feed and store new entries. */
export async function syncAll(opts: { auto?: boolean } = {}): Promise<SyncResult> {
  await assertKeyMatchesDb();
  const now = Date.now();
  const prev = await getSyncState();
  if (opts.auto && prev.lastFinishedAt && now - prev.lastFinishedAt < AUTO_SYNC_MIN_INTERVAL) {
    return { status: "skipped", reason: "recent", state: prev };
  }
  if (!(await acquireLease(now))) return { status: "skipped", reason: "running", state: prev };

  try {
    const list = await listFeedsForSync();
    let added = 0;
    let failed = 0;
    await mapPool(list, CONCURRENCY, async (feed) => {
      try {
        const r = await fetchFeed(openUrl(feed.urlEnc), feed.etag, feed.lastModified);
        if (r.status === "not-modified") {
          await updateFetchState(feed.id, { error: null });
          return;
        }
        let parsed;
        try {
          parsed = parseFeed(r.body);
        } catch {
          throw new FetchError("Not a feed");
        }
        added += await insertEntries(feed.id, parsed.entries);
        await updateFetchState(feed.id, {
          etag: r.etag,
          lastModified: r.lastModified,
          siteUrl: parsed.siteUrl,
          error: null,
        });
      } catch (e) {
        failed++;
        // FetchError messages are URL-free by construction; anything else gets a generic label.
        await updateFetchState(feed.id, {
          error: e instanceof FetchError ? e.message : "Failed",
        }).catch(() => undefined);
      }
    });
    const state: SyncState = {
      lastStartedAt: now,
      lastFinishedAt: Date.now(),
      lastAdded: added,
      failedFeeds: failed,
      totalFeeds: list.length,
    };
    await saveSyncState(state);
    return { status: "done", state };
  } finally {
    await releaseLease();
  }
}
