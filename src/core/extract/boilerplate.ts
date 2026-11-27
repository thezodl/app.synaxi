/** linkedom nodes are loosely typed. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- linkedom nodes are untyped
type El = any;

/**
 * Publisher boilerplate that feeds and Readability let through: affiliate
 * disclosures, "add us on Google / Reddit" promos, author social lines,
 * sponsored banner images and "More on X:" related-story lists.
 *
 * Rules are deliberately narrow (start-anchored text on short blocks, known
 * link destinations) so real article paragraphs are never matched.
 */

/** Short blocks whose whole text starts with one of these are dropped. */
const PROMO_TEXT: RegExp[] = [
  /^FTC:/i,
  /^(disclosure|affiliate disclosure)\s*:/i,
  /^(this|the) (post|article|page|story) (may )?contains? affiliate links?/i,
  /^we may (earn|receive) (a )?(small )?(commission|compensation)/i,
  /^(when you )?(buy|purchase) (something )?through (links|our links)/i,
  /\badd (us )?as a (preferred|trusted) source on google\b/i,
  /^(click to )?join us on (reddit|discord|telegram|whatsapp)\b/i,
  /^follow us on (google news|twitter|x|threads|bluesky|instagram|facebook|youtube|tiktok)\b/i,
  /^(subscribe to (our|the) (newsletter|youtube channel|podcast))\b/i,
  /^(sign up|subscribe) (for|to) (our|the) .{0,40}newsletter\b/i,
  /^(advertisement|sponsored|sponsored content|story continues below)$/i,
];
/** Blocks longer than this are treated as real prose and never matched by text. */
const PROMO_MAX_LEN = 300;

/** "Follow Ben: Twitter/X, Threads…" — only dropped when the rest is mostly links. */
const FOLLOW = /^(follow|find) [\p{L}.' -]{1,40}?(\bon\b|:)/iu;

/**
 * Leftover button and widget labels (share bars, follow buttons, toasts).
 * Matched only when they are a block's entire text.
 */
const UI_LABEL =
  /^(follow(ing)?|unfollow|link copied( to clipboard)?|copied( to clipboard)?|copy( the)? link|share( this)?( (article|story|post))?|share on [\w ]{1,20}|save( (article|story|for later))?|saved|print|email|comments?|\d+ comments?|view comments|listen( to this (article|story))?|gift( this)? article|sign in|log in|\d+ min(ute)?s? read|close|menu)[.!]?$/i;

/** "Published Nov 22, 2026, 4:00 AM EST": the reader header already shows the date. */
const MONTH = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DATELINE = new RegExp(
  `^(published|updated|posted|last updated|first published)( on)?\\s*:?\\s*(${MONTH} \\d{1,2}|\\d{1,2} ${MONTH}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}/\\d{2,4}|(mon|tue|wed|thu|fri|sat|sun)[a-z]*,)`,
  "i",
);

/** Image URL or alt text that marks an author headshot. */
const HEADSHOT =
  /[/_-](avatars?|headshots?|authors?|bylines?|profile[-_]?(pics?|photos?|images?))[/_.-]/i;

/** Labels that introduce a list of links to other stories. */
const RELATED_LABEL =
  /^(more (on|from|in|about|for)\b.*|related( (stories|articles|reading|posts|coverage|content))?|read (more|next|also)|see also|also read|also on .+|you (may|might) (also )?like|recommended( for you| reading)?|top stories|latest( news)?|further reading|keep reading|trending( now)?|popular( now)?|more stories|more news|in other news|what to read next)\s*:?$/i;

/** Hosts and URLs that only ever appear as promo or affiliate links. */
const PROMO_HREF: RegExp[] = [
  /^https?:\/\/(www\.)?google\.[a-z.]+\/preferences\/source/i,
  /^https?:\/\/news\.google\.com\/(publications|s\/)/i,
  /^https?:\/\/(www\.|old\.)?reddit\.com\/r\/[^/]+\/?(\?.*)?$/i,
  /^https?:\/\/(www\.)?flipboard\.com\/@/i,
  /^https?:\/\/(amzn\.to|geni\.us|howl\.me|shop-links\.co|bit\.ly|fave\.co|ebay\.us)\//i,
  /^https?:\/\/[^/]*(skimresources|redirectingat|shareasale|linksynergy|anrdoezrs|tkqlhce|dpbolvw|jdoqocy|kqzyfj|awin1|pntra|pjtra|pjatr|go2cloud|impact(radius)?|sjv\.io|avantlink|bestbuy\.7tiv|narrativ|sovrn)\./i,
  /[?&](tag|ascsubtag|affid|aff_id|affiliate|aff|ref_id|irclickid)=/i,
  /[?&]utm_medium=(affiliate|display|banner|cpc|paid|sponsored)\b/i,
];
/** Image alt/src text that marks a promo badge. */
const PROMO_IMG = /preferred[-_ ]?source|join[-_ ]us[-_ ]on|google[-_ ]news|follow[-_ ]us/i;

const BLOCKS = "p, li, h2, h3, h4, h5, h6, figcaption, div, section, figure, aside";

function text(el: El): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Quotes and embeds (tweets, Instagram, Reddit, Bluesky… all arrive as
 * <blockquote>) and video are someone else's content, never publisher
 * boilerplate, so nothing in, around or containing them is removed.
 */
function isProtected(el: El): boolean {
  if (el.closest?.("blockquote")) return true;
  return !!el.querySelector?.("blockquote, iframe, video");
}

function remove(el: El) {
  if (isProtected(el)) return;
  el.parentNode?.removeChild(el);
}

/** Share of the element's text that sits inside links (0..1). */
function linkedShare(el: El): number {
  const all = text(el).replace(/[\s,·•|–-]/g, "").length;
  if (!all) return 0;
  const linked = (Array.from(el.querySelectorAll("a")) as El[])
    .map(text)
    .join("")
    .replace(/\s/g, "");
  return linked.length / all;
}

/** True when every bit of text inside `el` sits inside a link. */
function onlyLinks(el: El): boolean {
  return linkedShare(el) >= 0.9;
}

function isPromoHref(href: string | null): boolean {
  return !!href && PROMO_HREF.some((r) => r.test(href));
}

/** <a><img></a> with no text: a banner or badge, if it goes somewhere promotional. */
function isPromoImageLink(a: El): boolean {
  if (text(a)) return false;
  const img = a.querySelector("img");
  if (!img) return false;
  const label = `${img.getAttribute("alt") ?? ""} ${img.getAttribute("src") ?? ""} ${img.getAttribute("data-src") ?? ""}`;
  return isPromoHref(a.getAttribute("href")) || PROMO_IMG.test(label);
}

/** Next element sibling, skipping whitespace text nodes. */
function nextElement(el: El): El | null {
  let n = el.nextSibling;
  while (n && n.nodeType !== 1) {
    if (n.nodeType === 3 && n.textContent.trim()) return null;
    n = n.nextSibling;
  }
  return n ?? null;
}

/** Byline names: "A, B and C" -> ["a", "b", "c"]; very short names are ignored. */
function authorNames(author: string | null | undefined): string[] {
  if (!author) return [];
  return author
    .split(/,|&|\band\b/i)
    .map((n) => n.replace(/\s+/g, " ").trim().toLowerCase())
    .filter((n) => n.length >= 5 && n.includes(" "));
}

/** "Brian VanHooker is a pop culture writer…" for one of the article's authors. */
function isAuthorBio(t: string, names: string[]): boolean {
  if (t.length > 1200) return false;
  const lower = t.toLowerCase();
  return names.some((n) =>
    new RegExp(
      `^${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(is|was|has|writes|covers|joined|lives)\\b`,
    ).test(lower),
  );
}

export interface BoilerplateOptions {
  /** The article's byline, used to spot author bios, "By X" lines and headshots. */
  author?: string | null;
}

/** Removes publisher boilerplate from `body` in place. */
export function stripBoilerplate(body: El, opts: BoilerplateOptions = {}) {
  const names = authorNames(opts.author);

  // Author headshots.
  for (const img of Array.from(body.querySelectorAll("img")) as El[]) {
    const alt = (img.getAttribute("alt") ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    const src = `${img.getAttribute("src") ?? ""} ${img.getAttribute("data-src") ?? ""}`;
    if (HEADSHOT.test(src) || (alt && names.includes(alt))) remove(img);
  }

  // Banner and badge images that link to promo / affiliate destinations.
  for (const a of Array.from(body.querySelectorAll("a")) as El[]) {
    if (isPromoImageLink(a)) remove(a);
  }
  for (const img of Array.from(body.querySelectorAll("img")) as El[]) {
    if (PROMO_IMG.test(img.getAttribute("alt") ?? "")) remove(img);
  }

  // "More on Samsung:" followed by a list of links, and "Related: <link>" lines.
  for (const el of Array.from(body.querySelectorAll("p, h2, h3, h4, h5, h6, strong, b")) as El[]) {
    if (!el.parentNode) continue;
    const t = text(el);
    if (t.length > 80) continue;
    // A bold label inside its own paragraph: treat the paragraph as the label.
    let label = el;
    const tag = el.tagName.toLowerCase();
    if ((tag === "strong" || tag === "b") && el.parentNode.tagName?.toLowerCase() === "p") {
      label = el.parentNode;
    }
    const lt = text(label);
    if (RELATED_LABEL.test(lt)) {
      const list = nextElement(label);
      if (list && /^(ul|ol)$/i.test(list.tagName) && onlyLinks(list)) {
        remove(list);
        remove(label);
      }
      continue;
    }
    // "Related: Some other story" in one paragraph.
    const prefix = /^([^:]{2,40}):\s*.+$/.exec(lt)?.[1];
    if (prefix && RELATED_LABEL.test(prefix) && label.tagName.toLowerCase() === "p") {
      const rest = label.cloneNode(true);
      const first = rest.querySelector("strong, b, em, span");
      if (first && text(first).startsWith(prefix)) first.parentNode.removeChild(first);
      if (onlyLinks(rest)) remove(label);
    }
  }

  // Short blocks of promo text (disclosures, "add us on Google", "Follow Ben: ...").
  // Innermost first, so a short promo <p> goes but its long parent <div> stays.
  const blocks = (Array.from(body.querySelectorAll(BLOCKS)) as El[]).reverse();
  for (const el of blocks) {
    if (!el.parentNode) continue;
    const t = text(el);
    if (!t) continue;
    if (t.length > PROMO_MAX_LEN) {
      if (isAuthorBio(t, names) && !el.querySelector(BLOCKS)) remove(el);
      continue;
    }
    if (isAuthorBio(t, names)) {
      remove(el);
      continue;
    }
    if (PROMO_TEXT.some((r) => r.test(t))) remove(el);
    else if (t.length < 40 && UI_LABEL.test(t)) remove(el);
    else if (t.length < 80 && DATELINE.test(t)) remove(el);
    else if (
      names.length &&
      t.length < 80 &&
      /^by\s/i.test(t) &&
      names.some((n) => t.toLowerCase().includes(n))
    )
      remove(el);
    else if (t.length < 150 && FOLLOW.test(t) && linkedShare(el) >= 0.4) remove(el);
  }
}
