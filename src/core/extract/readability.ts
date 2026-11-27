import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export interface ExtractedArticle {
  title: string | null;
  byline: string | null;
  excerpt: string | null;
  /** Cleaned article HTML (not yet sanitised for the reader). */
  content: string;
}

/**
 * Extract the main article from a full web page.
 * Pure TS: runs in Node (Jest) and on Hermes via linkedom's JS DOM.
 */
export function extractArticle(html: string, pageUrl: string): ExtractedArticle | null {
  const { document } = parseHTML(html);
  // linkedom does not implement baseURI/documentURI; Readability needs them to
  // resolve relative image and link URLs.
  for (const prop of ["baseURI", "documentURI"] as const) {
    Object.defineProperty(document, prop, { value: pageUrl, configurable: true });
  }
  const result = new Readability(document as unknown as Document, { keepClasses: false }).parse();
  if (!result?.content) return null;
  return {
    title: result.title ?? null,
    byline: result.byline ?? null,
    excerpt: result.excerpt ?? null,
    content: result.content,
  };
}
