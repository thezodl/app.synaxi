import { XMLParser } from "fast-xml-parser";

import { hashString, htmlToText, resolveUrl } from "../text";
import type { ParsedEntry, ParsedFeed } from "./types";

type Node = Record<string, unknown>;

const ARRAY_TAGS = new Set([
  "item",
  "entry",
  "link",
  "media:content",
  "media:thumbnail",
  "enclosure",
  "author",
  "category",
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  removeNSPrefix: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  isArray: (name) => ARRAY_TAGS.has(name),
});

/** Text content of a node that may be a string, number, or {#text, @_attrs}. */
function text(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object") return text((v as Node)["#text"]);
  return null;
}

function attr(v: unknown, name: string): string | null {
  if (!v || typeof v !== "object") return null;
  const a = (v as Node)[`@_${name}`];
  return typeof a === "string" ? a : null;
}

function arr(v: unknown): unknown[] {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}

function date(...vals: unknown[]): number | null {
  for (const v of vals) {
    const s = text(v);
    if (!s) continue;
    const t = Date.parse(s);
    if (Number.isFinite(t)) return t;
  }
  return null;
}

function firstImgSrc(html: string, base: string | null): string | null {
  const m = /<img\b[^>]*?\s(?:data-src|src)\s*=\s*["']([^"']+)["']/i.exec(html);
  return m ? resolveUrl(m[1], base) : null;
}

function mediaThumbnail(item: Node, base: string | null): string | null {
  const group = item["media:group"] as Node | undefined;
  if (group) {
    const g = mediaThumbnail(group, base);
    if (g) return g;
  }
  for (const t of arr(item["media:thumbnail"])) {
    const u = attr(t, "url");
    if (u) return resolveUrl(u, base);
  }
  for (const c of arr(item["media:content"])) {
    const type = attr(c, "type") ?? "";
    const medium = attr(c, "medium") ?? "";
    const u = attr(c, "url");
    if (
      u &&
      (medium === "image" ||
        type.startsWith("image/") ||
        /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(u))
    ) {
      return resolveUrl(u, base);
    }
    const nested = (c as Node)?.["media:thumbnail"];
    const nu = attr(arr(nested)[0], "url");
    if (nu) return resolveUrl(nu, base);
  }
  for (const e of arr(item["enclosure"])) {
    const type = attr(e, "type") ?? "";
    const u = attr(e, "url");
    if (u && type.startsWith("image/")) return resolveUrl(u, base);
  }
  return null;
}

function cleanTitle(t: string | null): string {
  return t ? htmlToText(t) : "";
}

function finishEntry(e: Omit<ParsedEntry, "guid"> & { guid: string | null }): ParsedEntry {
  const guid = e.guid ?? e.url ?? `hash:${hashString(`${e.title}|${e.publishedAt ?? ""}`)}`;
  const title = e.title || (e.html ? htmlToText(e.html).slice(0, 80) : "") || "(untitled)";
  return { ...e, guid, title };
}

function parseRssItems(items: unknown[], base: string | null): ParsedEntry[] {
  return items.map((raw) => {
    const item = raw as Node;
    const url = resolveUrl(text(item.link) ?? attr(arr(item.link)[0], "href"), base);
    const guidNode = item.guid;
    const html = text(item["content:encoded"]) ?? text(item.description) ?? "";
    const authors = arr(item.author);
    return finishEntry({
      guid: text(guidNode),
      url,
      title: cleanTitle(text(item.title)),
      author: text(item["dc:creator"]) ?? text(authors[0]),
      publishedAt: date(item.pubDate, item["dc:date"], item.published, item.updated),
      html,
      thumbnailUrl: mediaThumbnail(item, url ?? base) ?? firstImgSrc(html, url ?? base),
    });
  });
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

/**
 * YouTube channel feeds carry no HTML body: build one from the video id
 * (an embed the sanitiser turns into a poster/player) and media:description.
 */
function mediaBody(entry: Node): string | null {
  const group = entry["media:group"] as Node | undefined;
  const videoId = text(entry["yt:videoId"]);
  const description = text(group?.["media:description"]) ?? text(entry["media:description"]);
  if (!videoId && !description) return null;
  const parts: string[] = [];
  if (videoId)
    parts.push(
      `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}"></iframe>`,
    );
  if (description) {
    parts.push(
      ...description.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`),
    );
  }
  return parts.join("");
}

function atomLink(links: unknown[], rel: string): string | null {
  for (const l of links) {
    const r = attr(l, "rel") ?? "alternate";
    const type = attr(l, "type") ?? "text/html";
    if (r === rel && (rel !== "alternate" || type.includes("html"))) return attr(l, "href");
  }
  return null;
}

function parseAtom(feed: Node): ParsedFeed {
  const feedLinks = arr(feed.link);
  const siteUrl = atomLink(feedLinks, "alternate");
  const entries = arr(feed.entry).map((raw) => {
    const entry = raw as Node;
    const links = arr(entry.link);
    const url = resolveUrl(atomLink(links, "alternate") ?? attr(links[0], "href"), siteUrl);
    const html = text(entry.content) ?? text(entry.summary) ?? mediaBody(entry) ?? "";
    const author = arr(entry.author)[0] as Node | undefined;
    return finishEntry({
      guid: text(entry.id),
      url,
      title: cleanTitle(text(entry.title)),
      author: author ? text(author.name) : null,
      publishedAt: date(entry.published, entry.updated, entry.issued),
      html,
      thumbnailUrl: mediaThumbnail(entry, url ?? siteUrl) ?? firstImgSrc(html, url ?? siteUrl),
    });
  });
  return { title: cleanTitle(text(feed.title)) || null, siteUrl, entries };
}

/** Parse RSS 2.0, RSS 1.0 (RDF) or Atom into a normalised feed. Throws on non-feed XML. */
export function parseFeed(xml: string): ParsedFeed {
  const doc = parser.parse(xml) as Node;

  if (doc.rss) {
    const channel = ((doc.rss as Node).channel ?? {}) as Node;
    const siteUrl = text(channel.link) ?? attr(arr(channel.link)[0], "href");
    return {
      title: cleanTitle(text(channel.title)) || null,
      siteUrl,
      entries: parseRssItems(arr(channel.item), siteUrl),
    };
  }
  if (doc.feed) return parseAtom(doc.feed as Node);
  const rdf = doc["rdf:RDF"] as Node | undefined;
  if (rdf) {
    const channel = (rdf.channel ?? {}) as Node;
    const siteUrl = text(channel.link);
    return {
      title: cleanTitle(text(channel.title)) || null,
      siteUrl,
      entries: parseRssItems(arr(rdf.item), siteUrl),
    };
  }
  throw new Error("Not an RSS, Atom or RDF feed");
}
