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
