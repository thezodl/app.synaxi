export const RETENTION_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

export function retentionCutoff(now: number, days = RETENTION_DAYS): number {
  return now - days * DAY;
}

export interface RetainableArticle {
  publishedAt: number | null;
  fetchedAt: number;
  bookmarkedAt: number | null;
  bookmarkClearedAt: number | null;
}

/**
 * Bookmarked articles are never purged. A cleared bookmark gets a fresh
 * retention window from the moment it was cleared. Everything else ages from
 * its published date (or when we first saw it, if the feed gave no date).
 * Mirrored in SQL by `purgeExpired` in src/server/articles.ts.
 */
export function isPurgeable(a: RetainableArticle, now: number, days = RETENTION_DAYS): boolean {
  if (a.bookmarkedAt != null) return false;
  const age = a.bookmarkClearedAt ?? a.publishedAt ?? a.fetchedAt;
  return age < retentionCutoff(now, days);
}

/** Entries older than the window are not ingested, so purged items don't reappear on sync. */
export function isIngestable(
  publishedAt: number | null,
  now: number,
  days = RETENTION_DAYS,
): boolean {
  return publishedAt == null || publishedAt >= retentionCutoff(now, days);
}
