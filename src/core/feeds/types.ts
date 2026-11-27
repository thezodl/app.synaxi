export interface ParsedEntry {
  guid: string;
  url: string | null;
  title: string;
  author: string | null;
  /** Epoch ms, or null when the feed gives no usable date. */
  publishedAt: number | null;
  /** Best available body HTML (content:encoded / atom content / description). */
  html: string;
  thumbnailUrl: string | null;
}

export interface ParsedFeed {
  title: string | null;
  siteUrl: string | null;
  entries: ParsedEntry[];
}
