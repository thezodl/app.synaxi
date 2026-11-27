import { resolveUrl } from "../text";
import { stripBoilerplate, type BoilerplateOptions } from "./boilerplate";
import { parseFragment } from "./dom";
import { bestFromSrcset, parseVideoEmbed } from "./media";

/** linkedom nodes are loosely typed. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- linkedom nodes are untyped
type El = any;

/** Tags kept as-is (attributes stripped except ALLOWED_ATTRS). */
const KEEP = new Set([
  "p",
  "br",
  "hr",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "blockquote",
  "pre",
  "code",
  "em",
  "strong",
  "b",
  "i",
  "u",
  "s",
  "del",
  "ins",
  "sub",
  "sup",
  "small",
  "mark",
  "abbr",
  "q",
  "cite",
  "kbd",
  "a",
  "img",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "caption",
  "div",
  "video",
  "source",
]);
/** Tags removed together with their content. */
const DROP = new Set([
  "script",
  "style",
  "noscript",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "nav",
  "aside",
  "footer",
  "header",
  "svg",
  "object",
  "embed",
  "canvas",
  "template",
  "link",
  "meta",
  "title",
  "audio",
  "map",
]);
const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ["href"],
  img: ["src", "alt", "width", "height"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
  video: ["src", "poster", "controls", "width", "height"],
  source: ["src", "type"],
  abbr: ["title"],
};
const LAZY_SRC = [
  "data-src",
  "data-lazy-src",
  "data-original",
  "data-orig-file",
  "data-large-file",
  "data-url",
];
const LAZY_SRCSET = ["data-srcset", "data-lazy-srcset", "srcset"];

export interface SanitizedHtml {
  html: string;
  /** Absolute image URLs in document order (deduplicated), for offline download. */
  images: string[];
}

function resolveImg(img: El, base: string | null): string | null {
  for (const name of LAZY_SRC) {
    const v = img.getAttribute(name);
    if (v) return resolveUrl(v, base);
  }
  const fromSet = LAZY_SRCSET.map((n) => bestFromSrcset(img.getAttribute(n))).find(Boolean);
  const src = img.getAttribute("src");
  // Prefer srcset when src is a placeholder (data: URI or tiny gif).
  if (
    fromSet &&
    (!src || src.startsWith("data:") || /\b(blank|spacer|placeholder|pixel)\b/i.test(src))
  ) {
    return resolveUrl(fromSet, base);
  }
  return resolveUrl(src ?? fromSet, base);
}

function isTrackingPixel(img: El): boolean {
  const w = parseInt(img.getAttribute("width") ?? "", 10);
  const h = parseInt(img.getAttribute("height") ?? "", 10);
  return (w > 0 && w <= 2) || (h > 0 && h <= 2);
}

function unwrap(el: El) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function videoFigure(doc: El, embed: NonNullable<ReturnType<typeof parseVideoEmbed>>): El {
  const fig = doc.createElement("figure");
  fig.setAttribute("class", "video");
  fig.setAttribute("data-provider", embed.provider);
  fig.setAttribute("data-embed", embed.embedUrl);
  fig.setAttribute("data-watch", embed.watchUrl);
  if (embed.posterUrl) {
    const img = doc.createElement("img");
    img.setAttribute("src", embed.posterUrl);
    img.setAttribute("alt", "Video");
    img.setAttribute("class", "video-poster");
    fig.appendChild(img);
  }
  return fig;
}

/**
 * Reduce arbitrary article HTML to the reader allowlist: text structure,
 * images (with lazy-load attributes resolved), tables, and YouTube/Vimeo
 * embeds turned into poster figures that the reader activates when online.
 */
export function sanitizeArticleHtml(
  html: string,
  baseUrl: string | null,
  opts: BoilerplateOptions = {},
): SanitizedHtml {
  const { document, body } = parseFragment(html);
  const images: string[] = [];
  const seen = new Set<string>();

  // <picture>: collapse to its <img>, using the best <source> if the img has nothing better.
  for (const pic of Array.from(body.querySelectorAll("picture")) as El[]) {
    const img = pic.querySelector("img");
    if (img && !img.getAttribute("srcset")) {
      const set = Array.from(pic.querySelectorAll("source") as El[])
        .map((s: El) => s.getAttribute("srcset") ?? s.getAttribute("data-srcset"))
        .find(Boolean);
      if (set) img.setAttribute("srcset", set);
    }
    if (img) pic.parentNode?.replaceChild(img, pic);
    else pic.parentNode?.removeChild(pic);
  }

  // Before the walk, so promo images are never collected for download.
  stripBoilerplate(body, opts);

  const walk = (node: El) => {
    for (const child of Array.from(node.childNodes) as El[]) {
      if (child.nodeType === 8) {
        node.removeChild(child); // comment
        continue;
      }
      if (child.nodeType !== 1) continue;
      const tag = child.tagName.toLowerCase();

      if (tag === "iframe") {
        const embed = parseVideoEmbed(child.getAttribute("src") ?? child.getAttribute("data-src"));
        if (embed) {
          const fig = videoFigure(document, embed);
          node.replaceChild(fig, child);
          if (embed.posterUrl && !seen.has(embed.posterUrl)) {
            seen.add(embed.posterUrl);
            images.push(embed.posterUrl);
          }
        } else {
          node.removeChild(child);
        }
        continue;
      }
      if (DROP.has(tag)) {
        node.removeChild(child);
        continue;
      }
      if (tag === "h1") {
        const h2 = document.createElement("h2");
        while (child.firstChild) h2.appendChild(child.firstChild);
        node.replaceChild(h2, child);
        walk(h2);
        continue;
      }
      if (!KEEP.has(tag)) {
        walk(child);
        unwrap(child);
        continue;
      }

      if (tag === "img") {
        const src = resolveImg(child, baseUrl);
        if (!src || isTrackingPixel(child)) {
          node.removeChild(child);
          continue;
        }
        child.setAttribute("src", src);
        if (!seen.has(src)) {
          seen.add(src);
          images.push(src);
        }
      } else if (tag === "a") {
        const href = resolveUrl(child.getAttribute("href"), baseUrl);
        if (href) child.setAttribute("href", href);
        else child.removeAttribute("href");
      } else if (tag === "video" || tag === "source") {
        const src = resolveUrl(child.getAttribute("src"), baseUrl);
        if (src) child.setAttribute("src", src);
        if (tag === "video") {
          child.setAttribute("controls", "");
          const poster = resolveUrl(child.getAttribute("poster"), baseUrl);
          if (poster) child.setAttribute("poster", poster);
        }
      }
      cleanAttrs(child, tag);
      walk(child);
    }
  };

  const cleanAttrs = (el: El, tag: string) => {
    const allowed = ALLOWED_ATTRS[tag] ?? [];
    for (const { name } of Array.from(el.attributes) as { name: string }[]) {
      if (!allowed.includes(name)) el.removeAttribute(name);
    }
  };

  walk(body);

  // Drop empty paragraphs/divs left behind by removed chrome.
  for (const el of Array.from(body.querySelectorAll("p, div, figure, li")) as El[]) {
    if (
      !el.textContent.trim() &&
      !el.querySelector("img, video, iframe") &&
      !el.classList?.contains("video")
    ) {
      el.parentNode?.removeChild(el);
    }
  }
  return { html: body.innerHTML.trim(), images };
}
