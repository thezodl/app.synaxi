import { expect, test } from "bun:test";
import { isIngestable, isPurgeable, retentionCutoff } from "./retention";

const DAY = 86_400_000;
const now = Date.parse("2026-11-15T12:00:00Z");
const base = {
  publishedAt: now - 15 * DAY,
  fetchedAt: now - 15 * DAY,
  bookmarkedAt: null,
  bookmarkClearedAt: null,
};

test("purges articles older than 14 days", () => {
  expect(isPurgeable(base, now)).toBe(true);
  expect(isPurgeable({ ...base, publishedAt: now - 13 * DAY }, now)).toBe(false);
});

test("never purges bookmarks, however old", () => {
  expect(
    isPurgeable({ ...base, publishedAt: now - 400 * DAY, bookmarkedAt: now - 300 * DAY }, now),
  ).toBe(false);
});

test("a cleared bookmark gets a fresh 14-day window", () => {
  expect(
    isPurgeable({ ...base, publishedAt: now - 90 * DAY, bookmarkClearedAt: now - DAY }, now),
  ).toBe(false);
  expect(
    isPurgeable({ ...base, publishedAt: now - 90 * DAY, bookmarkClearedAt: now - 15 * DAY }, now),
  ).toBe(true);
});

test("undated articles age from when they were fetched", () => {
  expect(isPurgeable({ ...base, publishedAt: null, fetchedAt: now - DAY }, now)).toBe(false);
});

test("old feed entries are not ingested; undated ones are", () => {
  expect(isIngestable(retentionCutoff(now) - 1, now)).toBe(false);
  expect(isIngestable(now - DAY, now)).toBe(true);
  expect(isIngestable(null, now)).toBe(true);
});
