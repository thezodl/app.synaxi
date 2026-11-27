import { htmlToText, wordCount } from "../text";

const TRUNCATION =
  /(\.\.\.|…|\[…\]|\[\.\.\.\]|read more|continue reading|read the (full|rest)|the post .* appeared first on)\s*\S{0,40}$/i;

/**
 * Heuristic: does the RSS body already contain the full article?
 * Long bodies count as full unless they end with a "read more" style marker;
 * short ones are treated as summaries and trigger a full-page fetch on open.
 */
export function isFullText(html: string): boolean {
  const text = htmlToText(html);
  const words = wordCount(text);
  if (words < 120) return false;
  const tail = text.slice(-120);
  if (TRUNCATION.test(tail) && words < 400) return false;
  return words >= 150;
}
