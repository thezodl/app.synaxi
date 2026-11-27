import { parseHTML } from "linkedom";

/** Parse an HTML fragment into a linkedom document; returns the body to work on. */
export function parseFragment(html: string) {
  const { document } = parseHTML(`<!doctype html><html><head></head><body>${html}</body></html>`);
  return { document, body: document.body };
}
