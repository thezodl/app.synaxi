/** Small, dependency-free text helpers shared by core modules. */

const ENTITY: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code =
        e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITY[e.toLowerCase()] ?? m;
  });
}

/** Strip tags and collapse whitespace. Good enough for excerpts and word counts. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(text: string): number {
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

export function excerpt(html: string, max = 280): string {
  const t = htmlToText(html);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

/** Stable short hash (djb2, hex) for cache filenames. */
export function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function resolveUrl(
  href: string | null | undefined,
  base: string | null | undefined,
): string | null {
  if (!href) return null;
  const h = href.trim();
  if (!h || /^(javascript|data|about|mailto):/i.test(h)) return /^mailto:/i.test(h) ? h : null;
  try {
    return new URL(h, base ?? undefined).toString();
  } catch {
    return null;
  }
}
