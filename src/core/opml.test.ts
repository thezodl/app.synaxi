import { expect, test } from "bun:test";
import { FEEDLY_OPML } from "./__fixtures__/feeds";
import { buildOpml, parseOpml } from "./opml";

test("parses a Feedly OPML export, flattening nested folders and deduping", () => {
  const feeds = parseOpml(FEEDLY_OPML);
  expect(feeds).toEqual([
    {
      url: "https://www.theverge.com/rss/index.xml",
      title: "The Verge",
      siteUrl: "https://www.theverge.com",
      folder: "Tech",
    },
    { url: "https://deep.example/feed", title: "Deep", siteUrl: null, folder: "Tech" },
    {
      url: "https://priv.example/feed?key=s3cret",
      title: "Secret",
      siteUrl: "https://priv.example",
      folder: "Private",
    },
    { url: "https://loose.example/rss", title: "Loose", siteUrl: null, folder: null },
  ]);
});

test("rejects non-OPML", () => {
  expect(() => parseOpml("<rss></rss>")).toThrow("Not an OPML file");
});

test("buildOpml round-trips through parseOpml, escaping attributes", () => {
  const feeds = [
    {
      url: "https://a.example/feed?x=1&y=2",
      title: 'A & "B"',
      siteUrl: "https://a.example",
      folder: "Tech <News>",
    },
    { url: "https://b.example/rss", title: "B", siteUrl: null, folder: null },
  ];
  const xml = buildOpml(feeds, ["Empty", "Tech <News>"]);
  expect(xml).toContain('xmlUrl="https://a.example/feed?x=1&amp;y=2"');
  expect(parseOpml(xml)).toEqual(feeds);
  expect(xml).toContain('<outline text="Empty" title="Empty"/>');
  // Folder order follows the given list.
  expect(xml.indexOf("Empty")).toBeLessThan(xml.indexOf("Tech &lt;News&gt;"));
});

test("buildOpml round-trips the Feedly fixture", () => {
  const feeds = parseOpml(FEEDLY_OPML);
  expect(parseOpml(buildOpml(feeds))).toEqual(feeds);
});
