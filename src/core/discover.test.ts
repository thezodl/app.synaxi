import { describe, expect, it } from "bun:test";
import { discoverFeedLinks, guessFeedUrls, looksLikeHtml, normalizeUrlInput } from "./discover";

describe("normalizeUrlInput", () => {
  it("adds https to bare hosts", () => {
    expect(normalizeUrlInput("  example.com/blog ")).toBe("https://example.com/blog");
  });
  it("keeps http(s) URLs", () => {
    expect(normalizeUrlInput("http://example.com/rss?k=1")).toBe("http://example.com/rss?k=1");
    expect(normalizeUrlInput("https://example.com")).toBe("https://example.com/");
  });
  it("handles feed: scheme", () => {
    expect(normalizeUrlInput("feed://example.com/rss")).toBe("https://example.com/rss");
    expect(normalizeUrlInput("feed:https://example.com/rss")).toBe("https://example.com/rss");
  });
  it("rejects junk", () => {
    expect(normalizeUrlInput("")).toBeNull();
    expect(normalizeUrlInput("not a url")).toBeNull();
    expect(normalizeUrlInput("ftp://example.com/")).toBeNull();
    expect(normalizeUrlInput("javascript:alert(1)")).toBeNull();
    expect(normalizeUrlInput("hello")).toBeNull();
  });
});

describe("discoverFeedLinks", () => {
  const page = "https://example.com/blog/post";

  it("finds rss and atom alternates in any attribute order", () => {
    const html = `<html><head>
      <link rel="stylesheet" href="/s.css">
      <link type="application/rss+xml" title="Posts" rel="alternate" href="/feed/">
      <link rel='alternate' type='application/atom+xml' href='https://example.com/atom.xml'>
      <link rel="alternate" type="text/html" href="/other">
    </head></html>`;
    expect(discoverFeedLinks(html, page)).toEqual([
      { url: "https://example.com/feed/", title: "Posts" },
      { url: "https://example.com/atom.xml", title: null },
    ]);
  });

  it("resolves against <base>, decodes entities and drops duplicates", () => {
    const html = `<base href="https://cdn.example.org/site/">
      <link rel="alternate" type="application/rss+xml" href="rss?a=1&amp;b=2">
      <link rel="alternate" type="application/rss+xml" href="rss?a=1&amp;b=2">`;
    expect(discoverFeedLinks(html, page)).toEqual([
      { url: "https://cdn.example.org/site/rss?a=1&b=2", title: null },
    ]);
  });

  it("lists comment feeds last", () => {
    const html = `
      <link rel="alternate" type="application/rss+xml" title="Comments Feed" href="/comments/feed/">
      <link rel="alternate" type="application/rss+xml" title="Feed" href="/feed/">`;
    expect(discoverFeedLinks(html, page).map((f) => f.title)).toEqual(["Feed", "Comments Feed"]);
  });

  it("ignores non-http hrefs", () => {
    const html = `<link rel="alternate" type="application/rss+xml" href="javascript:x">`;
    expect(discoverFeedLinks(html, page)).toEqual([]);
  });
});

describe("guessFeedUrls", () => {
  it("builds common paths on the origin", () => {
    expect(guessFeedUrls("https://example.com/a/b")[0]).toBe("https://example.com/feed");
  });
});

describe("looksLikeHtml", () => {
  it("tells pages from feeds", () => {
    expect(looksLikeHtml("<!DOCTYPE html><html>")).toBe(true);
    expect(looksLikeHtml('  <!-- x --><html lang="en">')).toBe(true);
    expect(looksLikeHtml('<?xml version="1.0"?><rss>')).toBe(false);
  });
});
