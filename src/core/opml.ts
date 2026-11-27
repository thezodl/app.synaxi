import { XMLParser } from "fast-xml-parser";

export interface OpmlFeed {
  url: string;
  title: string;
  siteUrl: string | null;
  /** Top-level folder name, or null for ungrouped feeds. */
  folder: string | null;
}

type Outline = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "outline",
});

function a(o: Outline, name: string): string | null {
  const v = o[`@_${name}`];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Parse an OPML export (e.g. from Feedly) into a flat feed list.
 * Nested folders are flattened to their top-level folder; duplicate URLs keep the first.
 */
export function parseOpml(xml: string): OpmlFeed[] {
  const doc = parser.parse(xml) as { opml?: { body?: { outline?: Outline[] } } };
  const top = doc.opml?.body?.outline;
  if (!top) throw new Error("Not an OPML file");

  const out: OpmlFeed[] = [];
  const seen = new Set<string>();

  const walk = (nodes: Outline[], folder: string | null) => {
    for (const o of nodes) {
      const url = a(o, "xmlUrl");
      const title = a(o, "title") ?? a(o, "text");
      if (url) {
        if (!seen.has(url)) {
          seen.add(url);
          out.push({ url, title: title ?? url, siteUrl: a(o, "htmlUrl"), folder });
        }
      } else if (Array.isArray(o.outline)) {
        walk(o.outline as Outline[], folder ?? title);
      }
    }
  };
  walk(top, null);
  return out;
}

function xmlAttr(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
}

function outline(f: OpmlFeed, indent: string): string {
  const t = xmlAttr(f.title);
  const site = f.siteUrl ? ` htmlUrl="${xmlAttr(f.siteUrl)}"` : "";
  return `${indent}<outline type="rss" text="${t}" title="${t}" xmlUrl="${xmlAttr(f.url)}"${site}/>`;
}

/**
 * Serialise feeds as OPML 2.0 (one level of folders, like Feedly). `folders` fixes folder order
 * and lets empty folders survive a round trip. `parseOpml(buildOpml(x))` returns the same feeds.
 */
export function buildOpml(feeds: OpmlFeed[], folders: string[] = [], title = "Synaxi"): string {
  const names = [...new Set([...folders, ...feeds.flatMap((f) => (f.folder ? [f.folder] : []))])];
  const body: string[] = [];
  for (const name of names) {
    const inFolder = feeds.filter((f) => f.folder === name);
    const n = xmlAttr(name);
    if (!inFolder.length) {
      body.push(`    <outline text="${n}" title="${n}"/>`);
      continue;
    }
    body.push(`    <outline text="${n}" title="${n}">`);
    body.push(...inFolder.map((f) => outline(f, "      ")));
    body.push("    </outline>");
  }
  body.push(...feeds.filter((f) => !f.folder).map((f) => outline(f, "    ")));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    "  <head>",
    `    <title>${xmlAttr(title)}</title>`,
    `    <dateCreated>${new Date().toUTCString()}</dateCreated>`,
    "  </head>",
    "  <body>",
    ...body,
    "  </body>",
    "</opml>",
    "",
  ].join("\n");
}
