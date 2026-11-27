import { extractArticle } from "./readability";
import { sanitizeArticleHtml, type SanitizedHtml } from "./sanitize";

export interface ArticleSource {
  url: string | null;
  rssHtml: string;
  isFullText: boolean;
  /** Readability output stored after a successful full-page fetch. */
  extractedHtml: string | null;
  /** Byline, used to strip author bios and headshots from the body. */
  author?: string | null;
}

/** Which body to show: extracted page if we have it, else the RSS content. */
export function chooseBody(a: ArticleSource): string {
  if (!a.isFullText && a.extractedHtml) return a.extractedHtml;
  return a.rssHtml;
}

export function needsFullPage(a: ArticleSource): boolean {
  return !a.isFullText && !a.extractedHtml && !!a.url;
}

/** Full page HTML -> article HTML, or null when Readability can't find one. */
export function extractFromPage(pageHtml: string, pageUrl: string): string | null {
  const r = extractArticle(pageHtml, pageUrl);
  if (!r) return null;
  // Readability returns very short content for paywalls/cookie walls; treat as failure.
  return r.content.replace(/<[^>]+>/g, "").trim().length > 200 ? r.content : null;
}

export function prepareArticle(a: ArticleSource): SanitizedHtml {
  return sanitizeArticleHtml(chooseBody(a), a.url, { author: a.author });
}
