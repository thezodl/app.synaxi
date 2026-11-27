import { describe, expect, it } from "bun:test";
import { ATOM, RDF, RSS_FULL, YOUTUBE } from "../__fixtures__/feeds";
import { sanitizeArticleHtml } from "../extract/sanitize";
import { isFullText } from "./fulltext";
import { parseFeed } from "./parse";

describe("parseFeed", () => {
  it("parses RSS 2.0 with content:encoded, media thumbnail and entities", () => {
    const f = parseFeed(RSS_FULL);
    expect(f.title).toBe("Example & Co");
    expect(f.siteUrl).toBe("https://example.com/");
    expect(f.entries).toHaveLength(2);
    const [a, b] = f.entries;
    expect(a!.guid).toBe("abc-123");
    expect(a!.title).toBe("First post");
    expect(a!.author).toBe("Jo Author");
    expect(a!.publishedAt).toBe(Date.parse("2026-11-14T09:30:00Z"));
    expect(a!.html).toContain("word299");
    expect(a!.thumbnailUrl).toBe("https://cdn.example.com/thumb.jpg");
    // Falls back to link as guid, and to the first <img> for thumbnail.
    expect(b!.guid).toBe("https://example.com/second");
    expect(b!.thumbnailUrl).toBe("https://example.com/b.png");
    expect(b!.publishedAt).toBeNull();
  });

  it("parses Atom with relative links resolved against the site", () => {
    const f = parseFeed(ATOM);
    expect(f.title).toBe("Atom Blog");
    expect(f.siteUrl).toBe("https://atom.example/");
    const e = f.entries[0]!;
    expect(e.guid).toBe("tag:atom.example,2026:1");
    expect(e.url).toBe("https://atom.example/posts/1");
    expect(e.author).toBe("Ada");
    expect(e.publishedAt).toBe(Date.parse("2026-11-13T12:00:00Z"));
    expect(e.html).toContain('<img src="pic.jpg">');
    expect(e.thumbnailUrl).toBe("https://atom.example/posts/pic.jpg");
  });

  it("parses RSS 1.0 / RDF", () => {
    const f = parseFeed(RDF);
    expect(f.title).toBe("RDF Feed");
    expect(f.entries[0]!.title).toBe("RDF item");
    expect(f.entries[0]!.publishedAt).toBe(Date.parse("2026-11-12T08:00:00Z"));
  });

  it("builds a body for YouTube channel feeds from media:group", () => {
    const e = parseFeed(YOUTUBE).entries[0]!;
    expect(e.thumbnailUrl).toBe("https://i2.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
    expect(e.html).toContain("<p>Line one &lt;b&gt;<br>Line two</p><p>Second paragraph</p>");
    const { html } = sanitizeArticleHtml(e.html, e.url);
    expect(html).toContain('data-watch="https://www.youtube.com/watch?v=abcdefghijk"');
  });

  it("rejects non-feed XML", () => {
    expect(() => parseFeed("<html><body>nope</body></html>")).toThrow();
  });
});

describe("isFullText", () => {
  it("treats long bodies as full and teasers as summaries", () => {
    const f = parseFeed(RSS_FULL);
    expect(isFullText(f.entries[0]!.html)).toBe(true);
    expect(isFullText(f.entries[1]!.html)).toBe(false);
  });

  it('treats medium bodies ending in "Read more" as summaries', () => {
    const body = `<p>${Array.from({ length: 200 }, () => "text").join(" ")} … Continue reading</p>`;
    expect(isFullText(body)).toBe(false);
  });
});
