import { parseFragment } from "./dom";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- linkedom nodes are untyped
type El = any;

export const CAROUSEL_MIN = 3;

interface Slide {
  img: El;
  caption: string | null;
}

const isElement = (n: El) => n.nodeType === 1;
const isBlankText = (n: El) => n.nodeType === 3 && !n.textContent.trim();
const tagOf = (n: El) => (isElement(n) ? n.tagName.toLowerCase() : "");

/**
 * If `el` holds nothing but images (with optional figcaptions), return them as slides; else null.
 * Handles `<img>`, `<figure><img><figcaption>`, and wrappers (`p`, `div`, `a`) of those.
 */
function slidesOf(el: El): Slide[] | null {
  const tag = tagOf(el);
  if (tag === "img") return [{ img: el, caption: null }];
  if (tag === "br") return [];
  if (tag === "figure") {
    if (el.classList?.contains("video")) return null;
    const imgs = Array.from(el.querySelectorAll("img")) as El[];
    if (imgs.length !== 1) return null;
    const cap = el.querySelector("figcaption");
    const textOutsideCaption = (el.textContent as string)
      .replace(cap?.textContent ?? "", "")
      .trim();
    if (textOutsideCaption) return null;
    return [{ img: imgs[0], caption: cap?.textContent.trim() || null }];
  }
  if (tag === "p" || tag === "div" || tag === "a" || tag === "span") {
    const out: Slide[] = [];
    for (const c of Array.from(el.childNodes) as El[]) {
      if (isBlankText(c)) continue;
      if (!isElement(c)) return null;
      const s = slidesOf(c);
      if (!s) return null;
      out.push(...s);
    }
    return out.length ? out : null;
  }
  return null;
}

function buildCarousel(doc: El, slides: Slide[]): El {
  const wrap = doc.createElement("div");
  wrap.setAttribute("class", "carousel");
  wrap.setAttribute("data-count", String(slides.length));
  for (const s of slides) {
    const fig = doc.createElement("figure");
    const img = doc.createElement("img");
    for (const a of ["src", "alt", "width", "height"]) {
      const v = s.img.getAttribute(a);
      if (v) img.setAttribute(a, v);
    }
    fig.appendChild(img);
    if (s.caption) {
      const cap = doc.createElement("figcaption");
      cap.textContent = s.caption;
      fig.appendChild(cap);
    }
    wrap.appendChild(fig);
  }
  return wrap;
}

function groupIn(doc: El, container: El) {
  const children = Array.from(container.childNodes) as El[];
  let run: El[] = [];
  let slides: Slide[] = [];

  const flush = () => {
    if (slides.length >= CAROUSEL_MIN) {
      const first = run.find(isElement);
      container.insertBefore(buildCarousel(doc, slides), first);
      for (const n of run) container.removeChild(n);
    }
    run = [];
    slides = [];
  };

  for (const node of children) {
    if (isBlankText(node)) {
      if (run.length) run.push(node);
      continue;
    }
    const s = isElement(node) ? slidesOf(node) : null;
    if (s && s.length) {
      run.push(node);
      slides.push(...s);
      continue;
    }
    if (s && !s.length && run.length) {
      run.push(node); // a <br> between images doesn't break the run
      continue;
    }
    flush();
    // Look for runs deeper down (e.g. inside a blockquote or a mixed div).
    if (isElement(node) && !["pre", "table", "figure"].includes(tagOf(node))) groupIn(doc, node);
  }
  flush();
}

/**
 * Turn runs of 3+ consecutive images (no text between) into a carousel. Galleries come out of the
 * sanitiser as such runs, so they're covered too. Two images stay inline. Expects sanitised HTML.
 */
export function groupCarousels(html: string): string {
  if (!/<img\b/i.test(html)) return html;
  const { document, body } = parseFragment(html);
  groupIn(document, body);
  return body.innerHTML;
}
