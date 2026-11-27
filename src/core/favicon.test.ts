import { expect, test } from "bun:test";
import { faviconCandidates } from "./favicon";

test("uses the site host, falling back to the feed host", () => {
  expect(faviconCandidates("https://www.example.com/blog/", "https://feeds.example.net/a")).toEqual(
    ["https://www.example.com/favicon.ico", "https://icons.duckduckgo.com/ip3/www.example.com.ico"],
  );
  expect(faviconCandidates(null, "http://feeds.example.net/rss?token=secret")[0]).toBe(
    "https://feeds.example.net/favicon.ico",
  );
});

test("never includes the feed path or query", () => {
  for (const u of faviconCandidates(null, "https://example.org/private/abc123?key=secret"))
    expect(u).not.toMatch(/abc123|secret/);
});

test("returns nothing for unusable URLs", () => {
  expect(faviconCandidates(null, "not a url")).toEqual([]);
  expect(faviconCandidates("javascript:alert(1)", "file:///x")).toEqual([]);
});
