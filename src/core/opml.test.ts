import { expect, test } from "bun:test";
import { FEEDLY_OPML } from "./__fixtures__/feeds";
import { parseOpml } from "./opml";

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
